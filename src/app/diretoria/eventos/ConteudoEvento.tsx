"use client";

import { useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import {
  DIA_PADRAO,
  DUVIDAS_MODELO,
  MODELOS,
  TIPOS,
  diaLegivel,
  diasDoEvento,
  emOrdem,
  horaLegivel,
  type ItemProgramacao,
  type TipoItem,
} from "@/lib/programacao";

export type { ItemProgramacao };
export type ItemDuvida = { id: string; pergunta: string; resposta: string; ordem: number };

const MENSAGEM: Record<string, string> = {
  pedido_invalido: "Confira os campos: o título precisa de pelo menos 2 letras; a pergunta, de 5.",
  sem_permissao: "Só administrador mexe no conteúdo do evento.",
  falha_ao_gravar: "Não deu para salvar agora.",
};

const URL_API = "/api/admin/eventos/conteudo";

/**
 * Programação e dúvidas do evento.
 *
 * A programação é montada por modelos, não digitando: com campo livre, a
 * mesma coisa saía com três nomes ("Café", "Café da manhã", "Desjejum") e o
 * horário escrito de dois jeitos. O horário vem de seletor, que no celular
 * abre a rodinha do sistema.
 *
 * Tudo é editável no lugar: dúvida escrita errada se conserta sem apagar e
 * refazer.
 */
export function ConteudoEvento({
  eventoId,
  dataEvento,
  dataFim,
  programacao,
  duvidas,
}: {
  eventoId: string;
  dataEvento: string;
  dataFim: string | null;
  programacao: ItemProgramacao[];
  duvidas: ItemDuvida[];
}) {
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo." });
  const dias = diasDoEvento(dataEvento, dataFim);

  return (
    <div className="mt-8 space-y-6">
      {(acao.erro || acao.feito) && <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />}

      <Agenda eventoId={eventoId} dias={dias} itens={programacao} acao={acao} />
      <Duvidas eventoId={eventoId} itens={duvidas} acao={acao} />
    </div>
  );
}

type Acao = ReturnType<typeof useAcao>;

function Agenda({
  eventoId,
  dias,
  itens,
  acao,
}: {
  eventoId: string;
  dias: string[];
  itens: ItemProgramacao[];
  acao: Acao;
}) {
  const [dia, setDia] = useState(dias[0] ?? "");
  const [hora, setHora] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoItem | "">("");
  const [descricao, setDescricao] = useState("");
  const [editando, setEditando] = useState<string | null>(null);

  const ordenados = emOrdem(itens);

  async function adicionar(ev: React.FormEvent) {
    ev.preventDefault();
    const { ok } = await acao.json(URL_API, "POST", {
      tipo: "programacao",
      eventoId,
      itens: [{ hora: hora || null, dia: dia || null, tipo: tipo || null, titulo, descricao: descricao || null }],
    });
    if (ok) {
      setHora("");
      setTitulo("");
      setTipo("");
      setDescricao("");
    }
  }

  const montarDia = () =>
    acao.json(URL_API, "POST", {
      tipo: "programacao",
      eventoId,
      itens: DIA_PADRAO.map((m) => ({ ...m, dia: dia || null, descricao: null })),
    });

  return (
    <section className="cartao p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="titulo text-lg">Programação</h3>
        <button
          type="button"
          disabled={acao.ocupado}
          onClick={montarDia}
          className="text-sm font-semibold text-laranja-escuro hover:underline disabled:opacity-40"
        >
          Montar dia padrão ({DIA_PADRAO.length} itens)
        </button>
      </div>
      <p className="mt-1 text-sm text-apagado">
        Comece pelo modelo e ajuste o que for diferente. Dá para editar e apagar item por item.
      </p>

      {/* ---- modelos ---- */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-apagado uppercase">Adicionar rápido</p>
        <div className="flex flex-wrap gap-1.5">
          {MODELOS.map((m) => (
            <button
              key={m.titulo}
              type="button"
              onClick={() => {
                setTitulo(m.titulo);
                setTipo(m.tipo);
                setHora(m.hora);
              }}
              className="rounded-full border border-linha px-3 py-1 text-xs font-semibold text-tinta hover:border-laranja hover:text-laranja-escuro"
            >
              {m.titulo}
            </button>
          ))}
        </div>
      </div>

      {/* ---- formulário ---- */}
      <form onSubmit={adicionar} className="mt-4 space-y-2">
        <div className="grid gap-2 sm:grid-cols-[7rem_1fr_10rem]">
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            aria-label="Horário"
            className="campo-texto"
          />
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="O que acontece"
            aria-label="Título"
            required
            maxLength={120}
            className="campo-texto"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoItem | "")}
            aria-label="Tipo"
            className="campo-texto"
          >
            <option value="">Sem tipo</option>
            {(Object.keys(TIPOS) as TipoItem[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS[t].rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe (opcional)"
            aria-label="Descrição"
            maxLength={300}
            className="campo-texto"
          />
          <button type="submit" disabled={acao.ocupado} className="botao-secundario">
            {acao.ocupado ? <Girando /> : "Adicionar"}
          </button>
        </div>

        {dias.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold tracking-wide text-apagado uppercase">Dia</span>
            {dias.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDia(d)}
                aria-pressed={dia === d}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  dia === d ? "border-laranja bg-laranja/10 text-laranja-escuro" : "border-linha text-apagado"
                }`}
              >
                {diaLegivel(d).replace(",", " ·")}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* ---- lista ---- */}
      {ordenados.length > 0 && (
        <ol className="mt-4 divide-y divide-linha rounded-[10px] border border-linha">
          {ordenados.map((p) =>
            editando === p.id ? (
              <li key={p.id} className="p-3">
                <LinhaEditavel
                  item={p}
                  dias={dias}
                  acao={acao}
                  aoFechar={() => setEditando(null)}
                />
              </li>
            ) : (
              <li key={p.id} className="flex items-start gap-3 p-3 text-sm">
                <span className="titulo w-14 shrink-0 text-laranja-escuro">{horaLegivel(p) || "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-tinta">{p.titulo}</span>
                    {p.tipo && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TIPOS[p.tipo].cor}`}>
                        {TIPOS[p.tipo].rotulo}
                      </span>
                    )}
                    {p.dia && <span className="text-[11px] text-apagado">{diaLegivel(p.dia)}</span>}
                  </span>
                  {p.descricao && <span className="block text-apagado">{p.descricao}</span>}
                </span>
                <span className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditando(p.id)}
                    className="font-semibold text-laranja-escuro hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={acao.ocupado}
                    onClick={() => acao.json(URL_API, "DELETE", { tipo: "programacao", id: p.id })}
                    className="font-semibold text-ruim hover:underline disabled:opacity-40"
                  >
                    Apagar
                  </button>
                </span>
              </li>
            )
          )}
        </ol>
      )}
    </section>
  );
}

function LinhaEditavel({
  item,
  dias,
  acao,
  aoFechar,
}: {
  item: ItemProgramacao;
  dias: string[];
  acao: Acao;
  aoFechar: () => void;
}) {
  const [hora, setHora] = useState(item.hora?.slice(0, 5) ?? "");
  const [titulo, setTitulo] = useState(item.titulo);
  const [tipo, setTipo] = useState<TipoItem | "">(item.tipo ?? "");
  const [descricao, setDescricao] = useState(item.descricao ?? "");
  const [dia, setDia] = useState(item.dia ?? "");

  async function salvar() {
    const { ok } = await acao.json(URL_API, "PATCH", {
      tipo: "programacao",
      id: item.id,
      hora: hora || null,
      dia: dia || null,
      categoria: tipo || null,
      titulo,
      descricao: descricao || null,
    });
    if (ok) aoFechar();
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[7rem_1fr_10rem]">
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Horário" className="campo-texto" />
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título" className="campo-texto" />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoItem | "")}
          aria-label="Tipo"
          className="campo-texto"
        >
          <option value="">Sem tipo</option>
          {(Object.keys(TIPOS) as TipoItem[]).map((t) => (
            <option key={t} value={t}>
              {TIPOS[t].rotulo}
            </option>
          ))}
        </select>
      </div>

      <input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Detalhe (opcional)"
        aria-label="Descrição"
        className="campo-texto"
      />

      {dias.length > 0 && (
        <select value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="campo-texto">
          <option value="">Sem dia</option>
          {dias.map((d) => (
            <option key={d} value={d}>
              {diaLegivel(d)}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        <button type="button" disabled={acao.ocupado} onClick={salvar} className="botao-primario px-4 py-2 text-sm">
          {acao.ocupado ? <Girando /> : "Salvar"}
        </button>
        <button type="button" onClick={aoFechar} className="botao-secundario px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Duvidas({ eventoId, itens, acao }: { eventoId: string; itens: ItemDuvida[]; acao: Acao }) {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [editando, setEditando] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await acao.json(URL_API, "POST", {
      tipo: "duvida",
      eventoId,
      duvidas: [{ pergunta, resposta }],
    });
    if (ok) {
      setPergunta("");
      setResposta("");
    }
  }

  return (
    <section className="cartao p-5">
      <h3 className="titulo text-lg">Dúvidas frequentes</h3>
      <p className="mt-1 text-sm text-apagado">
        As perguntas que chegam no WhatsApp toda edição. Clique numa sugestão para começar.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {DUVIDAS_MODELO.map((d) => (
          <button
            key={d.pergunta}
            type="button"
            onClick={() => setPergunta(d.pergunta)}
            className="rounded-full border border-linha px-3 py-1 text-xs font-semibold text-tinta hover:border-laranja hover:text-laranja-escuro"
          >
            {d.pergunta}
          </button>
        ))}
      </div>

      <form onSubmit={adicionar} className="mt-4 space-y-2">
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Pergunta"
          aria-label="Pergunta"
          required
          maxLength={200}
          className="campo-texto"
        />
        <textarea
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          placeholder="Resposta"
          aria-label="Resposta"
          required
          rows={2}
          maxLength={1000}
          className="campo-texto"
        />
        <button type="submit" disabled={acao.ocupado} className="botao-secundario">
          {acao.ocupado ? <Girando /> : "Adicionar dúvida"}
        </button>
      </form>

      {itens.length > 0 && (
        <ul className="mt-4 divide-y divide-linha rounded-[10px] border border-linha">
          {itens.map((d) =>
            editando === d.id ? (
              <li key={d.id} className="p-3">
                <DuvidaEditavel duvida={d} acao={acao} aoFechar={() => setEditando(null)} />
              </li>
            ) : (
              <li key={d.id} className="flex items-start gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">{d.pergunta}</span>
                  <span className="block text-apagado">{d.resposta}</span>
                </span>
                <span className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditando(d.id)}
                    className="font-semibold text-laranja-escuro hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={acao.ocupado}
                    onClick={() => acao.json(URL_API, "DELETE", { tipo: "duvida", id: d.id })}
                    className="font-semibold text-ruim hover:underline disabled:opacity-40"
                  >
                    Apagar
                  </button>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}

function DuvidaEditavel({
  duvida,
  acao,
  aoFechar,
}: {
  duvida: ItemDuvida;
  acao: Acao;
  aoFechar: () => void;
}) {
  const [pergunta, setPergunta] = useState(duvida.pergunta);
  const [resposta, setResposta] = useState(duvida.resposta);

  async function salvar() {
    const { ok } = await acao.json(URL_API, "PATCH", { tipo: "duvida", id: duvida.id, pergunta, resposta });
    if (ok) aoFechar();
  }

  return (
    <div className="space-y-2">
      <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} aria-label="Pergunta" className="campo-texto" />
      <textarea
        value={resposta}
        onChange={(e) => setResposta(e.target.value)}
        aria-label="Resposta"
        rows={3}
        className="campo-texto"
      />
      <div className="flex gap-2">
        <button type="button" disabled={acao.ocupado} onClick={salvar} className="botao-primario px-4 py-2 text-sm">
          {acao.ocupado ? <Girando /> : "Salvar"}
        </button>
        <button type="button" onClick={aoFechar} className="botao-secundario px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}
