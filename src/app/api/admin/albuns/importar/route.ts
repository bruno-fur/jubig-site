import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";

const Pedido = z.object({
  albumId: z.uuid(),
  link: z.url().max(500),
  quantas: z.number().int().min(1).max(10).default(5),
});

/** Aceita o link da pasta e também o link de "compartilhar" com parâmetros. */
function idDaPasta(link: string): string | null {
  return link.match(/\/folders\/([A-Za-z0-9_-]{20,})/)?.[1] ?? null;
}

/**
 * Traz as primeiras fotos de uma pasta pública do Google Drive.
 *
 * Lê o HTML da pasta e pega os identificadores dos arquivos. Não é API
 * oficial: a do Drive exigiria conta de desenvolvedor, autorização e uma
 * chave para renovar — muito para um punhado de fotos de prévia que a
 * diretoria traz uma vez por evento.
 *
 * Baixa a miniatura grande que o próprio Drive gera, e não o arquivo
 * original: as fotos do Congresso 2023 têm 18 MB cada, e a miniatura fica em
 * torno de 150 KB com a mesma aparência na tela.
 */
async function fotosDaPasta(pasta: string, quantas: number) {
  const r = await fetch(`https://drive.google.com/drive/folders/${pasta}`, {
    headers: { "accept-language": "pt-BR", "user-agent": "Mozilla/5.0 (jubig-site)" },
  });
  if (!r.ok) return [];

  const html = await r.text();
  const ids = [...new Set([...html.matchAll(/data-id="([A-Za-z0-9_-]{25,})"/g)].map((m) => m[1]))].filter(
    (id) => id !== pasta
  );

  const fotos: { bytes: ArrayBuffer; tipo: string }[] = [];
  for (const id of ids) {
    if (fotos.length >= quantas) break;
    const img = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w1600`);
    const tipo = img.headers.get("content-type") ?? "";
    if (!img.ok || !tipo.startsWith("image/")) continue;
    fotos.push({ bytes: await img.arrayBuffer(), tipo });
  }
  return fotos;
}

export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!(await papelDe(sessao.userId)))
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { albumId, link, quantas } = corpo.data;

  const pasta = idDaPasta(link);
  if (!pasta) return NextResponse.json({ erro: "link_nao_e_pasta" }, { status: 400 });

  const fotos = await fotosDaPasta(pasta, quantas);
  if (fotos.length === 0)
    return NextResponse.json({ erro: "pasta_vazia_ou_privada" }, { status: 400 });

  const supabase = await createClient();
  const { data: album } = await supabase.from("albuns").select("id, titulo").eq("id", albumId).maybeSingle();
  if (!album) return NextResponse.json({ erro: "album_nao_encontrado" }, { status: 404 });

  const { count } = await supabase
    .from("galeria")
    .select("id", { count: "exact", head: true })
    .eq("album_id", albumId);

  let entraram = 0;
  for (const [i, foto] of fotos.entries()) {
    const extensao = foto.tipo.includes("png") ? "png" : foto.tipo.includes("webp") ? "webp" : "jpg";
    const caminho = `albuns/${albumId}/${crypto.randomUUID()}.${extensao}`;

    const { error: erroUpload } = await supabase.storage
      .from("fotos")
      .upload(caminho, foto.bytes, { contentType: foto.tipo, upsert: false });
    if (erroUpload) {
      console.error("[albuns] upload falhou", erroUpload.message);
      continue;
    }

    const { error } = await supabase
      .from("galeria")
      .insert({ caminho, album_id: albumId, ordem: (count ?? 0) + i });
    if (error) {
      await supabase.storage.from("fotos").remove([caminho]);
      console.error("[albuns] insert falhou", error.message);
      continue;
    }
    entraram++;
  }

  if (entraram === 0) return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  return NextResponse.json({ status: "ok", fotos: entraram });
}
