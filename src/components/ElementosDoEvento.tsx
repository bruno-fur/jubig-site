import type { TipoEvento } from "@/tipos/db";

/**
 * Elementos soltos no fundo do topo, conforme o tipo do evento.
 *
 * JubigDay é dia de quadra: bola de futebol, vôlei, basquete, peça de xadrez e
 * raquete de tênis de mesa dizem isso antes de qualquer texto. Congresso e
 * tour ganham os seus.
 *
 * Desenhados aqui em SVG, não baixados: são poucos traços, entram junto com o
 * HTML e não custam nenhuma requisição. Ficam atrás do conteúdo, com opacidade
 * baixa, e somem para leitor de tela — são enfeite, não informação.
 */
export function ElementosDoEvento({ tipo }: { tipo: TipoEvento }) {
  const figuras = FIGURAS[tipo];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {figuras.map((f, i) => (
        <span
          key={i}
          className={`absolute text-tinta/[0.07] ${f.classe}`}
          style={{ animationDelay: `${i * -1.7}s` }}
        >
          {f.desenho}
        </span>
      ))}
    </div>
  );
}

const bola = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-full w-full">
    <circle cx="32" cy="32" r="28" />
    <path d="M32 12l10 7-4 12H26l-4-12 10-7z" fill="currentColor" stroke="none" opacity=".5" />
    <path d="M32 12V4M42 19l9-5M38 31l9 8M26 31l-9 8M22 19l-9-5M26 43l-3 11M38 43l3 11" />
  </svg>
);

const volei = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-full w-full">
    <circle cx="32" cy="32" r="28" />
    <path d="M32 4c-8 9-11 19-9 28M32 60c8-9 11-19 9-28M4 32c11-4 22-3 30 3M60 32c-11-4-22-3-30 3" />
  </svg>
);

const basquete = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-full w-full">
    <circle cx="32" cy="32" r="28" />
    <path d="M32 4v56M4 32h56M12 12c12 10 12 30 0 40M52 12c-12 10-12 30 0 40" />
  </svg>
);

const xadrez = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-full w-full">
    <path d="M24 56h16l2-10H22l2 10zM26 46c0-8 10-9 10-18a5 5 0 10-10 0c0 4 3 5 3 9s-3 5-3 9z" />
    <path d="M20 60h24" />
  </svg>
);

const raquete = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-full w-full">
    <circle cx="26" cy="26" r="16" />
    <path d="M37 37l14 14M49 49l4 4" />
    <circle cx="50" cy="20" r="5" />
  </svg>
);

const nota = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-full w-full">
    <path d="M24 46V14l24-6v32" />
    <circle cx="18" cy="48" r="7" />
    <circle cx="42" cy="42" r="7" />
  </svg>
);

const igreja = (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-full w-full">
    <path d="M32 4v12M26 10h12M12 56V28l20-12 20 12v28z" />
    <path d="M26 56V42h12v14" />
  </svg>
);

type Figura = { desenho: React.ReactNode; classe: string };

const FIGURAS: Record<TipoEvento, Figura[]> = {
  jubigday: [
    { desenho: bola, classe: "flutua top-8 left-[6%] h-20 w-20 lg:h-28 lg:w-28" },
    { desenho: volei, classe: "flutua top-1/2 right-[4%] h-16 w-16 lg:h-24 lg:w-24" },
    { desenho: basquete, classe: "flutua bottom-6 left-[22%] h-14 w-14 lg:h-20 lg:w-20" },
    { desenho: xadrez, classe: "flutua top-10 right-[28%] hidden h-16 w-16 lg:block lg:h-24 lg:w-24" },
    { desenho: raquete, classe: "flutua bottom-10 right-[18%] hidden h-14 w-14 sm:block lg:h-20 lg:w-20" },
  ],
  congresso: [
    { desenho: nota, classe: "flutua top-10 left-[7%] h-16 w-16 lg:h-24 lg:w-24" },
    { desenho: nota, classe: "flutua bottom-8 right-[8%] h-14 w-14 lg:h-20 lg:w-20" },
    { desenho: igreja, classe: "flutua top-1/3 right-[26%] hidden h-16 w-16 lg:block lg:h-24 lg:w-24" },
  ],
  tour: [
    { desenho: igreja, classe: "flutua top-8 left-[8%] h-20 w-20 lg:h-28 lg:w-28" },
    { desenho: nota, classe: "flutua bottom-10 right-[10%] h-14 w-14 lg:h-20 lg:w-20" },
  ],
};
