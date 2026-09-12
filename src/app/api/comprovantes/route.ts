import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import { formatarReais, formatarData } from "@/lib/validacao";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!sessao.emailConfirmado)
    return NextResponse.json({ erro: "email_nao_confirmado" }, { status: 403 });

  const form = await req.formData();
  const arquivo = form.get("arquivo") as File | null;
  const codigo = String(form.get("codigo"));
  const parcela = Number(form.get("parcela") ?? 1);

  if (!arquivo) return NextResponse.json({ erro: "sem_arquivo" }, { status: 400 });
  if (!TIPOS.includes(arquivo.type))
    return NextResponse.json({ erro: "tipo_invalido" }, { status: 400 });
  if (arquivo.size > MAX) return NextResponse.json({ erro: "arquivo_grande" }, { status: 400 });

  const supabase = await createClient();
  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("*, eventos(*)")
    .eq("codigo", codigo)
    .single();
  if (!inscricao) return NextResponse.json({ erro: "inscricao_nao_encontrada" }, { status: 404 });

  // Bucket PRIVADO: comprovante de PIX mostra nome, banco e às vezes CPF.
  const caminho = `${inscricao.id}/parcela-${parcela}-${Date.now()}`;
  const { error: erroUpload } = await supabase.storage
    .from("comprovantes")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (erroUpload) return NextResponse.json({ erro: erroUpload.message }, { status: 400 });

  await supabase.from("comprovantes").insert({ inscricao_id: inscricao.id, parcela, caminho });
  await supabase.from("inscricoes")
    .update({ status: "em_analise", atualizado_em: new Date().toISOString() })
    .eq("id", inscricao.id);

  // E-mail 3: comprovante recebido
  await Emails.comprovanteRecebido(sessao.email, {
    nome: sessao.nome ?? "",
    codigo,
    evento: inscricao.eventos.nome,
    data: formatarData(inscricao.eventos.data_evento),
    local: inscricao.eventos.cidade,
    valor: formatarReais(inscricao.valor_centavos),
  });

  return NextResponse.json({ status: "em_analise" });
}
