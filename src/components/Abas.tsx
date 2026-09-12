"use client";

import { useState } from "react";

type Aba = { id: string; titulo: string; conteudo: React.ReactNode };

export function Abas({ abas }: { abas: Aba[] }) {
  const [atual, setAtual] = useState(abas[0]?.id);

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-linha">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            id={`aba-${a.id}`}
            aria-selected={atual === a.id}
            aria-controls={`painel-${a.id}`}
            onClick={() => setAtual(a.id)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              atual === a.id
                ? "border-laranja text-laranja-escuro"
                : "border-transparent text-apagado hover:text-tinta"
            }`}
          >
            {a.titulo}
          </button>
        ))}
      </div>

      {abas.map((a) => (
        <div
          key={a.id}
          role="tabpanel"
          id={`painel-${a.id}`}
          aria-labelledby={`aba-${a.id}`}
          hidden={atual !== a.id}
          className="pt-6"
        >
          {atual === a.id && a.conteudo}
        </div>
      ))}
    </div>
  );
}
