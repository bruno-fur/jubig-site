"use client";

import { useEffect, useRef, useState } from "react";

import type { Foto } from "@/lib/galeria";
export type { Foto };

/**
 * Grade de fotos com abertura em tela cheia.
 *
 * `<dialog>` nativo: prende o foco, fecha no Esc e não precisa de biblioteca
 * de lightbox. As setas do teclado andam entre as fotos, que é o que se
 * espera de um álbum.
 */
export function GradeDeFotos({ fotos }: { fotos: Foto[] }) {
  const janela = useRef<HTMLDialogElement>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    const d = janela.current;
    if (!d) return;
    if (aberta !== null && !d.open) d.showModal();
    if (aberta === null && d.open) d.close();
  }, [aberta]);

  function andar(passo: number) {
    setAberta((i) => (i === null ? null : (i + passo + fotos.length) % fotos.length));
  }

  const foto = aberta === null ? null : fotos[aberta];

  return (
    <>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {fotos.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setAberta(i)}
              className="realce block w-full overflow-hidden rounded-[16px] border border-linha bg-white"
            >
              <img
                src={f.url}
                alt={f.legenda ?? "Foto de um encontro da JUBIG"}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={janela}
        onClose={() => setAberta(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") andar(1);
          if (e.key === "ArrowLeft") andar(-1);
        }}
        aria-label="Foto ampliada"
        className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl rounded-[16px] border border-linha bg-tinta p-0 text-creme backdrop:bg-tinta/80"
      >
        {foto && (
          <figure className="m-0">
            <img src={foto.url} alt={foto.legenda ?? ""} className="max-h-[70dvh] w-full object-contain" />
            <figcaption className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span className="min-w-0 flex-1">{foto.legenda ?? ""}</span>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => andar(-1)} className="botao-secundario px-3 py-1.5">
                  ← Anterior
                </button>
                <button type="button" onClick={() => andar(1)} className="botao-secundario px-3 py-1.5">
                  Próxima →
                </button>
                <button type="button" onClick={() => setAberta(null)} className="botao-primario px-3 py-1.5">
                  Fechar
                </button>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
