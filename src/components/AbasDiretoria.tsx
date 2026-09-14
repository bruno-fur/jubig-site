"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LinkNav } from "./LinkNav";

export type AbaDiretoria = {
  href: string;
  titulo: string;
  grupo: "dia" | "admin";
  /** Outras rotas que pertencem a esta seção. */
  tambem?: string[];
};

const GRUPOS: { id: AbaDiretoria["grupo"]; titulo: string }[] = [
  { id: "dia", titulo: "Dia a dia" },
  { id: "admin", titulo: "Administração" },
];

/**
 * Menu da diretoria.
 *
 * Eram onze abas numa linha só: no computador sobrava barra de rolagem, no
 * celular ninguém achava "Equipe" lá no fim. Agora:
 *   - computador: coluna lateral, em dois grupos — o que a diretoria usa toda
 *     semana em cima, a estrutura (só admin) embaixo
 *   - celular: um botão com a seção atual, que abre a lista inteira
 *
 * "/diretoria" só acende no endereço exato — todas as outras começam com ele.
 */
export function AbasDiretoria({ abas }: { abas: AbaDiretoria[] }) {
  const caminho = usePathname();

  // Guarda EM QUAL página o menu do celular foi aberto: navegou, ele fecha
  // sozinho, sem efeito para "resetar" estado.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === caminho;

  const ativa = (a: AbaDiretoria) =>
    [a.href, ...(a.tambem ?? [])].some((h) =>
      h === "/diretoria" ? caminho === h : caminho === h || caminho.startsWith(`${h}/`)
    );
  const atual = abas.find(ativa);
  const grupos = GRUPOS.map((g) => ({ ...g, itens: abas.filter((a) => a.grupo === g.id) })).filter(
    (g) => g.itens.length > 0
  );

  const lista = (
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.id}>
          {grupos.length > 1 && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-apagado uppercase">{g.titulo}</p>
          )}
          <ul className="grid gap-0.5">
            {g.itens.map((a) => {
              const eAtual = ativa(a);
              return (
                <li key={a.href}>
                  <LinkNav
                    href={a.href}
                    atual={eAtual}
                    className={`w-full rounded-[10px] px-3 py-2 text-sm font-semibold transition ${
                      eAtual ? "bg-laranja text-white" : "text-tinta hover:bg-areia"
                    }`}
                  >
                    {a.titulo}
                  </LinkNav>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Celular e tablet */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls="menu-diretoria"
          onClick={() => setAbertoEm(aberto ? null : caminho)}
          className="flex w-full items-center justify-between rounded-[10px] border-2 border-linha bg-white px-4 py-3 text-left"
        >
          <span>
            <span className="block text-[11px] font-semibold tracking-wide text-apagado uppercase">Seção</span>
            <span className="titulo block text-lg text-tinta">{atual?.titulo ?? "Diretoria"}</span>
          </span>
          <span aria-hidden="true" className={`text-xl text-apagado ${aberto ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        {aberto && (
          <nav id="menu-diretoria" aria-label="Seções da diretoria" className="cartao mt-2 p-3">
            {lista}
          </nav>
        )}
      </div>

      {/* Computador */}
      <nav aria-label="Seções da diretoria" className="sticky top-24 hidden self-start lg:block">
        {lista}
      </nav>
    </>
  );
}
