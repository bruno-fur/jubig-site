import { nomeDaEquipe, ordenarPlacar, textoSobre } from "@/lib/equipes";
import type { LinhaPlacar } from "@/tipos/db";

/**
 * Placar das equipes na página do evento — no dia, a galera acompanha pelo
 * celular. Só aparece depois do primeiro ponto: antes disso, quatro zeros
 * não dizem nada.
 */
export function PlacarPublico({ linhas }: { linhas: LinhaPlacar[] }) {
  if (!linhas.some((l) => l.pontos !== 0)) return null;
  const { ordem, lider } = ordenarPlacar(linhas);

  return (
    <section aria-labelledby="titulo-placar" className="mb-8">
      <h2 id="titulo-placar" className="titulo mb-3 text-xl">
        Placar das equipes
        {lider && <span className="text-apagado"> · {nomeDaEquipe(lider.nome)} na frente</span>}
      </h2>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ordem.map((l) => (
          <li
            key={l.equipe_id}
            className="rounded-[16px] p-4 ring-1 ring-tinta/10"
            style={{ background: l.cor, color: textoSobre(l.cor) }}
          >
            <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{l.posicao}º lugar</p>
            <p className="titulo text-lg leading-tight">{l.nome}</p>
            <p className="titulo mt-1 text-3xl tabular-nums">
              {l.pontos}
              <span className="ml-1 text-sm font-semibold opacity-80">pts</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
