"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NOTAS } from "@/lib/modalidades";
import { ROTULO_STATUS, type FormatoModalidade, type StatusInscricao } from "@/tipos/db";

export type Participante = {
  nome: string;
  igreja: string;
  codigo: string;
  status: StatusInscricao;
  nota: number | null;
  parceiros: string[];
};

const normal = (t: string) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const ROTULO_NOTA = Object.fromEntries(NOTAS);

/**
 * Sorteio equilibrado ("serpentina"): embaralha, ordena pela nota e distribui
 * ida e volta — 1º no time A, 2º no B, ..., último no último time, e o próximo
 * volta para o último. Assim o time A não fica com todos os melhores.
 *
 * O embaralhar vem antes de ordenar: entre notas iguais, a ordem é sorteio de
 * verdade, e cada clique em "Sortear de novo" dá times diferentes.
 */
function sortearTimes(pessoas: Participante[], quantidade: number): Participante[][] {
  const embaralhadas = [...pessoas];
  for (let i = embaralhadas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [embaralhadas[i], embaralhadas[j]] = [embaralhadas[j], embaralhadas[i]];
  }
  embaralhadas.sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));

  const times: Participante[][] = Array.from({ length: quantidade }, () => []);
  embaralhadas.forEach((p, i) => {
    const volta = Math.floor(i / quantidade) % 2 === 1;
    const posicao = i % quantidade;
    times[volta ? quantidade - 1 - posicao : posicao].push(p);
  });
  return times;
}

export function Participantes({
  formato,
  participantes,
}: {
  formato: FormatoModalidade;
  participantes: Participante[];
}) {
  const [soConfirmadas, setSoConfirmadas] = useState(false);
  const lista = useMemo(
    () => (soConfirmadas ? participantes.filter((p) => p.status === "confirmada") : participantes),
    [participantes, soConfirmadas]
  );
  const confirmadas = participantes.filter((p) => p.status === "confirmada").length;

  // Para a dupla/trio: o parceiro escrito também se inscreveu?
  const inscritosPorNome = useMemo(() => new Set(participantes.map((p) => normal(p.nome))), [participantes]);

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm text-tinta print:hidden">
        <input
          type="checkbox"
          checked={soConfirmadas}
          onChange={(e) => setSoConfirmadas(e.target.checked)}
          className="h-4 w-4 accent-[#D94C1A]"
        />
        Só inscrições confirmadas (pagas) — {confirmadas} de {participantes.length}
      </label>

      {formato === "time_sorteado" && <Sorteio pessoas={lista} />}

      <section className="cartao overflow-hidden">
        <h3 className="titulo border-b border-linha p-4 text-lg">
          {lista.length} {lista.length === 1 ? "inscrito" : "inscritos"}
        </h3>
        {lista.length === 0 ? (
          <p className="p-5 text-apagado">Ninguém por aqui ainda.</p>
        ) : (
          <ul className="divide-y divide-linha">
            {lista.map((p) => (
              <li key={p.codigo + p.nome} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-tinta">{p.nome}</p>
                  <p className="text-xs text-apagado">{p.igreja}</p>
                  {p.parceiros.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {p.parceiros.map((nome) => {
                        const achou = inscritosPorNome.has(normal(nome));
                        return (
                          <li key={nome} className="text-xs">
                            <span className="text-tinta">com {nome}</span>{" "}
                            <span className={achou ? "text-ok" : "text-laranja-escuro"}>
                              {achou ? "· também inscrito aqui" : "· não achamos inscrição com esse nome"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {p.nota && (
                    <p className="font-semibold text-tinta">
                      nota {p.nota} <span className="font-normal text-apagado">· {ROTULO_NOTA[p.nota]}</span>
                    </p>
                  )}
                  <Link href={`/diretoria/inscricoes/${p.codigo}`} className="font-mono text-xs text-apagado hover:underline">
                    {p.codigo} · {ROTULO_STATUS[p.status]}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Sorteio({ pessoas }: { pessoas: Participante[] }) {
  const [quantidade, setQuantidade] = useState(2);
  const [times, setTimes] = useState<Participante[][] | null>(null);
  const semNota = pessoas.filter((p) => !p.nota).length;

  return (
    <section className="cartao p-5">
      <h3 className="titulo text-lg print:hidden">Sortear times</h3>
      <p className="mt-1 text-sm text-apagado print:hidden">
        Distribui equilibrando as notas de habilidade. Nada é salvo: sorteie, confira e imprima.
        {semNota > 0 && ` ${semNota} sem nota (inscritos antes da nota existir) entram como nota 0.`}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3 print:hidden">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-tinta">Quantos times</span>
          <input
            type="number"
            min={2}
            max={Math.max(2, pessoas.length)}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(2, Number(e.target.value) || 2))}
            className="campo-texto w-28"
          />
        </label>
        <button
          type="button"
          disabled={pessoas.length < quantidade}
          onClick={() => setTimes(sortearTimes(pessoas, quantidade))}
          className="botao-primario"
        >
          {times ? "Sortear de novo" : "Sortear"}
        </button>
        {times && (
          <button type="button" onClick={() => window.print()} className="botao-secundario">
            Imprimir
          </button>
        )}
        <span className="text-sm text-apagado">
          {pessoas.length} pessoas · ~{Math.floor(pessoas.length / quantidade)} por time
        </span>
      </div>

      {times && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {times.map((time, i) => {
            const soma = time.reduce((t, p) => t + (p.nota ?? 0), 0);
            return (
              <div key={i} className="rounded-[10px] border-2 border-linha p-3 break-inside-avoid">
                <p className="titulo flex items-baseline justify-between">
                  Time {String.fromCharCode(65 + i)}
                  <span className="text-xs font-normal text-apagado">
                    média {(soma / Math.max(time.length, 1)).toFixed(1)}
                  </span>
                </p>
                <ol className="mt-2 space-y-1 text-sm">
                  {time.map((p) => (
                    <li key={p.codigo + p.nome} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate text-tinta">{p.nome}</span>
                      <span className="shrink-0 text-apagado">{p.nota ?? "–"}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
