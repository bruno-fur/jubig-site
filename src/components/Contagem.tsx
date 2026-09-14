"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

function assinarRelogio(aoMudar: () => void) {
  const t = setInterval(aoMudar, 1000);
  return () => clearInterval(t);
}

// Segundos inteiros: o valor só muda uma vez por segundo, então o React não re-renderiza à toa.
const agoraEmSegundos = () => Math.floor(Date.now() / 1000);

/**
 * Contagem regressiva até uma data.
 *
 * O relógio vem de fora do React, então useSyncExternalStore: no servidor não
 * existe "agora" confiável para esta pessoa, e ele devolve null — a tela
 * nasce com "--" e começa a contar ao hidratar, sem erro de hidratação.
 *
 * Os números trocam sem animação nenhuma: nada pisca, nada desliza, então não
 * há o que desligar para quem pede menos movimento.
 *
 * `recarregarAoZerar`: na abertura das inscrições, ao chegar a zero a página
 * recarrega os dados e o botão "Inscrever" aparece sozinho.
 */
export function Contagem({
  alvo,
  titulo,
  recarregarAoZerar = false,
  escuro = false,
}: {
  alvo: string;
  titulo: string;
  recarregarAoZerar?: boolean;
  escuro?: boolean;
}) {
  const router = useRouter();
  const agora = useSyncExternalStore(assinarRelogio, agoraEmSegundos, () => null);
  const restante = agora === null ? null : Math.max(Math.floor(Date.parse(alvo) / 1000) - agora, 0);

  const recarregou = useRef(false);
  useEffect(() => {
    if (recarregarAoZerar && restante === 0 && !recarregou.current) {
      recarregou.current = true;
      router.refresh();
    }
  }, [recarregarAoZerar, restante, router]);

  // Chegou a hora e não há o que recarregar: a contagem simplesmente sai.
  if (restante === 0 && !recarregarAoZerar) return null;

  const partes: [string, number | null][] = [
    ["dias", restante === null ? null : Math.floor(restante / 86400)],
    ["horas", restante === null ? null : Math.floor((restante % 86400) / 3600)],
    ["min", restante === null ? null : Math.floor((restante % 3600) / 60)],
    ["seg", restante === null ? null : restante % 60],
  ];

  const dias = partes[0][1];

  return (
    <div role="timer" aria-label={dias === null ? titulo : `${titulo}: ${dias} dias`}>
      <p className={`text-sm font-semibold ${escuro ? "text-creme/80" : "text-apagado"}`}>{titulo}</p>
      <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
        {partes.map(([rotulo, valor]) => (
          <div
            key={rotulo}
            className="min-w-[3.75rem] rounded-[10px] border border-linha bg-white px-2 py-2 text-center"
          >
            <span className="titulo block text-2xl leading-none text-tinta tabular-nums">
              {valor === null ? "--" : String(valor).padStart(2, "0")}
            </span>
            <span className="mt-1 block text-[10px] tracking-wide text-apagado uppercase">{rotulo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
