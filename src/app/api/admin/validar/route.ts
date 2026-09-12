import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import { formatarReais, formatarData } from "@/lib/validacao";

/** A diretoria aprova ou recusa. Cada decisão dispara o e-mail correspondente. */
export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  const supabase = await createClient();
  const { data: membro } = await supabase
    .from("diretoria").select("user_id").eq("user_id", sessao.userId).single();
  if (!membro) return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const { codigo, aprovado, motivo } = await req.json();
  if (!aprovado && !motivo)
    return NextResponse.json({ erro: "motivo_obrigatorio" }, { status: 400 });

  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("*, eventos(*), inscritos(nome)")
    .eq("codigo", codigo)
    .single();
  if (!inscricao) return NextResponse.json({ erro: "nao_encontrada" }, { status: 404 });

  await supabase.from("inscricoes").update({
    status: aprovado ? "confirmada" : "recusada",
    motivo_recusa: aprovado ? null : motivo,
    atualizado_em: new Date().toISOString(),
  }).eq("id", inscricao.id);

  await supabase.from("comprovantes").update({
    aprovado, avaliado_por: sessao.userId, avaliado_em: new Date().toISOString(),
  }).eq("inscricao_id", inscricao.id).is("aprovado", null);

  const { data: dono } = await supabase.auth.admin.getUserById(inscricao.responsavel_id);
  const email = dono.user?.email;
  if (!email) return NextResponse.json({ erro: "sem_email" }, { status: 500 });

  const dados = {
    nome: inscricao.inscritos[0]?.nome ?? "",
    codigo,
    evento: inscricao.eventos.nome,
    data: formatarData(inscricao.eventos.data_evento),
    local: inscricao.eventos.cidade,
    valor: formatarReais(inscricao.valor_centavos),
  };

  // E-mail 4a ou 4b
  if (aprovado) await Emails.inscricaoAprovada(email, dados);
  else await Emails.comprovanteRecusado(email, dados, motivo);

  return NextResponse.json({ status: aprovado ? "confirmada" : "recusada" });
}
