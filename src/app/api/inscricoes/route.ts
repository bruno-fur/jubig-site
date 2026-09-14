import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import {
  validarCPF,
  dataValida,
  nomeCompleto,
  idadeNaData,
  formatarReais,
  formatarData,
} from "@/lib/validacao";

const Pessoa = z.object({
  nome: z.string().min(3).max(120),
  cpf: z.string(),
  nascimento: z.string(),
  telefone: z.string().optional().default(""),
  // Só o id: o nome gravado sai do cadastro de igrejas, no banco.
  igrejaId: z.uuid(),
  deBoa: z.boolean().default(false),
  esportes: z.array(z.uuid()).default([]),
});

const Pedido = z.object({
  evento: z.string().min(1),
  parcelas: z.number().int().min(1).max(12).default(1),
  inscritos: z.array(Pessoa).min(1).max(40),
});

export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  // Trava de verdade: o banner é aviso, isto é o bloqueio.
  if (!sessao.emailConfirmado) {
    return NextResponse.json(
      { erro: "email_nao_confirmado", mensagem: "Confirme seu e-mail antes de se inscrever." },
      { status: 403 }
    );
  }

  const cru = await req.json().catch(() => null);
  const pedido = Pedido.safeParse(cru);
  if (!pedido.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { evento: slug, parcelas, inscritos } = pedido.data;

  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) return NextResponse.json({ erro: "evento_nao_encontrado" }, { status: 404 });

  if (parcelas > evento.max_parcelas) {
    return NextResponse.json({ erro: "parcelas_acima_do_limite" }, { status: 400 });
  }

  /*
   * Confere cada pessoa ANTES de gravar qualquer coisa. O banco repete todas
   * estas regras — aqui é só para a mensagem chegar legível na tela, em vez de
   * um erro cru do Postgres.
   */
  const vistos = new Set<string>();
  for (const p of inscritos) {
    if (!nomeCompleto(p.nome))
      return NextResponse.json({ erro: "nome_incompleto", inscrito: p.nome }, { status: 400 });

    const cpf = p.cpf.replace(/\D/g, "");
    if (!validarCPF(cpf))
      return NextResponse.json({ erro: "cpf_invalido", inscrito: p.nome }, { status: 400 });
    if (vistos.has(cpf))
      return NextResponse.json({ erro: "cpf_repetido", inscrito: p.nome }, { status: 400 });
    vistos.add(cpf);

    if (!dataValida(p.nascimento))
      return NextResponse.json({ erro: "nascimento_invalido", inscrito: p.nome }, { status: 400 });
    if (idadeNaData(p.nascimento, evento.data_evento) < evento.idade_minima)
      return NextResponse.json(
        { erro: "idade_minima", inscrito: p.nome, minima: evento.idade_minima },
        { status: 400 }
      );

    // Escolher é obrigatório: ou compete, ou marca que vai só de boa.
    if (!p.deBoa && p.esportes.length === 0)
      return NextResponse.json({ erro: "sem_escolha", inscrito: p.nome }, { status: 400 });
    if (p.deBoa && p.esportes.length > 0)
      return NextResponse.json({ erro: "escolha_conflitante", inscrito: p.nome }, { status: 400 });
  }

  // Igreja fora da lista (ou desativada no meio do preenchimento): mensagem legível.
  const { data: igrejas } = await supabase
    .from("igrejas")
    .select("id, nome, cidade")
    .eq("ativa", true)
    .in("id", [...new Set(inscritos.map((p) => p.igrejaId))]);
  const nomeDaIgreja = new Map((igrejas ?? []).map((i) => [i.id, `${i.nome} (${i.cidade})`]));
  const semIgreja = inscritos.find((p) => !nomeDaIgreja.has(p.igrejaId));
  if (semIgreja)
    return NextResponse.json({ erro: "igreja_invalida", inscrito: semIgreja.nome }, { status: 400 });

  /*
   * Uma chamada só: a função grava inscrição, inscritos e esportes na mesma
   * transação. Se a última modalidade lotar no meio, nada fica gravado.
   *
   * `igreja` vai junto com `igrejaId` só por compatibilidade: o banco atual
   * usa o id e ignora o texto; um banco sem o schema novo ainda lê o texto.
   */
  const { data: codigo, error } = await supabase.rpc("criar_inscricao", {
    p_slug: slug,
    p_parcelas: parcelas,
    p_inscritos: inscritos.map((p) => ({ ...p, igreja: nomeDaIgreja.get(p.igrejaId) })),
  });

  if (error) return NextResponse.json(traduzirErro(error.message), { status: statusDoErro(error.message) });

  const valor = evento.valor_centavos * inscritos.length;

  // E-mail 2: comprovante de inscrição.
  // Não derruba a inscrição se o envio falhar — o e-mail já loga o erro.
  await Emails.inscricaoRecebida(sessao.email, {
    nome: sessao.nome ?? inscritos[0].nome,
    codigo: codigo as string,
    evento: evento.nome,
    data: formatarData(evento.data_evento),
    local: evento.cidade,
    valor: formatarReais(valor),
    parcelas,
    esportes: [],
  });

  return NextResponse.json({ codigo, status: "aguardando_pagamento" });
}

/** O Postgres devolve a mensagem crua do `raise exception`; aqui vira erro nomeado. */
function traduzirErro(msg: string) {
  if (msg.includes("idade_minima:"))
    return { erro: "idade_minima", inscrito: msg.split("idade_minima:")[1]?.trim() };
  if (msg.includes("igreja_invalida:"))
    return { erro: "igreja_invalida", inscrito: msg.split("igreja_invalida:")[1]?.trim() };
  if (msg.includes("modalidade lotada")) return { erro: "modalidade_lotada" };
  if (msg.includes("limite_no_turno")) return { erro: "limite_no_turno", mensagem: msg };
  if (msg.includes("inscrito_unico_por_evento")) return { erro: "cpf_ja_inscrito" };
  if (msg.includes("evento_lotado")) return { erro: "evento_lotado" };
  if (msg.includes("inscricoes_encerradas")) return { erro: "inscricoes_encerradas" };
  if (msg.includes("evento_nao_encontrado")) return { erro: "evento_nao_encontrado" };
  if (msg.includes("parcelas fora do permitido")) return { erro: "parcelas_acima_do_limite" };
  // A política de insert é a camada 4: chegar aqui significa e-mail não confirmado.
  if (/row-level security|violates row-level/i.test(msg)) return { erro: "email_nao_confirmado" };
  console.error("[inscricoes] erro inesperado", msg);
  return { erro: "falha_ao_gravar" };
}

function statusDoErro(msg: string) {
  if (/row-level security|violates row-level/i.test(msg)) return 403;
  if (/lotad|inscrito_unico_por_evento|limite_no_turno/i.test(msg)) return 409;
  if (msg.includes("evento_nao_encontrado")) return 404;
  return 400;
}
