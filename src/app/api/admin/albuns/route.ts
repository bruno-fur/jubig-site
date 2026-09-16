import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";

const Album = z.object({
  titulo: z.string().trim().min(2).max(120),
  link: z
    .url()
    .max(500)
    .nullish()
    .transform((v) => (v ? v : null)),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish()
    .transform((v) => (v ? v : null)),
  eventoId: z
    .uuid()
    .nullish()
    .transform((v) => (v ? v : null)),
  ordem: z.number().int().min(0).max(999).default(0),
});

async function exigirDiretoriaNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return { erro: NextResponse.json({ erro: "nao_autenticado" }, { status: 401 }) };
  if (!(await papelDe(sessao.userId)))
    return { erro: NextResponse.json({ erro: "sem_permissao" }, { status: 403 }) };
  return { sessao };
}

const colunas = (d: Partial<z.infer<typeof Album>>) => ({
  ...(d.titulo !== undefined && { titulo: d.titulo }),
  ...(d.link !== undefined && { link: d.link }),
  ...(d.data !== undefined && { data: d.data }),
  ...(d.eventoId !== undefined && { evento_id: d.eventoId }),
  ...(d.ordem !== undefined && { ordem: d.ordem }),
});

/**
 * Álbum é o cartão da galeria: título, link do acervo completo e as poucas
 * fotos de prévia que ficam hospedadas aqui.
 *
 * O acervo inteiro segue morando no Drive de quem fotografou — mil fotos de
 * congresso estouram sozinhas o 1 GB do plano gratuito.
 */
export async function POST(req: Request) {
  const { erro } = await exigirDiretoriaNaApi();
  if (erro) return erro;

  const corpo = Album.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.from("albuns").insert(colunas(corpo.data)).select("id").single();

  if (error) {
    console.error("[albuns] insert falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok", id: data.id });
}

export async function PATCH(req: Request) {
  const { erro } = await exigirDiretoriaNaApi();
  if (erro) return erro;

  const corpo = Album.partial().extend({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { id, ...campos } = corpo.data;

  const supabase = await createClient();
  const { error } = await supabase.from("albuns").update(colunas(campos)).eq("id", id);

  if (error) {
    console.error("[albuns] update falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}

/**
 * Apagar o álbum leva junto as fotos de prévia dele — inclusive os arquivos.
 * Deixar foto órfã no bucket é pagar espaço por imagem que ninguém vê.
 */
export async function DELETE(req: Request) {
  const { erro } = await exigirDiretoriaNaApi();
  if (erro) return erro;

  const corpo = z.object({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { data: fotos } = await supabase.from("galeria").select("caminho").eq("album_id", corpo.data.id);

  const { error } = await supabase.from("albuns").delete().eq("id", corpo.data.id);
  if (error) {
    console.error("[albuns] delete falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }

  if (fotos?.length) {
    await supabase.from("galeria").delete().eq("album_id", corpo.data.id);
    await supabase.storage.from("fotos").remove(fotos.map((f) => f.caminho as string));
  }

  return NextResponse.json({ status: "ok", fotos: fotos?.length ?? 0 });
}
