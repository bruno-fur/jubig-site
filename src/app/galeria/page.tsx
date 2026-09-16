import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/validacao";
import { GradeDeFotos, type Foto } from "./GradeDeFotos";

export const metadata: Metadata = {
  title: "Galeria",
  description: "Fotos dos encontros da JUBIG.",
};

export const dynamic = "force-dynamic";

/**
 * Todas as fotos, agrupadas por evento.
 *
 * O bucket `fotos` é público, então a URL é direta — sem signed URL, sem
 * consulta extra por imagem. Comprovante é o oposto disso e mora em bucket
 * privado.
 */
export default async function Galeria({ searchParams }: { searchParams: Promise<{ evento?: string }> }) {
  const { evento: slug } = await searchParams;
  const supabase = await createClient();

  const [{ data: fotos }, { data: eventos }] = await Promise.all([
    supabase.from("galeria").select("*").order("ordem").order("criado_em", { ascending: false }),
    supabase.from("eventos").select("id, slug, nome, data_evento").order("data_evento", { ascending: false }),
  ]);

  const base = supabase.storage.from("fotos");
  const todas: (Foto & { eventoId: string | null })[] = (fotos ?? []).map((f) => ({
    id: f.id as string,
    legenda: (f.legenda as string) ?? null,
    eventoId: (f.evento_id as string) ?? null,
    url: base.getPublicUrl(f.caminho as string).data.publicUrl,
  }));

  const albuns = (eventos ?? [])
    .map((e) => ({
      id: e.id as string,
      slug: e.slug as string,
      nome: e.nome as string,
      data: e.data_evento as string,
      fotos: todas.filter((f) => f.eventoId === e.id),
    }))
    .filter((a) => a.fotos.length > 0);

  const geral = todas.filter((f) => !f.eventoId);
  const escolhido = slug ? albuns.find((a) => a.slug === slug) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <h1 className="text-4xl lg:text-5xl">Galeria</h1>
      <p className="mt-2 text-apagado lg:text-lg">
        {todas.length > 0
          ? `${todas.length} fotos dos nossos encontros.`
          : "As fotos dos encontros aparecem aqui."}
      </p>

      {albuns.length > 1 && (
        <nav aria-label="Álbuns" className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/galeria"
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
              escolhido ? "border-linha text-apagado" : "border-laranja bg-laranja/10 text-laranja-escuro"
            }`}
          >
            Tudo
          </Link>
          {albuns.map((a) => (
            <Link
              key={a.id}
              href={`/galeria?evento=${a.slug}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                escolhido?.id === a.id
                  ? "border-laranja bg-laranja/10 text-laranja-escuro"
                  : "border-linha text-apagado"
              }`}
            >
              {a.nome}
            </Link>
          ))}
        </nav>
      )}

      {todas.length === 0 && (
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

      {(escolhido ? [escolhido] : albuns).map((a) => (
        <section key={a.id} className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl lg:text-3xl">{a.nome}</h2>
            <p className="text-sm text-apagado">{formatarData(a.data)}</p>
          </div>
          <GradeDeFotos fotos={a.fotos} />
        </section>
      ))}

      {!escolhido && geral.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl lg:text-3xl">Outros momentos</h2>
          <GradeDeFotos fotos={geral} />
        </section>
      )}
    </div>
  );
}
