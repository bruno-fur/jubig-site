"use client";

import { useMemo, useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { CORES_PULSEIRA, nomeDaEquipe, ordenarPlacar, textoSobre } from "@/lib/equipes";
import type { Equipe, LinhaPlacar, PontoEquipe, TipoEvento } from "@/tipos/db";

export type PessoaEquipe = {
  id: string;
  nome: string;
  igreja: string;
  equipe_id: string | null;
  checkin_em: string | null;
};

const MENSAGEM: Record<string, string> = {
  ja_tem_equipes: "Esse evento já tem equipes. Edite as que existem.",
  equipe_de_outro_evento: "Essa equipe é de outro evento.",
  sem_permissao: "Só a diretoria mexe nas pulseiras.",
  pedido_invalido: "Confira os campos.",
  falha_ao_gravar: "Não deu para salvar agora.",
};

const PONTOS_RAPIDOS = [1, 3, 5, 10];

const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Pulseiras: equipes por cor, placar e quem está em cada uma.
 *
 * Ordem da tela = ordem do trabalho: sorteio e quem está em cada equipe em
 * cima, placar no meio (é o que se usa durante o dia), nome e cor no fim.
 */
export function Pulseiras({
  evento,
  equipes,
  placar,
  pontos,
  pessoas,
}: {
  evento: { id: string; nome: string; tipo: TipoEvento };
  equipes: Equipe[];
  placar: LinhaPlacar[];
  pontos: PontoEquipe[];
  pessoas: PessoaEquipe[];
}) {
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo." });
  const enviar = (corpo: Record<string, unknown>) => acao.json("/api/admin/equipes", "POST", corpo);
  const porId = useMemo(() => new Map(equipes.map((e) => [e.id, e])), [equipes]);

  if (equipes.length === 0) {
    return (
      <section className="cartao space-y-3 p-6">
        <h2 className="titulo text-xl">Nenhuma equipe em {evento.nome}</h2>
        <p className="text-apagado">
          {evento.tipo === "jubigday"
            ? "Crie as equipes com o nome e a cor das pulseiras que vocês compraram. Depois, um sorteio divide todos os confirmados por igual entre elas."
            : "Crie as equipes para a gincana e sorteie quem já está inscrito."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={acao.ocupado}
            onClick={() => enviar({ acao: "criar_padrao", eventoId: evento.id })}
            className="botao-primario"
          >
            {acao.ocupado && <Girando />}
            Criar as 4 de sempre
          </button>
          <span className="flex gap-1.5" aria-hidden="true">
            {["#1E63C6", "#C62828", "#2E7D32", "#F2B705"].map((c) => (
              <span key={c} className="h-5 w-5 rounded-full" style={{ background: c }} />
            ))}
          </span>
          <span className="text-sm text-apagado">Azul, Vermelha, Verde e Amarela — dá para trocar depois.</span>
        </div>
        <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
      <Pessoas
        eventoId={evento.id}
        pessoas={pessoas}
        equipes={equipes}
        porId={porId}
        ocupado={acao.ocupado}
        enviar={enviar}
      />
      <Placar placar={placar} pontos={pontos} porId={porId} ocupado={acao.ocupado} enviar={enviar} />
      <Configurar eventoId={evento.id} equipes={equipes} placar={placar} ocupado={acao.ocupado} enviar={enviar} />
    </div>
  );
}

type Enviar = (corpo: Record<string, unknown>) => Promise<{ ok: boolean; dados: Record<string, unknown> }>;

// ---------------------------------------------------------------- Placar

function Placar({
  placar,
  pontos,
  porId,
  ocupado,
  enviar,
}: {
  placar: LinhaPlacar[];
  pontos: PontoEquipe[];
  porId: Map<string, Equipe>;
  ocupado: boolean;
  enviar: Enviar;
}) {
  const { ordem, lider, empate } = ordenarPlacar(placar);
  const [equipeId, setEquipeId] = useState(ordem[0]?.equipe_id ?? "");
  const [motivo, setMotivo] = useState("");
  const [outro, setOutro] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  async function pontuar(valor: number) {
    if (!equipeId || !valor) return;
    const { ok } = await enviar({ acao: "pontuar", equipeId, valor, motivo: motivo || null });
    if (ok) setOutro("");
  }

  return (
    <section aria-labelledby="titulo-placar" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-placar" className="titulo text-2xl">
          Placar
        </h2>
        <p className="text-sm text-apagado">
          {lider
            ? `${nomeDaEquipe(lider.nome)} na frente`
            : empate
              ? "Empate na liderança"
              : "Ninguém pontuou ainda"}
        </p>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ordem.map((l) => (
          <li
            key={l.equipe_id}
            className="rounded-[16px] p-4 shadow-sm ring-1 ring-tinta/10"
            style={{ background: l.cor, color: textoSobre(l.cor) }}
          >
            <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
              {l.posicao}º {lider?.equipe_id === l.equipe_id && "· na frente"}
            </p>
            <p className="titulo text-xl">{nomeDaEquipe(l.nome)}</p>
            <p className="titulo mt-1 text-4xl tabular-nums">{l.pontos}</p>
            <p className="text-sm opacity-80">
              {l.pessoas} {l.pessoas === 1 ? "pessoa" : "pessoas"}
            </p>
          </li>
        ))}
      </ol>

      {/* Lançar ponto: na quadra, com uma mão só — equipe, motivo e um toque. */}
      <div className="cartao space-y-3 p-4">
        <p className="font-semibold text-tinta">Lançar pontos</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Equipe">
          {ordem.map((l) => (
            <button
              key={l.equipe_id}
              type="button"
              role="radio"
              aria-checked={equipeId === l.equipe_id}
              onClick={() => setEquipeId(l.equipe_id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-offset-2 ${
                equipeId === l.equipe_id ? "ring-2 ring-tinta" : "opacity-70"
              }`}
              style={{ background: l.cor, color: textoSobre(l.cor) }}
            >
              {l.nome}
            </button>
          ))}
        </div>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={80}
          placeholder="Motivo (ex.: 1º lugar no vôlei)"
          aria-label="Motivo"
          className="campo-texto w-full"
        />
        <div className="flex flex-wrap items-center gap-2">
          {PONTOS_RAPIDOS.map((v) => (
            <button
              key={v}
              type="button"
              disabled={ocupado || !equipeId}
              onClick={() => pontuar(v)}
              className="botao-primario px-4 py-2 tabular-nums"
            >
              +{v}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void pontuar(Number(outro));
            }}
            className="flex gap-2"
          >
            <input
              type="number"
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
              placeholder="outro"
              aria-label="Outro valor (negativo desconta)"
              className="campo-texto w-24"
            />
            <button type="submit" disabled={ocupado || !outro || Number(outro) === 0} className="botao-secundario px-3 py-2">
              Lançar
            </button>
          </form>
        </div>
        <p className="text-xs text-apagado">Valor negativo desconta (ex.: -2 por falta).</p>
      </div>

      {pontos.length > 0 && (
        <div className="cartao">
          <p className="border-b border-linha px-4 py-3 font-semibold text-tinta">Lançamentos</p>
          <ul className="divide-y divide-linha">
            {(verTodos ? pontos : pontos.slice(0, 8)).map((p) => {
              const e = porId.get(p.equipe_id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-tinta/20" style={{ background: e?.cor }} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-tinta">
                      {e?.nome} {p.valor > 0 ? `+${p.valor}` : p.valor}
                    </span>
                    {p.motivo && <span className="text-apagado"> · {p.motivo}</span>}
                    <span className="block text-xs text-apagado">{hora(p.criado_em)}</span>
                  </span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => enviar({ acao: "apagar_ponto", id: p.id })}
                    className="font-semibold text-ruim hover:underline disabled:opacity-40"
                  >
                    Apagar
                  </button>
                </li>
              );
            })}
          </ul>
          {pontos.length > 8 && (
            <button
              type="button"
              onClick={() => setVerTodos((v) => !v)}
              className="w-full border-t border-linha px-4 py-2 text-sm font-semibold text-laranja-escuro hover:underline"
            >
              {verTodos ? "Mostrar menos" : `Ver todos os ${pontos.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Pessoas

/**
 * Quantas pessoas precisam trocar para as equipes ficarem iguais (diferença
 * de no máximo 1). As maiores ficam com a sobra da divisão — é o mínimo de
 * trocas, o mesmo que `equilibrar_equipes` faz no banco.
 */
function trocasParaEquilibrar(contagens: number[]) {
  const total = contagens.reduce((a, b) => a + b, 0);
  const k = contagens.length;
  if (k === 0) return 0;
  const base = Math.floor(total / k);
  let sobra = total % k;
  return [...contagens]
    .sort((a, b) => b - a)
    .reduce((soma, c) => {
      const alvo = base + (sobra > 0 ? 1 : 0);
      if (sobra > 0) sobra--;
      return soma + Math.max(0, c - alvo);
    }, 0);
}

function Pessoas({
  eventoId,
  pessoas,
  equipes,
  porId,
  ocupado,
  enviar,
}: {
  eventoId: string;
  pessoas: PessoaEquipe[];
  equipes: Equipe[];
  porId: Map<string, Equipe>;
  ocupado: boolean;
  enviar: Enviar;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("todas"); // "todas" | "sem" | id da equipe
  const [soPresentes, setSoPresentes] = useState(false);
  const [refazendo, setRefazendo] = useState(false);

  const semEquipe = pessoas.filter((p) => !p.equipe_id).length;
  const comEquipe = pessoas.length - semEquipe;
  const presentes = pessoas.filter((p) => p.checkin_em).length;
  const porEquipe = equipes.map((e) => ({ ...e, pessoas: pessoas.filter((p) => p.equipe_id === e.id).length }));
  const contagens = porEquipe.map((e) => e.pessoas);
  const diferenca = contagens.length ? Math.max(...contagens) - Math.min(...contagens) : 0;
  const trocas = trocasParaEquilibrar(contagens);
  const cadaUma = equipes.length ? Math.floor(pessoas.length / equipes.length) : 0;

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = pessoas.filter(
    (p) =>
      (!soPresentes || p.checkin_em) &&
      (filtro === "todas" || (filtro === "sem" ? !p.equipe_id : p.equipe_id === filtro)) &&
      (!termo || `${p.nome} ${p.igreja}`.toLocaleLowerCase("pt-BR").includes(termo))
  );

  const sortear = (refazer: boolean) => enviar({ acao: "sortear", eventoId, soPresentes: false, refazer });

  return (
    <section aria-labelledby="titulo-pessoas" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-pessoas" className="titulo text-2xl">
          Sorteio das equipes
        </h2>
        <p className="text-sm text-apagado">
          {pessoas.length} confirmados · {presentes} já chegaram
        </p>
      </div>

      <div className="cartao space-y-3 p-4">
        {comEquipe === 0 ? (
          <>
            <p className="text-sm text-apagado">
              O sorteio divide todos os confirmados por igual entre as {equipes.length} equipes
              {pessoas.length > 0 && ` — cerca de ${cadaUma} em cada`}. Quem confirmar depois recebe a cor na
              Validação, sempre na equipe com menos gente.
            </p>
            <button
              type="button"
              disabled={ocupado || pessoas.length === 0}
              onClick={() => sortear(false)}
              className="botao-primario"
            >
              {ocupado && <Girando />}
              Sortear os {pessoas.length} confirmados
            </button>
          </>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {porEquipe.map((e) => (
                <li
                  key={e.id}
                  className="rounded-full px-3 py-1 text-sm font-semibold tabular-nums"
                  style={{ background: e.cor, color: textoSobre(e.cor) }}
                >
                  {e.nome}: {e.pessoas}
                </li>
              ))}
              {semEquipe > 0 && (
                <li className="rounded-full border-2 border-dashed border-linha px-3 py-1 text-sm font-semibold text-apagado">
                  Sem equipe: {semEquipe}
                </li>
              )}
            </ul>

            {/* Troca manual é livre; o aviso só aparece quando a diferença passa de 1. */}
            {diferenca > 1 && (
              <div role="status" className="rounded-[10px] bg-laranja/10 p-3 text-sm text-laranja-escuro">
                <p className="font-semibold">
                  Equipes desequilibradas: {diferenca} pessoas de diferença entre a maior e a menor.
                </p>
                <p className="mt-1 text-tinta/80">
                  Equilibrar move {trocas} {trocas === 1 ? "pessoa" : "pessoas"} da maior para a menor — primeiro
                  quem ainda não chegou e não pegou pulseira.
                </p>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => enviar({ acao: "equilibrar", eventoId })}
                  className="botao-secundario mt-2 px-4 py-2 text-sm"
                >
                  Equilibrar agora
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {semEquipe > 0 && (
                <button type="button" disabled={ocupado} onClick={() => sortear(false)} className="botao-primario">
                  {ocupado && <Girando />}
                  Sortear os {semEquipe} sem equipe
                </button>
              )}
              <button type="button" disabled={ocupado} onClick={() => setRefazendo(true)} className="botao-secundario">
                Refazer o sorteio geral
              </button>
            </div>
            {refazendo && (
              <div role="alert" className="rounded-[10px] bg-ruim/10 p-3 text-sm text-ruim">
                <p className="font-semibold">
                  Todo mundo sai da equipe atual e os {pessoas.length} são sorteados de novo. Pulseira já entregue não
                  muda sozinha — só faça antes de entregar.
                </p>
                <span className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={async () => {
                      await sortear(true);
                      setRefazendo(false);
                    }}
                    className="botao-primario bg-ruim px-4 py-2 text-sm hover:bg-ruim/85"
                  >
                    Refazer mesmo assim
                  </button>
                  <button type="button" onClick={() => setRefazendo(false)} className="botao-secundario px-4 py-2 text-sm">
                    Cancelar
                  </button>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome ou igreja"
          aria-label="Buscar"
          className="campo-texto min-w-0 flex-1"
        />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar" className="campo-texto">
          <option value="todas">Todas as equipes</option>
          <option value="sem">Sem equipe</option>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soPresentes} onChange={(e) => setSoPresentes(e.target.checked)} />
          Só quem já chegou
        </label>
      </div>

      {visiveis.length === 0 ? (
        <p className="cartao p-5 text-apagado">Ninguém com esse filtro.</p>
      ) : (
        <ul className="cartao divide-y divide-linha">
          {visiveis.map((p) => {
            const e = p.equipe_id ? porId.get(p.equipe_id) : null;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className="h-8 w-2 shrink-0 rounded-full ring-1 ring-tinta/10"
                  style={{ background: e?.cor ?? "transparent" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">{p.nome}</span>
                  <span className="block text-xs text-apagado">
                    {p.igreja}
                    {p.checkin_em ? ` · chegou ${hora(p.checkin_em)}` : " · ainda não chegou"}
                  </span>
                </span>
                <select
                  value={p.equipe_id ?? ""}
                  disabled={ocupado}
                  onChange={(ev) => enviar({ acao: "mover", inscritoId: p.id, equipeId: ev.target.value || null })}
                  aria-label={`Equipe de ${p.nome}`}
                  className="campo-texto py-1.5 text-sm font-semibold"
                  style={e ? { background: e.cor, color: textoSobre(e.cor) } : undefined}
                >
                  <option value="">Sem equipe</option>
                  {equipes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Configurar

function Configurar({
  eventoId,
  equipes,
  placar,
  ocupado,
  enviar,
}: {
  eventoId: string;
  equipes: Equipe[];
  placar: LinhaPlacar[];
  ocupado: boolean;
  enviar: Enviar;
}) {
  const [nova, setNova] = useState("");
  const [corNova, setCorNova] = useState(CORES_PULSEIRA.find((c) => !equipes.some((e) => e.cor === c)) ?? "#7B1FA2");

  return (
    <section aria-labelledby="titulo-config" className="space-y-3">
      <h2 id="titulo-config" className="titulo text-2xl">
        Equipes e cores
      </h2>
      <ul className="cartao divide-y divide-linha">
        {equipes.map((e) => (
          <EquipeEditavel
            key={`${e.id}-${e.nome}-${e.cor}`}
            equipe={e}
            linha={placar.find((l) => l.equipe_id === e.id)}
            ocupado={ocupado}
            enviar={enviar}
          />
        ))}
      </ul>

      <form
        onSubmit={async (ev) => {
          ev.preventDefault();
          const { ok } = await enviar({ acao: "criar", eventoId, nome: nova, cor: corNova });
          if (ok) setNova("");
        }}
        className="cartao flex flex-wrap items-center gap-2 p-4"
      >
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          maxLength={30}
          placeholder="Nova equipe (ex.: Roxa)"
          aria-label="Nome da nova equipe"
          className="campo-texto min-w-0 flex-1"
        />
        <SeletorCor valor={corNova} aoMudar={setCorNova} />
        <button type="submit" disabled={ocupado || !nova.trim()} className="botao-secundario">
          Adicionar
        </button>
      </form>
    </section>
  );
}

function EquipeEditavel({
  equipe,
  linha,
  ocupado,
  enviar,
}: {
  equipe: Equipe;
  linha?: LinhaPlacar;
  ocupado: boolean;
  enviar: Enviar;
}) {
  const [nome, setNome] = useState(equipe.nome);
  const [cor, setCor] = useState(equipe.cor);
  const [apagando, setApagando] = useState(false);
  const mudou = nome.trim() !== equipe.nome || cor !== equipe.cor;

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={30}
          aria-label="Nome da equipe"
          className="campo-texto min-w-0 flex-1 font-semibold"
        />
        <SeletorCor valor={cor} aoMudar={setCor} />
        {mudou && (
          <button
            type="button"
            disabled={ocupado || !nome.trim()}
            onClick={() => enviar({ acao: "editar", id: equipe.id, nome: nome.trim(), cor })}
            className="botao-primario px-4 py-2 text-sm"
          >
            Salvar
          </button>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => setApagando(true)}
          className="px-2 font-semibold text-ruim hover:underline disabled:opacity-40"
        >
          Apagar
        </button>
      </div>
      {apagando && (
        <div role="alert" className="rounded-[10px] bg-ruim/10 p-3 text-sm text-ruim">
          <p className="font-semibold">
            {linha && (linha.pessoas > 0 || linha.pontos !== 0)
              ? `${linha.pessoas} pessoas ficam sem equipe e os ${linha.pontos} pontos somem.`
              : "A equipe está vazia e sem pontos."}{" "}
            Apagar {nomeDaEquipe(equipe.nome)}?
          </p>
          <span className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => enviar({ acao: "apagar", id: equipe.id })}
              className="botao-primario bg-ruim px-4 py-2 text-sm hover:bg-ruim/85"
            >
              Apagar
            </button>
            <button type="button" onClick={() => setApagando(false)} className="botao-secundario px-4 py-2 text-sm">
              Cancelar
            </button>
          </span>
        </div>
      )}
    </li>
  );
}

function SeletorCor({ valor, aoMudar }: { valor: string; aoMudar: (c: string) => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Cor">
      {CORES_PULSEIRA.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={valor.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          onClick={() => aoMudar(c)}
          className={`h-6 w-6 rounded-full ring-1 ring-tinta/20 ${
            valor.toLowerCase() === c.toLowerCase() ? "outline-2 outline-offset-2 outline-tinta" : ""
          }`}
          style={{ background: c }}
        />
      ))}
      {/* Cor fora da lista: pulseira de cor diferente no ano. */}
      <input
        type="color"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-label="Outra cor"
        className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
      />
    </span>
  );
}
