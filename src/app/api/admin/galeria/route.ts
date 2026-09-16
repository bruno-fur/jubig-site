import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** O bucket recusa acima disso; o navegador já comprime antes de mandar. */
const MAX = 8 * 1024 * 1024;

async function exigirDiretoriaNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return { erro: NextResponse.json({ erro: "nao_autenticado" }, { status: 401 }) };
  if (!(await papelDe(sessao.userId)))
    return { erro: NextResponse.json({ erro: "sem_permissao" }, { status: 403 }) };
  return { sessao };
}

/**
 * Sobe uma foto para a galeria.
 *
 * Bucket `fotos` é público de propósito — aqui é foto de evento, não
 * comprovante. Mesmo assim o upload é só da diretoria: a política do storage
 * exige `eh_diretoria()`, e o 403 explícito evita o "não aconteceu nada" que
 * a RLS devolveria em silêncio.
 *
 * O caminho começa pelo evento (ou "geral"), o que deixa o bucket organizado
 * e facilita apagar um álbum inteiro depois.
 */
export async function POST(req: Request) {
  const { erro } = await exigirDiretoriaNaApi();
  if (erro) return erro;

  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const legenda = String(form.get("legenda") ?? "").trim().slice(0, 200) || null;
  const eventoId = String(form.get("eventoId") ?? "").trim() || null;
  const album = String(form.get("album") ?? "").trim().slice(0, 120) || null;
  const albumId = String(form.get("albumId") ?? "").trim() || null;
  const ordem = Number(form.get("ordem") ?? 0);

  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "sem_arquivo" }, { status: 400 });
  const extensao = TIPOS[arquivo.type];
  if (!extensao) return NextResponse.json({ erro: "tipo_invalido" }, { status: 400 });
  if (arquivo.size > MAX) return NextResponse.json({ erro: "arquivo_grande" }, { status: 400 });
  if (eventoId && !z.uuid().safeParse(eventoId).success)
    return NextResponse.json({ erro: "evento_invalido" }, { status: 400 });
  if (albumId && !z.uuid().safeParse(albumId).success)
    return NextResponse.json({ erro: "album_invalido" }, { status: 400 });

  const supabase = await createClient();
  const caminho = `${albumId ? `albuns/${albumId}` : (eventoId ?? "geral")}/${crypto.randomUUID()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage
    .from("fotos")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (erroUpload) {
    console.error("[galeria] upload falhou", erroUpload.message);
    return NextResponse.json({ erro: "falha_upload" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("galeria")
    .insert({
      caminho,
      legenda,
      album,
      album_id: albumId,
      evento_id: eventoId,
      ordem: Number.isFinite(ordem) ? ordem : 0,
    })
    .select("id")
    .single();

  if (error) {
    // Sem a linha, o arquivo vira lixo no bucket: some junto.
    await supabase.storage.from("fotos").remove([caminho]);
    console.error("[galeria] insert falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }

  return NextResponse.json({ status: "ok", id: data.id, caminho });
}

const Ajuste = z.object({
  id: z.uuid(),
  legenda: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v ? v : null)),
  ordem: z.number().int().min(0).max(9999).optional(),
  albumId: z.uuid().nullish(),
  album: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => (v ? v : null)),
  eventoId: z.uuid().nullish(),
});

export async function PATCH(req: Request) {
  const { erro } = await exigirDiretoriaNaApi();
  if (erro) return erro;

  const corpo = Ajuste.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { id, legenda, ordem, eventoId, album, albumId } = corpo.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("galeria")
    .update({
      legenda,
      ...(album !== undefined && { album }),
      ...(albumId !== undefined && { album_id: albumId }),
      ...(ordem !== undefined && { ordem }),
      ...(eventoId !== undefined && { evento_id: eventoId }),
    })
    .eq("id", id);

  if (error) {
    console.error("[galeria] update falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}

export async function DELETE(req: Request) {
  const { erro } = await exigirDiretoriaNaApi();
  if (erro) return erro;

  const corpo = z.object({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { data: foto } = await supabase
    .from("galeria")
    .select("caminho")
    .eq("id", corpo.data.id)
    .maybeSingle();
  if (!foto) return NextResponse.json({ erro: "nao_encontrada" }, { status: 404 });

  const { error } = await supabase.from("galeria").delete().eq("id", corpo.data.id);
  if (error) {
    console.error("[galeria] delete falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }

  // O arquivo sai depois da linha: se o storage falhar, sobra arquivo órfão —
  // invisível no site — em vez de foto quebrada na tela.
  await supabase.storage.from("fotos").remove([foto.caminho]);
  return NextResponse.json({ status: "ok" });
}
