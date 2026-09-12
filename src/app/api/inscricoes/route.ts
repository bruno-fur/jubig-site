import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import { validarCPF, idadeNaData, formatarReais, formatarData } from "@/lib/validacao";

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

  const body = await req.json();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos").select("*").eq("slug", body.evento).single();
  if (!evento) return NextResponse.json({ erro: "evento_nao_encontrado" }, { status: 404 });

  // Valida cada pessoa antes de gravar qualquer coisa
  for (const p of body.inscritos) {
    if (p.nome.trim().split(/\s+/).filter((x: string) => x.length > 1).length < 2)
      return NextResponse.json({ erro: "nome_incompleto", inscrito: p.nome }, { status: 400 });
    if (!validarCPF(p.cpf))
      return NextResponse.json({ erro: "cpf_invalido", inscrito: p.nome }, { status: 400 });
    if (idadeNaData(p.nascimento, evento.data_evento) < evento.idade_minima)
      return NextResponse.json({ erro: "idade_minima", inscrito: p.nome }, { status: 400 });
  }

  const { data: codigo } = await supabase.rpc("gerar_codigo", { prefixo: body.prefixo ?? "JD" });
  const valor = evento.valor_centavos * body.inscritos.length;

  const { data: inscricao, error } = await supabase
    .from("inscricoes")
    .insert({
      codigo,
      evento_id: evento.id,
      responsavel_id: sessao.userId,
      parcelas: body.parcelas ?? 1,
      valor_centavos: valor,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  await supabase.from("inscritos").insert(
    body.inscritos.map((p: any) => ({
      inscricao_id: inscricao.id,
      nome: p.nome,
      cpf: p.cpf.replace(/\D/g, ""),
      nascimento: p.nascimento,
      telefone: p.telefone,
      igreja: p.igreja,
      de_boa: p.deBoa ?? false,
    }))
  );

  // E-mail 2: comprovante de inscrição
  await Emails.inscricaoRecebida(sessao.email, {
    nome: sessao.nome ?? body.inscritos[0].nome,
    codigo: codigo!,
    evento: evento.nome,
    data: formatarData(evento.data_evento),
    local: evento.cidade,
    valor: formatarReais(valor),
    parcelas: body.parcelas,
    esportes: body.esportes,
  });

  return NextResponse.json({ codigo, status: "aguardando_pagamento" });
}
