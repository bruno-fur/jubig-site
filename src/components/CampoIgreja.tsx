"use client";

import { useId, useMemo } from "react";
import Link from "next/link";
import { AncoraJuca } from "./juca/Ancora";
import { useJuca } from "./juca/contexto";
import type { OpcaoIgreja } from "@/tipos/db";

/**
 * Igreja escolhida da lista, nunca digitada.
 *
 * Com texto livre a mesma igreja chegava escrita de vários jeitos ("PIB
 * Toledo", "Primeira Igreja Batista de Toledo") e o painel contava igrejas
 * diferentes. `<select>` nativo de propósito: no celular abre o seletor do
 * sistema, que rola bem com muitas opções e não briga com o teclado.
 */
export function CampoIgreja({
  igrejas,
  valor,
  aoMudar,
  erro,
  rotulo = "Igreja",
  fala,
}: {
  igrejas: OpcaoIgreja[];
  valor: string;
  aoMudar: (id: string) => void;
  erro?: string | null;
  rotulo?: string;
  fala?: string;
}) {
  const id = useId();
  const { focar, desfocar } = useJuca();

  // Agrupada por cidade: "Primeira Igreja Batista" existe em várias.
  const porCidade = useMemo(() => {
    const mapa = new Map<string, OpcaoIgreja[]>();
    const ordenadas = [...igrejas].sort(
      (a, b) => a.cidade.localeCompare(b.cidade, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")
    );
    for (const i of ordenadas) mapa.set(i.cidade, [...(mapa.get(i.cidade) ?? []), i]);
    return [...mapa.entries()];
  }, [igrejas]);

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-tinta">
        {rotulo}
        <span className="ml-1 text-laranja">*</span>
      </label>

      <AncoraJuca
        campoId={id}
        estado={valor ? "valido" : "digitando"}
        fala={fala ?? (valor ? "Anotado!" : "Escolha na lista.")}
        erro={erro}
      />

      <select
        id={id}
        value={valor}
        aria-invalid={Boolean(erro)}
        aria-describedby={`${id}-${erro ? "erro" : "dica"}`}
        onFocus={() => focar(id)}
        onBlur={() => desfocar(id)}
        onChange={(e) => aoMudar(e.target.value)}
        className={`campo-texto ${erro ? "border-ruim focus:border-ruim" : ""}`}
      >
        <option value="">Escolha a igreja</option>
        {porCidade.map(([cidade, lista]) => (
          <optgroup key={cidade} label={cidade}>
            {lista.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-sm font-medium text-ruim">
          {erro}
        </p>
      ) : (
        <p id={`${id}-dica`} className="mt-1.5 text-sm text-apagado">
          Sua igreja não está na lista?{" "}
          <Link href="/#contato" className="font-semibold text-laranja-escuro hover:underline">
            Fale com a diretoria
          </Link>{" "}
          para cadastrar.
        </p>
      )}
    </div>
  );
}
