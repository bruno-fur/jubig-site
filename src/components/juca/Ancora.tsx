"use client";

import { Juca, type EstadoJuca } from "./Juca";
import { useJuca } from "./contexto";

/**
 * O Juca preso a um campo. Posicionamento já testado no celular — não troque:
 *
 *   campo com foco   -> 58px, logo acima do campo, `absolute`
 *   erro sem teclado -> 72px, no mesmo lugar, com seta apontando para o campo
 *   nenhum dos dois  -> não aparece; quem assume é o <JucaCanto>
 *
 * `absolute` dentro do wrapper do campo, nunca `fixed` com conta de
 * `visualViewport`: dentro de webview no iOS aquele cálculo erra a altura e o
 * Juca some atrás do teclado.
 */
export function AncoraJuca({
  campoId,
  estado,
  fala,
  erro,
}: {
  campoId: string;
  estado: EstadoJuca;
  fala?: string;
  erro?: string | null;
}) {
  const { focado } = useJuca();
  const comFoco = focado === campoId;
  const apontando = !comFoco && Boolean(erro) && focado === null;

  if (!comFoco && !apontando) return null;

  return (
    <div className="absolute right-0 bottom-full z-10 mb-1 flex flex-col items-end" aria-hidden="true">
      <Juca
        estado={erro ? "invalido" : estado}
        fala={erro ?? fala}
        tamanho={apontando ? 72 : 58}
        bolhaPara="esquerda"
      />
      {apontando && <span className="mr-6 -mt-1 text-laranja">▼</span>}
    </div>
  );
}

/**
 * O Juca grande, parado no canto inferior direito. Some sozinho assim que
 * qualquer campo recebe foco — quem assume é o <AncoraJuca> daquele campo.
 *
 * `fixed` puro, sem ler `visualViewport`: aquele cálculo dava altura errada
 * dentro de webview no iOS e o Juca ficava atrás do teclado.
 */
export function JucaCanto({ estado, fala }: { estado: EstadoJuca; fala?: string }) {
  const { focado } = useJuca();
  if (focado) return null;

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-20 sm:right-6 sm:bottom-6">
      <Juca estado={estado} fala={fala} tamanho={92} bolhaPara="esquerda" />
    </div>
  );
}
