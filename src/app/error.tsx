"use client";

import { useEffect, useState } from "react";

export default function Erro({ error, reset }: { error: Error; reset: () => void }) {
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    console.error("[app]", error);
    // Roda no navegador: o número de Diretoria > Site vem pela API pública.
    fetch("/api/configuracoes")
      .then((r) => r.json())
      .then((d: { whatsapp?: string }) => setWhatsapp(d.whatsapp ?? null))
      .catch(() => setWhatsapp(null));
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <img src="/juca/choque.webp" alt="" className="mx-auto w-32" />
      <h1 className="mt-4 text-3xl">Deu ruim aqui do nosso lado</h1>
      <p className="mt-2 text-apagado">
        Sua inscrição não se perde por causa disso. Tente de novo — se insistir, fala com a
        diretoria.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="botao-primario">
          Tentar de novo
        </button>
        <a
          href={whatsapp ? `https://wa.me/${whatsapp}` : "/#contato"}
          target={whatsapp ? "_blank" : undefined}
          rel="noreferrer"
          className="botao-secundario"
        >
          Chamar a diretoria
        </a>
      </div>
    </div>
  );
}
