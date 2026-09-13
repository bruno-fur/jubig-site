import { NextResponse } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { Emails } from "@/lib/email";
import { LIMITE_DISPARO, enviarEmFila, responsaveisDoEvento } from "@/lib/disparo";
import { formatarData } from "@/lib/validacao";

/**
 * Lembretes automáticos, chamados uma vez por dia pela Vercel (vercel.json).
 *
 *   7 dias antes — todas as inscrições ativas; quem não pagou recebe o
 *                  empurrão do pagamento, quem pagou recebe o link do ingresso
 *   véspera      — só as confirmadas, com o link do ingresso
 *
 * Tour não tem inscrição, então não tem para quem lembrar.
 */
export async function GET(req: Request) {
  /*
   * Sem CRON_SECRET a rota recusa tudo. Aberta, qualquer um que descobrisse o
   * endereço mandaria e-mail em massa para os inscritos e queimaria a cota do
   * Gmail do dia — os e-mails de inscrição parariam de sair.
   */
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const admin = criarClienteAdmin();
  const hoje = hojeEmSaoPaulo();
  const alvo = { semana: somarDias(hoje, 7), vespera: somarDias(hoje, 1) };

  const { data: eventos } = await admin
    .from("eventos")
    .select("id, nome, slug, data_evento, cidade, local_nome")
    .eq("publicado", true)
    .eq("tem_inscricao", true)
    .in("data_evento", [alvo.semana, alvo.vespera]);

  const relatorio: Record<string, unknown>[] = [];
  let orcamento = LIMITE_DISPARO;

  for (const e of eventos ?? []) {
    const tipo = e.data_evento === alvo.vespera ? "vespera" : "semana";
    const status = tipo === "vespera" ? ["confirmada"] : ["aguardando_pagamento", "em_analise", "confirmada"];

    const todos = await responsaveisDoEvento(e.id as string, status);

    // Quem já recebeu este lembrete deste evento não recebe de novo.
    const { data: jaForam } = await admin
      .from("lembretes_enviados")
      .select("user_id")
      .eq("evento_id", e.id)
      .eq("tipo", tipo);
    const recebidos = new Set((jaForam ?? []).map((j) => j.user_id as string));

    const pendentes = todos.filter((d) => !recebidos.has(d.userId)).slice(0, orcamento);
    const local = e.local_nome ? `${e.local_nome} · ${e.cidade}` : (e.cidade as string);

    const { enviados, falhas } = await enviarEmFila(pendentes, async (d) => {
      const r = await Emails.lembrete(d.email, d.nome, tipo, {
        evento: e.nome as string,
        slug: e.slug as string,
        data: formatarData(e.data_evento as string),
        local,
        codigo: d.codigo,
        confirmada: d.confirmada,
      });
      if (r.ok) {
        await admin
          .from("lembretes_enviados")
          .upsert({ evento_id: e.id, user_id: d.userId, tipo }, { ignoreDuplicates: true });
      }
      return r;
    });

    orcamento -= enviados + falhas;
    relatorio.push({
      evento: e.slug,
      tipo,
      elegiveis: todos.length,
      enviados,
      falhas,
      adiados: todos.length - recebidos.size - pendentes.length,
    });
    if (orcamento <= 0) break;
  }

  console.log("[lembretes]", hoje, JSON.stringify(relatorio));
  return NextResponse.json({ hoje, relatorio });
}

/** A Vercel roda em UTC; às 21h de Brasília já é "amanhã" lá. */
function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function somarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}
