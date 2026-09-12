"use client";

import { useEffect, useRef, useState } from "react";

export type EstadoJuca =
  | "ocioso"
  | "digitando"
  | "valido"
  | "invalido"
  | "incompleto"
  | "exagero"
  | "urgencia"
  | "recusa";

/** Cada estado do sistema tem uma figurinha. A tabela mora só aqui. */
const FIGURINHA: Record<EstadoJuca, string> = {
  ocioso: "feliz",
  digitando: "heh",
  valido: "joia",
  invalido: "nao",
  incompleto: "nervoso",
  exagero: "choque",
  urgencia: "susto",
  recusa: "choro",
};

type Props = {
  estado: EstadoJuca;
  /** Texto da bolha. Muda a cada tecla — por isso não pode animar sozinho. */
  fala?: string;
  tamanho?: number;
  /** Lado para o qual a bolha abre. */
  bolhaPara?: "esquerda" | "direita";
  className?: string;
};

export function Juca({
  estado,
  fala,
  tamanho = 92,
  bolhaPara = "esquerda",
  className = "",
}: Props) {
  const figurinha = FIGURINHA[estado];
  const anterior = useRef(figurinha);
  const [troca, setTroca] = useState(0);

  /*
   * A animação só dispara quando a FIGURINHA muda.
   * Se dependesse da fala, ele pulsaria a cada letra digitada e viraria ruído.
   * O contador vira `key` da imagem: React remonta, o CSS roda de novo.
   */
  useEffect(() => {
    if (anterior.current !== figurinha) {
      anterior.current = figurinha;
      setTroca((n) => n + 1);
    }
  }, [figurinha]);

  const nega = estado === "invalido" || estado === "recusa";

  return (
    <div className={`pointer-events-none flex items-end gap-2 ${className}`}>
      {fala && bolhaPara === "esquerda" && <Bolha texto={fala} ponta="direita" chave={troca} />}

      <img
        key={troca}
        src={`/juca/${figurinha}.webp`}
        alt=""
        aria-hidden="true"
        width={tamanho}
        height={tamanho}
        style={{ width: tamanho, height: "auto" }}
        className={`shrink-0 select-none drop-shadow-sm ${troca ? (nega ? "juca-nega" : "juca-troca") : ""}`}
      />

      {fala && bolhaPara === "direita" && <Bolha texto={fala} ponta="esquerda" chave={troca} />}
    </div>
  );
}

function Bolha({
  texto,
  ponta,
  chave,
}: {
  texto: string;
  ponta: "esquerda" | "direita";
  chave: number;
}) {
  return (
    <div
      key={chave}
      className="bolha relative max-w-[190px] rounded-[14px] border border-linha bg-white px-3 py-2 text-[13px] leading-snug font-medium text-tinta shadow-sm"
    >
      {texto}
      <span
        aria-hidden="true"
        className={`absolute bottom-3 h-3 w-3 rotate-45 border-linha bg-white ${
          ponta === "direita"
            ? "-right-1.5 border-t border-r"
            : "-left-1.5 border-b border-l"
        }`}
      />
    </div>
  );
}
