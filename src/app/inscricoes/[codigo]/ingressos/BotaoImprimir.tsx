"use client";

export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="botao-secundario">
      Imprimir
    </button>
  );
}
