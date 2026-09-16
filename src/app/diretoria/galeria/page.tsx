import type { Metadata } from "next";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { GerenciarGaleria, type FotoDaGaleria } from "./GerenciarGaleria";

export const metadata: Metadata = { title: "Galeria", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Fotos dos eventos: subir, legendar e apagar. Diretoria inteira. */
export default async function Galeria() {
  await exigirDiretoria();
  const supabase = await createClient();

  const [{ data: fotos }, { data: eventos }] = await Promise.all([
    supabase.from("galeria").select("*").order("ordem").order("criado_em", { ascending: false }),
    supabase.from("eventos").select("id, nome, data_evento").order("data_evento", { ascending: false }),
  ]);

  const base = supabase.storage.from("fotos");
  const comUrl: FotoDaGaleria[] = (fotos ?? []).map((f) => ({
    id: f.id as string,
    legenda: (f.legenda as string) ?? null,
    eventoId: (f.evento_id as string) ?? null,
    ordem: (f.ordem as number) ?? 0,
    url: base.getPublicUrl(f.caminho as string).data.publicUrl,
  }));

  return (
    <GerenciarGaleria
      fotos={comUrl}
      eventos={(eventos ?? []).map((e) => ({ id: e.id as string, nome: e.nome as string }))}
    />
  );
}
