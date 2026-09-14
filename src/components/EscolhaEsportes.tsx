"use client";

import { Juca } from "./juca/Juca";
import { NOTAS, ehOficina, parceirosNecessarios, precisaNota, rotuloModalidades } from "@/lib/modalidades";
import { ROTULO_FORMATO, ROTULO_TURNO, type DetalheEscolha, type Turno, type VagaEsporte } from "@/tipos/db";

/**
 * Modalidades agrupadas por turno — esportes e oficinas.
 *
 * Esporte: caixas de seleção, dá para pegar mais de um no mesmo turno até
 * `eventos.max_esportes_por_turno` (0 = sem limite). Ao marcar, pede o que o
 * formato exige: nota de habilidade (time sorteado) ou o nome dos parceiros
 * (dupla, trio).
 *
 * Oficina: uma por turno, como um rádio — marcar outra no mesmo turno troca a
 * anterior. Ninguém assiste dois estudos ao mesmo tempo.
 *
 * A tela avisa; quem recusa de verdade é o trigger do banco, que segura a
 * linha da modalidade até o commit.
 */
export function EscolhaEsportes({
  titulo,
  grupos,
  escolhidos,
  detalhes = {},
  deBoa,
  erro,
  maxPorTurno = 0,
  aoEscolher,
  aoDetalhar,
  aoMarcarDeBoa,
}: {
  titulo: string;
  grupos: [Turno, VagaEsporte[]][];
  escolhidos: string[];
  detalhes?: Record<string, DetalheEscolha>;
  deBoa: boolean;
  erro?: string;
  maxPorTurno?: number;
  aoEscolher: (ids: string[]) => void;
  aoDetalhar?: (id: string, detalhe: DetalheEscolha) => void;
  aoMarcarDeBoa: (v: boolean) => void;
}) {
  const rotulo = rotuloModalidades(grupos.flatMap(([, lista]) => lista));

  function alternar(e: VagaEsporte, lista: VagaEsporte[]) {
    const id = e.esporte_id;
    if (escolhidos.includes(id)) {
      aoEscolher(escolhidos.filter((x) => x !== id));
      return;
    }
    if (ehOficina(e)) {
      const outras = new Set(lista.filter(ehOficina).map((o) => o.esporte_id));
      aoEscolher([...escolhidos.filter((x) => !outras.has(x)), id]);
      return;
    }
    aoEscolher([...escolhidos, id]);
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
        <span className="text-sm font-semibold text-tinta">{rotulo.deBoa}</span>
      </label>

      <div className={deBoa ? "pointer-events-none mt-4 space-y-5 opacity-40" : "mt-4 space-y-5"}>
        {grupos.map(([turno, lista]) => {
          const esportesDoTurno = lista.filter((e) => !ehOficina(e));
          const temOficina = lista.some(ehOficina);
          const marcadosEsporte = esportesDoTurno.filter((e) => escolhidos.includes(e.esporte_id)).length;
          const noLimite = maxPorTurno > 0 && marcadosEsporte >= maxPorTurno;

          return (
            <div key={turno}>
              <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-apagado">
                {ROTULO_TURNO[turno]}
                <span className="font-normal">
                  {temOficina && esportesDoTurno.length === 0
                    ? "· uma oficina"
                    : maxPorTurno > 0
                      ? `· até ${maxPorTurno} ${maxPorTurno === 1 ? "esporte" : "esportes"}`
                      : "· quantos quiser"}
                </span>
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {lista.map((e) => {
                  const lotada = e.restantes <= 0;
                  const marcado = escolhidos.includes(e.esporte_id);
                  const oficina = ehOficina(e);
                  // No limite, os esportes não marcados travam — mas dá para desmarcar.
                  const travada = lotada || (!oficina && noLimite && !marcado);
                  const formato = e.formato ?? "individual";

                  return (
                    <div
                      key={e.esporte_id}
                      className={`rounded-[10px] border-2 text-sm ${
                        travada
                          ? "border-linha bg-areia/50 text-apagado"
                          : marcado
                            ? "border-laranja bg-laranja/10"
                            : "border-linha hover:border-laranja/60"
                      }`}
                    >
                      <label className={`flex items-center gap-3 p-3 ${travada ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type={oficina ? "radio" : "checkbox"}
                          name={oficina ? `oficina-${titulo}-${turno}` : undefined}
                          disabled={travada || deBoa}
                          checked={marcado}
                          onClick={() => {
                            // Rádio não desmarca sozinho: clicar de novo na mesma oficina desfaz.
                            if (oficina && marcado) alternar(e, lista);
                          }}
                          onChange={() => {
                            if (!(oficina && marcado)) alternar(e, lista);
                          }}
                          className="h-4 w-4 accent-[#D94C1A]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-tinta">{e.nome}</span>
                          {oficina && e.responsavel && (
                            <span className="block text-xs text-tinta/80">com {e.responsavel}</span>
                          )}
                          {e.descricao && <span className="block text-xs text-apagado">{e.descricao}</span>}
                          <span className="block text-xs text-apagado">
                            {lotada ? "Lotada" : e.restantes <= 5 ? `Restam ${e.restantes}` : `${e.restantes} vagas`}
                            {!oficina && formato !== "individual" && ` · ${ROTULO_FORMATO[formato].toLowerCase()}`}
                          </span>
                        </span>
                        {lotada && <img src="/juca/choro.webp" alt="" className="h-8 w-8 object-contain" />}
                      </label>

                      {marcado && !deBoa && (
                        <DetalheDaEscolha
                          esporte={e}
                          detalhe={detalhes[e.esporte_id]}
                          aoMudar={(d) => aoDetalhar?.(e.esporte_id, d)}
                        />
                      )}
                    </div>
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

/** Nota de habilidade ou nomes dos parceiros, logo abaixo da modalidade marcada. */
function DetalheDaEscolha({
  esporte,
  detalhe,
  aoMudar,
}: {
  esporte: VagaEsporte;
  detalhe?: DetalheEscolha;
  aoMudar: (d: DetalheEscolha) => void;
}) {
  const parceiros = parceirosNecessarios(esporte);

  if (precisaNota(esporte)) {
    return (
      <div className="border-t border-laranja/30 px-3 pt-2 pb-3">
        <p id={`nota-${esporte.esporte_id}`} className="text-xs font-semibold text-tinta">
          Quanto você joga? Os times são sorteados equilibrando as notas.
        </p>
        <div role="radiogroup" aria-labelledby={`nota-${esporte.esporte_id}`} className="mt-2 grid grid-cols-5 gap-1">
          {NOTAS.map(([n, texto]) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={detalhe?.nota === n}
              onClick={() => aoMudar({ ...detalhe, nota: n })}
              className={`rounded-[8px] border-2 px-1 py-1.5 text-center leading-tight ${
                detalhe?.nota === n ? "border-laranja bg-laranja text-white" : "border-linha bg-white text-tinta"
              }`}
            >
              <span className="titulo block text-base">{n}</span>
              <span className="block text-[10px]">{texto}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (parceiros > 0) {
    const nomes = detalhe?.parceiros ?? [];
    return (
      <div className="space-y-1.5 border-t border-laranja/30 px-3 pt-2 pb-3">
        <p className="text-xs font-semibold text-tinta">
          {parceiros === 1 ? "Quem é a sua dupla?" : "Quem joga com você no trio?"}
        </p>
        {Array.from({ length: parceiros }, (_, k) => (
          <input
            key={k}
            value={nomes[k] ?? ""}
            onChange={(ev) => {
              const novos = [...nomes];
              novos[k] = ev.target.value;
              aoMudar({ ...detalhe, parceiros: novos });
            }}
            placeholder={parceiros === 1 ? "Nome completo da dupla" : `Nome completo do parceiro ${k + 1}`}
            aria-label={parceiros === 1 ? "Nome da dupla" : `Parceiro ${k + 1}`}
            maxLength={80}
            className="campo-texto bg-white py-2 text-sm"
          />
        ))}
        <p className="text-[11px] text-apagado">Cada um do grupo faz a própria inscrição.</p>
      </div>
    );
  }

  return null;
}
