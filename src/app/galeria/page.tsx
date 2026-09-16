import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/validacao";
import { legendaDaFoto, ondeFica, tituloDoAlbum, type Album, type Foto, type LinhaGaleria } from "@/lib/galeria";
import { GradeDeFotos } from "./GradeDeFotos";

export const metadata: Metadata = {
  title: "Galeria",
  description: "Fotos dos encontros da JUBIG.",
};

export const dynamic = "force-dynamic";

type Bloco = { chave: string; titulo: string; data: string | null; link: string | null; fotos: Foto[] };

/**
 * Galeria em álbuns: a prévia fica aqui, o acervo completo fica no link.
 *
 * Hospedar mil fotos de congresso estouraria o 1 GB do plano gratuito, e o
 * material bruto já vive no Drive de quem fotografou.
 */
export default async function Galeria({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const { album: escolhido } = await searchParams;
  const supabase = await createClient();

  const [{ data: linhasCru }, { data: albunsCru }, { data: eventosCru }] = await Promise.all([
    supabase.from("galeria").select("*").order("ordem").order("criado_em", { ascending: false }),
    supabase.from("albuns").select("*").order("ordem").order("criado_em", { ascending: false }),
    supabase.from("eventos").select("id, nome, data_evento"),
  ]);

  const base = supabase.storage.from("fotos");
  const linhas = (linhasCru ?? []) as LinhaGaleria[];

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

  const blocos = new Map<string, Bloco>();
  for (const f of linhas) {
    const album = f.album_id ? albuns.get(f.album_id) : undefined;
    const evento = f.evento_id ? eventos.get(f.evento_id) : undefined;
    const chave = f.album_id ?? f.evento_id ?? tituloDoAlbum(f, albuns, eventos) ?? "outros";

    const atual =
      blocos.get(chave) ??
      ({
        chave,
        titulo: tituloDoAlbum(f, albuns, eventos) ?? "Outros momentos",
        data: album?.data ?? evento?.data ?? null,
        link: album?.link ?? null,
        fotos: [],
      } satisfies Bloco);

    atual.fotos.push({
      id: f.id,
      url: base.getPublicUrl(f.caminho).data.publicUrl,
      legenda: legendaDaFoto(f),
    });
    blocos.set(chave, atual);
  }

  // Álbum cadastrado sem foto nenhuma continua aparecendo: o link do acervo já
  // vale por si só.
  for (const a of albuns.values()) {
    if (!blocos.has(a.id)) {
      blocos.set(a.id, { chave: a.id, titulo: a.titulo, data: a.data, link: a.link, fotos: [] });
    }
  }

  const lista = [...blocos.values()];
  const aberto = escolhido ? lista.find((b) => b.chave === escolhido) : null;
  const mostrar = aberto ? [aberto] : lista;
  const total = linhas.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <h1 className="text-4xl lg:text-5xl">Galeria</h1>
      <p className="mt-2 text-apagado lg:text-lg">
        {total > 0
          ? "Uma prévia de cada encontro. O álbum completo abre no link de cada um."
          : "As fotos dos encontros aparecem aqui."}
      </p>

      {lista.length > 1 && (
        <nav aria-label="Álbuns" className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/galeria"
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
              aberto ? "border-linha text-apagado" : "border-laranja bg-laranja/10 text-laranja-escuro"
            }`}
          >
            Tudo
          </Link>
          {lista.map((b) => (
            <Link
              key={b.chave}
              href={`/galeria?album=${encodeURIComponent(b.chave)}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                aberto?.chave === b.chave
                  ? "border-laranja bg-laranja/10 text-laranja-escuro"
                  : "border-linha text-apagado"
              }`}
            >
              {b.titulo}
            </Link>
          ))}
        </nav>
      )}

      {lista.length === 0 && (
        <div className="cartao mt-6 flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">
            Ainda não subimos fotos. Se você tem fotos dos encontros,{" "}
            <Link href="/#contato" className="font-semibold text-laranja-escuro hover:underline">
              fale com a diretoria
            </Link>
            .
          </p>
        </div>
      )}

      {mostrar.map((b) => (
        <section key={b.chave} className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-2xl lg:text-3xl">{b.titulo}</h2>
              <p className="mt-0.5 text-sm text-apagado">
                {b.data ? formatarData(b.data) : `${b.fotos.length} fotos`}
              </p>
            </div>
            {b.link && (
              <a href={b.link} target="_blank" rel="noreferrer" className="botao-secundario">
                {ondeFica(b.link)} ↗
              </a>
            )}
          </div>

          {b.fotos.length > 0 ? (
            <GradeDeFotos fotos={b.fotos} />
          ) : (
            <p className="mt-4 text-apagado">As fotos deste álbum estão no link acima.</p>
          )}
        </section>
      ))}
    </div>
  );
}
