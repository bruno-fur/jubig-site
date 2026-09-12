"use client";

import { useId } from "react";
import { Juca } from "./juca/Juca";
import type { VagaEsporte } from "@/tipos/db";

/**
 * Modalidades agrupadas por horário.
 *
 * O conflito de horário não é validado depois: dentro de um horário só existe
 * uma escolha possível, porque cada grupo é um conjunto de rádios. Não dá para
 * marcar duas coisas no mesmo horário nem sem querer.
 *
 * Vaga esgotada desabilita a opção — mas quem decide de verdade é o trigger do
 * banco, que segura a linha da modalidade até o commit. A tela pode estar
 * desatualizada; o banco, não.
 */
export function EscolhaEsportes({
  titulo,
  grupos,
  escolhidos,
  deBoa,
  erro,
  aoEscolher,
  aoMarcarDeBoa,
}: {
  titulo: string;
  grupos: [string, VagaEsporte[]][];
  escolhidos: string[];
  deBoa: boolean;
  erro?: string;
  aoEscolher: (ids: string[]) => void;
  aoMarcarDeBoa: (v: boolean) => void;
}) {
  const grupo = useId();

  function trocar(horario: string, id: string) {
    const doHorario = new Set(
      grupos.find(([h]) => h === horario)?.[1].map((e) => e.esporte_id) ?? []
    );
    // Tira o que já estava marcado neste horário e põe o novo.
    const resto = escolhidos.filter((x) => !doHorario.has(x));
    aoEscolher(escolhidos.includes(id) ? resto : [...resto, id]);
  }

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
        {grupos.map(([horario, lista]) => (
          <div key={horario}>
            <p className="mb-2 text-sm font-semibold text-apagado">
              {horario} <span className="font-normal">· escolha uma</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {lista.map((e) => {
                const lotada = e.restantes <= 0;
                const marcado = escolhidos.includes(e.esporte_id);
                return (
                  <label
                    key={e.esporte_id}
                    className={`flex items-center gap-3 rounded-[10px] border-2 p-3 text-sm ${
                      lotada
                        ? "cursor-not-allowed border-linha bg-areia/50 text-apagado"
                        : marcado
                          ? "cursor-pointer border-laranja bg-laranja/10"
                          : "cursor-pointer border-linha hover:border-laranja/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${grupo}-${horario}`}
                      disabled={lotada || deBoa}
                      checked={marcado}
                      onChange={() => trocar(horario, e.esporte_id)}
                      onClick={() => marcado && trocar(horario, e.esporte_id)}
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
        ))}
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
