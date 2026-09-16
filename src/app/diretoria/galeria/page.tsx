import type { Metadata } from "next";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import type { Album } from "@/lib/galeria";
import { GerenciarGaleria, type FotoDaGaleria } from "./GerenciarGaleria";

export const metadata: Metadata = { title: "Galeria", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Álbuns e fotos de prévia. Diretoria inteira. */
export default async function Galeria() {
  await exigirDiretoria();
  const supabase = await createClient();

  const [{ data: fotos }, { data: albuns }, { data: eventos }] = await Promise.all([
    supabase.from("galeria").select("*").order("ordem").order("criado_em", { ascending: false }),
    // A tabela só existe depois do schema novo: sem ela, a tela mostra o aviso.
    supabase.from("albuns").select("*").order("ordem").order("criado_em", { ascending: false }),
    supabase.from("eventos").select("id, nome").order("data_evento", { ascending: false }),
  ]);

  const base = supabase.storage.from("fotos");
  const comUrl: FotoDaGaleria[] = (fotos ?? []).map((f) => ({
    id: f.id as string,
    legenda: (f.legenda as string) ?? null,
    albumId: (f.album_id as string) ?? null,
    eventoId: (f.evento_id as string) ?? null,
    url: base.getPublicUrl(f.caminho as string).data.publicUrl,
  }));

  return (
    <GerenciarGaleria
      fotos={comUrl}
      albuns={((albuns ?? []) as Record<string, unknown>[]).map(
        (a): Album => ({
          id: a.id as string,
          titulo: a.titulo as string,
          link: (a.link as string) ?? null,
          data: (a.data as string) ?? null,
          eventoId: (a.evento_id as string) ?? null,
          ordem: (a.ordem as number) ?? 0,
        })
      )}
      eventos={(eventos ?? []).map((e) => ({ id: e.id as string, nome: e.nome as string }))}
      semTabela={albuns === null}
    />
  );
}
