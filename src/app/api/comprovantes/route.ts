import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import { formatarReais, formatarData } from "@/lib/validacao";

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!sessao.emailConfirmado)
    return NextResponse.json({ erro: "email_nao_confirmado" }, { status: 403 });

  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const codigo = String(form.get("codigo") ?? "").toUpperCase();
  const parcela = Number(form.get("parcela") ?? 1);

  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "sem_arquivo" }, { status: 400 });
  const extensao = TIPOS[arquivo.type];
  if (!extensao) return NextResponse.json({ erro: "tipo_invalido" }, { status: 400 });
  if (arquivo.size > MAX) return NextResponse.json({ erro: "arquivo_grande" }, { status: 400 });

  const supabase = await createClient();

  /*
   * `responsavel_id` explícito além da RLS.
   *
   * Antes a busca era só por `codigo`, e como o código é sequencial (JD-0001,
   * JD-0002...) qualquer pessoa logada podia varrer o evento inteiro anexando
   * comprovante em inscrição dos outros e jogando todas para "em análise".
   */
  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("*, eventos(*)")
    .eq("codigo", codigo)
    .eq("responsavel_id", sessao.userId)
    .maybeSingle();
  if (!inscricao) return NextResponse.json({ erro: "inscricao_nao_encontrada" }, { status: 404 });
  if (inscricao.status === "cancelada")
    return NextResponse.json({ erro: "inscricao_cancelada" }, { status: 409 });

  if (!Number.isInteger(parcela) || parcela < 1 || parcela > inscricao.parcelas)
    return NextResponse.json({ erro: "parcela_invalida" }, { status: 400 });

  // Reenvio depois de recusa é permitido; duplicar parcela em análise, não.
  const { data: jaTem } = await supabase
    .from("comprovantes")
    .select("id")
    .eq("inscricao_id", inscricao.id)
    .eq("parcela", parcela)
    .is("aprovado", null)
    .maybeSingle();
  if (jaTem) return NextResponse.json({ erro: "parcela_ja_enviada" }, { status: 409 });

  /*
   * Bucket PRIVADO: comprovante de PIX mostra nome, banco e às vezes CPF.
   * A primeira pasta do caminho é o id da inscrição — é por ela que a política
   * do storage decide quem grava e quem lê.
   */
  const caminho = `${inscricao.id}/parcela-${parcela}-${Date.now()}.${extensao}`;
  const { error: erroUpload } = await supabase.storage
    .from("comprovantes")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (erroUpload) {
    console.error("[comprovantes] upload falhou", erroUpload.message);
    return NextResponse.json({ erro: "falha_upload" }, { status: 400 });
  }

  // O trigger `comprovante_muda_status` põe a inscrição em análise.
  const { error: erroInsert } = await supabase
    .from("comprovantes")
    .insert({ inscricao_id: inscricao.id, parcela, caminho });
  if (erroInsert) {
    await supabase.storage.from("comprovantes").remove([caminho]);
    console.error("[comprovantes] insert falhou", erroInsert.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }

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
