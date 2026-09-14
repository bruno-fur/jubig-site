"use client";

import { usePathname } from "next/navigation";
import { LinkNav } from "./LinkNav";

export type AbaDiretoria = {
  href: string;
  titulo: string;
  /** Outras rotas que pertencem a esta aba. */
  tambem?: string[];
};

/**
 * Abas da diretoria, com a aberta marcada.
 *
 * "/diretoria" só acende no endereço exato — todas as outras começam com ele,
 * e a Visão geral ficaria acesa sempre. As demais acendem também nas
 * subpáginas: /diretoria/inscricoes/JD-0001 continua em Inscrições.
 */
export function AbasDiretoria({ abas }: { abas: AbaDiretoria[] }) {
  const caminho = usePathname();

  const ativa = (a: AbaDiretoria) =>
    [a.href, ...(a.tambem ?? [])].some((h) =>
      h === "/diretoria" ? caminho === h : caminho === h || caminho.startsWith(`${h}/`)
    );

  return (
    <nav aria-label="Seções da diretoria" className="mt-5 flex gap-1 overflow-x-auto border-b border-linha">
      {abas.map((a) => {
        const atual = ativa(a);
        return (
          <LinkNav
            key={a.href}
            href={a.href}
            atual={atual}
            className={`-mb-px shrink-0 rounded-t-[10px] border-b-[3px] px-4 py-3 text-sm font-semibold transition ${
              atual
                ? "border-laranja bg-laranja/10 text-laranja-escuro"
                : "border-transparent text-apagado hover:border-laranja/40 hover:text-tinta"
            }`}
          >
            {a.titulo}
          </LinkNav>
        );
      })}
    </nav>
  );
}
