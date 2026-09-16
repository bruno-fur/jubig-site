"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const nada = () => () => {};

/**
 * Faixa para a diretoria: "tem X comprovantes para aprovar".
 *
 * Fechar esconde só até a quantidade mudar — a chave inclui o número. Chegou
 * comprovante novo, a faixa volta; fechou e nada mudou, ela não insiste a cada
 * página.
 */
export function AvisoPendencias({ comprovantes }: { comprovantes: number }) {
  const chave = `jubig-pendencias-fechado-${comprovantes}`;

  // sessionStorage só existe no navegador; no servidor a faixa nasce aberta.
  const fechadoAntes = useSyncExternalStore(
    nada,
    () => {
      try {
        return sessionStorage.getItem(chave) === "1";
      } catch {
        return false;
      }
    },
    () => false
  );
  const [fechadoAgora, setFechadoAgora] = useState(false);

  if (comprovantes === 0 || fechadoAntes || fechadoAgora) return null;

  return (
    <div role="status" className="border-t border-laranja/30 bg-laranja text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <img src="/juca/nervoso.webp" alt="" className="h-7 w-7 rounded-full bg-white/20 object-contain" />
        <p className="min-w-0 flex-1">
          <strong>
            {comprovantes} {comprovantes === 1 ? "comprovante" : "comprovantes"}
          </strong>{" "}
          {comprovantes === 1 ? "esperando" : "esperando"} aprovação da diretoria.
        </p>
        <Link
          href="/diretoria/inscricoes?status=pendente_analise"
          className="rounded-[10px] bg-white px-3 py-1 font-semibold text-laranja-escuro hover:bg-creme"
        >
          Analisar agora
        </Link>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => {
            try {
              sessionStorage.setItem(chave, "1");
            } catch {
              /* navegador sem storage: fecha só nesta página */
            }
            setFechadoAgora(true);
          }}
          className="rounded-[10px] px-2 py-1 font-semibold text-white/80 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
