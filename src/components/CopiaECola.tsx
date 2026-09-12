"use client";

import { useState } from "react";

export function CopiaECola({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Safari em http e webview às vezes negam a área de transferência:
      // o textarea abaixo continua servindo para copiar na mão.
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={copiar} className="botao-primario w-full">
        {copiado ? "Código copiado!" : "Copiar código PIX"}
      </button>
      <textarea
        readOnly
        value={texto}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Código PIX copia e cola"
        className="mt-2 h-20 w-full resize-none rounded-[10px] border border-linha bg-areia p-2 font-mono text-[11px] break-all text-apagado"
      />
    </div>
  );
}
