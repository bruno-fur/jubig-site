"use client";

import { Juca } from "./juca/Juca";
import { ROTULO_TURNO, type Turno, type VagaEsporte } from "@/tipos/db";

/**
 * Modalidades agrupadas por turno.
 *
 * Caixas de seleção, não rádios: dá para pegar mais de uma modalidade no mesmo
 * turno. Quem decide quantas é `eventos.max_esportes_por_turno` — 0 é sem
 * limite. A tela avisa quando o limite chega; quem recusa de verdade é o
 * trigger do banco, que segura a linha da modalidade até o commit.
 *
 * Vaga esgotada desabilita a opção, mas a contagem na tela pode estar velha —
 * duas caravanas preenchendo ao mesmo tempo veem a mesma. O banco, não.
 */
export function EscolhaEsportes({
  titulo,
  grupos,
  escolhidos,
  deBoa,
  erro,
  maxPorTurno = 0,
  aoEscolher,
  aoMarcarDeBoa,
}: {
  titulo: string;
  grupos: [Turno, VagaEsporte[]][];
  escolhidos: string[];
  deBoa: boolean;
  erro?: string;
  maxPorTurno?: number;
  aoEscolher: (ids: string[]) => void;
  aoMarcarDeBoa: (v: boolean) => void;
}) {
  function alternar(id: string) {
    aoEscolher(
      escolhidos.includes(id) ? escolhidos.filter((x) => x !== id) : [...escolhidos, id]
    );
  }

  const quantosNoTurno = (lista: VagaEsporte[]) =>
    lista.filter((e) => escolhidos.includes(e.esporte_id)).length;

  return (
    <fieldset className={`cartao p-5 ${erro ? "border-ruim" : ""}`}>
      <legend className="titulo px-1 text-lg">{titulo}</legend>

      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[10px] bg-areia p-3">
        <input
          type="checkbox"
          checked={deBoa}
          onChange={(e) => aoMarcarDeBoa(e.target.checked)}
          className="h-5 w-5 accent-[#D94C1A]"
        />
        <span className="text-sm font-semibold text-tinta">
          Vou só de boa — não quero competir
        </span>
      </label>

      <div className={deBoa ? "pointer-events-none mt-4 space-y-5 opacity-40" : "mt-4 space-y-5"}>
        {grupos.map(([turno, lista]) => {
          const marcadas = quantosNoTurno(lista);
          const noLimite = maxPorTurno > 0 && marcadas >= maxPorTurno;

          return (
            <div key={turno}>
              <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-apagado">
                {ROTULO_TURNO[turno]}
                <span className="font-normal">
                  {maxPorTurno > 0
                    ? `· até ${maxPorTurno} ${maxPorTurno === 1 ? "modalidade" : "modalidades"}`
                    : "· quantas quiser"}
                </span>
                {marcadas > 0 && (
                  <span className="font-normal text-laranja-escuro">
                    · {marcadas} escolhida{marcadas > 1 ? "s" : ""}
                  </span>
                )}
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {lista.map((e) => {
                  const lotada = e.restantes <= 0;
                  const marcado = escolhidos.includes(e.esporte_id);
                  // No limite, as não marcadas travam — mas dá para desmarcar.
                  const travada = lotada || (noLimite && !marcado);

                  return (
                    <label
                      key={e.esporte_id}
                      className={`flex items-center gap-3 rounded-[10px] border-2 p-3 text-sm ${
                        travada
                          ? "cursor-not-allowed border-linha bg-areia/50 text-apagado"
                          : marcado
                            ? "cursor-pointer border-laranja bg-laranja/10"
                            : "cursor-pointer border-linha hover:border-laranja/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={travada || deBoa}
                        checked={marcado}
                        onChange={() => alternar(e.esporte_id)}
                        className="h-4 w-4 accent-[#D94C1A]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-tinta">{e.nome}</span>
                        <span className="block text-xs text-apagado">
                          {lotada
                            ? "Lotada"
                            : e.restantes <= 5
                              ? `Restam ${e.restantes}`
                              : `${e.restantes} vagas`}
                          {e.por_equipe && " · por equipe"}
                        </span>
                      </span>
                      {lotada && (
                        <img src="/juca/choro.webp" alt="" className="h-8 w-8 object-contain" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {erro && (
        <div className="mt-4 flex items-center gap-2">
          <Juca estado="invalido" tamanho={44} />
          <p role="alert" className="text-sm font-medium text-ruim">
            {erro}
          </p>
        </div>
      )}
    </fieldset>
  );
}
