import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { legendaDaFoto, ondeFica, tituloDoAlbum, type Album, type LinhaGaleria } from "@/lib/galeria";

/**
 * Prévia da galeria: poucas fotos do álbum mais recente, o título dele e os
 * dois caminhos — o acervo completo (fora do site) e a página /galeria.
 *
 * Bucket `fotos` é público de propósito — aqui é foto de evento, não
 * comprovante. Comprovante mora no bucket privado e só sai por signed URL.
 */
export async function Galeria({
  limite = 6,
  eventoId,
  verTodas = false,
}: {
  limite?: number;
  eventoId?: string;
  /** Mostra o link para /galeria — a home traz só a prévia. */
  verTodas?: boolean;
}) {
  const supabase = await createClient();

  let consulta = supabase
    .from("galeria")
    .select("*")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (eventoId) consulta = consulta.eq("evento_id", eventoId);

  const [{ data }, { data: albunsCru }, { data: eventosCru }] = await Promise.all([
    consulta,
    supabase.from("albuns").select("*"),
    supabase.from("eventos").select("id, nome, data_evento"),
  ]);

  const fotos = (data ?? []) as LinhaGaleria[];
  if (fotos.length === 0) return null;

  const albuns = new Map<string, Album>(
    ((albunsCru ?? []) as Record<string, unknown>[]).map((a) => [
      a.id as string,
      {
        id: a.id as string,
        titulo: a.titulo as string,
        link: (a.link as string) ?? null,
        data: (a.data as string) ?? null,
        eventoId: (a.evento_id as string) ?? null,
        ordem: (a.ordem as number) ?? 0,
      },
    ])
  );
  const eventos = new Map(
    (eventosCru ?? []).map((e) => [e.id as string, { nome: e.nome as string, data: e.data_evento as string }])
  );

  const base = supabase.storage.from("fotos");

  /*
   * O título é o álbum das fotos que estão aqui: "Congresso de Carnaval 2023"
   * diz muito mais do que "Galeria". Se a prévia misturar álbuns, volta a ser
   * o nome genérico.
   */
  const titulos = new Set(fotos.map((f) => tituloDoAlbum(f, albuns, eventos)).filter(Boolean));
  const umAlbumSo = titulos.size === 1;
  const titulo = umAlbumSo ? [...titulos][0]! : "Galeria";
  const link = umAlbumSo ? (albuns.get(fotos[0].album_id ?? "")?.link ?? null) : null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="revelar flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl lg:text-4xl">{titulo}</h2>
          {umAlbumSo && <p className="mt-1 text-apagado">Um pedaço do que rolou.</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="botao-secundario">
              {ondeFica(link)} ↗
            </a>
          )}
          {verTodas && (
            <Link href="/galeria" className="botao-secundario">
              Ver a galeria
            </Link>
          )}
        </div>
      </div>

      <ul className="revelar mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {fotos.map((f) => (
          <li key={f.id} className="realce overflow-hidden rounded-[16px] border border-linha bg-white">
            <img
              src={base.getPublicUrl(f.caminho).data.publicUrl}
              alt={legendaDaFoto(f) ?? ""}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
