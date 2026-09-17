import Link from "next/link";
import type { Evento } from "@/tipos/db";

type Secao = "dados" | "pulseiras";

/**
 * Topo das telas de um evento: voltar, nome e as seções dele.
 *
 * "Dados e programação" só aparece para admin — é onde se mexe na estrutura.
 * Pulseiras é do dia a dia, então a diretoria toda vê. Esconder o link é só
 * conveniência: a página de dados continua com `exigirAdmin()`.
 */
export function CabecalhoEvento({
  evento,
  atual,
  admin,
  extra,
}: {
  evento: Pick<Evento, "id" | "nome" | "slug" | "publicado" | "tem_inscricao">;
  atual: Secao;
  admin: boolean;
  extra?: React.ReactNode;
}) {
  const secoes = [
    admin && { id: "dados", titulo: "Dados e programação", href: `/diretoria/eventos/${evento.id}` },
    evento.tem_inscricao && {
      id: "pulseiras",
      titulo: "Pulseiras e placar",
      href: `/diretoria/eventos/${evento.id}/pulseiras`,
    },
  ].filter(Boolean) as { id: Secao; titulo: string; href: string }[];

  return (
    <>
      <Link href="/diretoria/eventos" className="text-sm font-semibold text-apagado hover:underline">
        ← Eventos
      </Link>
      <div className="mt-2 mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="titulo text-2xl">{evento.nome}</h2>
        <p className="flex gap-4 text-sm">
          {extra}
          {evento.publicado && (
            <Link href={`/${evento.slug}`} className="font-semibold text-apagado hover:underline">
              Ver no site
            </Link>
          )}
        </p>
      </div>

      {secoes.length > 1 && (
        <nav aria-label="Seções do evento" className="mb-6 flex gap-1 border-b-2 border-linha">
          {secoes.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              aria-current={s.id === atual ? "page" : undefined}
              className={`-mb-0.5 border-b-2 px-3 py-2 text-sm font-semibold ${
                s.id === atual
                  ? "border-laranja text-laranja-escuro"
                  : "border-transparent text-apagado hover:text-tinta"
              }`}
            >
              {s.titulo}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
