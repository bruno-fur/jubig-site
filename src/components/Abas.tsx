"use client";

import { useRef, useState, useSyncExternalStore } from "react";

type Aba = { id: string; titulo: string; conteudo: React.ReactNode };

const lerHash = () => window.location.hash.slice(1);

function assinarHash(aoMudar: () => void) {
  window.addEventListener("hashchange", aoMudar);
  return () => window.removeEventListener("hashchange", aoMudar);
}

/**
 * Abas com teclado e endereço.
 *
 * Setas, Home e End mudam de aba — é o que um `role="tablist"` promete a quem
 * usa leitor de tela, e sem isso a promessa fica quebrada.
 *
 * A aba escolhida entra no hash da URL. Quem manda "veja a programação" no
 * grupo da igreja cola um link que abre na aba certa, e recarregar a página
 * não joga a pessoa de volta para a primeira.
 */
export function Abas({ abas }: { abas: Aba[] }) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const [escolhida, setEscolhida] = useState<string | null>(null);

  /*
   * O hash vem de fora do React — muda com voltar e avançar do navegador, sem
   * passar por nenhum estado nosso. useSyncExternalStore é a ferramenta para
   * isso: lê no cliente, devolve vazio no servidor (onde hash não existe) e
   * não precisa de efeito, que dispararia render em cascata.
   */
  const hash = useSyncExternalStore(assinarHash, lerHash, () => "");
  const doHash = abas.some((a) => a.id === hash) ? hash : null;
  const atual = escolhida ?? doHash ?? abas[0]?.id;

  function escolher(id: string, comFoco = false) {
    setEscolhida(id);
    history.replaceState(null, "", `#${id}`);
    if (comFoco) botoes.current[abas.findIndex((a) => a.id === id)]?.focus();
  }

  function teclado(e: React.KeyboardEvent) {
    const i = abas.findIndex((a) => a.id === atual);
    const ultimo = abas.length - 1;

    const destino =
      e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? ultimo : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? ultimo
      : null;

    if (destino === null) return;
    e.preventDefault();
    escolher(abas[destino].id, true);
  }

  return (
    <div>
      <div
        role="tablist"
        onKeyDown={teclado}
        className="flex gap-1 overflow-x-auto border-b border-linha"
      >
        {abas.map((a, i) => {
          const ativa = atual === a.id;
          return (
            <button
              key={a.id}
              ref={(el) => {
                botoes.current[i] = el;
              }}
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={ativa}
              aria-controls={`painel-${a.id}`}
              // Só a aba ativa entra na ordem de tabulação; dentro do
              // tablist quem navega são as setas.
              tabIndex={ativa ? 0 : -1}
              onClick={() => escolher(a.id)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                ativa
                  ? "border-laranja text-laranja-escuro"
                  : "border-transparent text-apagado hover:border-linha hover:text-tinta"
              }`}
            >
              {a.titulo}
            </button>
          );
        })}
      </div>

      {abas.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`painel-${a.id}`}
          aria-labelledby={`aba-${a.id}`}
          tabIndex={0}
          hidden={atual !== a.id}
          className="pt-6 focus-visible:outline-none"
        >
          {/*
            Todas as abas ficam montadas, escondidas por `hidden`. Trocar de
            aba deixa de remontar o conteúdo — no celular isso era um pisca a
            cada toque, e a posição da rolagem se perdia.
          */}
          {a.conteudo}
        </div>
      ))}
    </div>
  );
}
