import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { pegarSessao } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import { formatarReais, formatarData } from "@/lib/validacao";

const Corpo = z.object({
  codigo: z.string().min(3),
  aprovado: z.boolean(),
  motivo: z.string().default(""),
});

/** A diretoria aprova ou recusa. Cada decisão dispara o e-mail correspondente. */
export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  const supabase = await createClient();
  const { data: membro } = await supabase
    .from("diretoria")
    .select("user_id")
    .eq("user_id", sessao.userId)
    .maybeSingle();
  if (!membro) return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { codigo, aprovado } = corpo.data;
  const motivo = corpo.data.motivo.trim();

  if (!aprovado && motivo.length < 5)
    return NextResponse.json({ erro: "motivo_obrigatorio" }, { status: 400 });

  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("*, eventos(*), inscritos(nome), comprovantes(id, parcela, aprovado)")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();
  if (!inscricao) return NextResponse.json({ erro: "nao_encontrada" }, { status: 404 });
  // Aprovar pagamento de inscrição cancelada reativaria uma vaga que já foi embora.
  if (inscricao.status === "cancelada")
    return NextResponse.json({ erro: "inscricao_cancelada" }, { status: 409 });

  const pendentes = inscricao.comprovantes.filter(
    (c: { aprovado: boolean | null }) => c.aprovado === null
  );
  if (pendentes.length === 0)
    return NextResponse.json({ erro: "nada_pendente" }, { status: 409 });

  const agora = new Date().toISOString();
  await supabase
    .from("comprovantes")
    .update({ aprovado, avaliado_por: sessao.userId, avaliado_em: agora, motivo: aprovado ? null : motivo })
    .in(
      "id",
      pendentes.map((c: { id: string }) => c.id)
    );

  /*
   * Numa inscrição parcelada, aprovar uma parcela não confirma a vaga: ela
   * volta para "aguardando pagamento" até o último comprovante entrar.
   */
  const aprovadas =
    inscricao.comprovantes.filter((c: { aprovado: boolean | null }) => c.aprovado === true).length +
    (aprovado ? pendentes.length : 0);
  const quitada = aprovadas >= inscricao.parcelas;

  const status = aprovado ? (quitada ? "confirmada" : "aguardando_pagamento") : "recusada";

  const { error: erroStatus } = await supabase
    .from("inscricoes")
    .update({ status, motivo_recusa: aprovado ? null : motivo })
    .eq("id", inscricao.id);
  if (erroStatus) {
    console.error("[validar] status não gravou", erroStatus.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }

  // Só o service role lê o e-mail de outro usuário — nunca em código de cliente.
  const admin = criarClienteAdmin();
  const { data: dono } = await admin.auth.admin.getUserById(inscricao.responsavel_id);
  const email = dono.user?.email;
  if (!email) {
    console.error("[validar] inscrição sem e-mail do responsável", codigo);
    return NextResponse.json({ status, aviso: "sem_email" });
  }

  const dados = {
    nome: inscricao.inscritos[0]?.nome ?? "",
    codigo,
    evento: inscricao.eventos.nome,
    data: formatarData(inscricao.eventos.data_evento),
    local: inscricao.eventos.cidade,
    valor: formatarReais(inscricao.valor_centavos),
  };

  // E-mail 4a ou 4b. Parcela intermediária aprovada não manda "confirmada".
  if (aprovado && quitada) await Emails.inscricaoAprovada(email, dados);
  else if (!aprovado) await Emails.comprovanteRecusado(email, dados, motivo);

  return NextResponse.json({ status });
}
