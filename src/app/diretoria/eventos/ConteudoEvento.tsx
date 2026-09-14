"use client";

import { useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";

export type ItemProgramacao = {
  id: string;
  horario: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
};

export type ItemDuvida = { id: string; pergunta: string; resposta: string; ordem: number };

const MENSAGEM: Record<string, string> = {
  pedido_invalido: "Confira os campos: horário e título na programação; pergunta e resposta nas dúvidas.",
  sem_permissao: "Só administrador mexe no conteúdo do evento.",
};

/** Abas "Programação" e "Dúvidas" da página do evento. */
export function ConteudoEvento({
  eventoId,
  programacao,
  duvidas,
}: {
  eventoId: string;
  programacao: ItemProgramacao[];
  duvidas: ItemDuvida[];
}) {
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo." });
  const [horario, setHorario] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");

  async function addProgramacao(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await acao.json("/api/admin/eventos/conteudo", "POST", {
      tipo: "programacao",
      eventoId,
      horario,
      titulo,
      descricao: descricao || null,
      ordem: (programacao.at(-1)?.ordem ?? 0) + 10,
    });
    if (ok) {
      setHorario("");
      setTitulo("");
      setDescricao("");
    }
  }

  async function addDuvida(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await acao.json("/api/admin/eventos/conteudo", "POST", {
      tipo: "duvida",
      eventoId,
      pergunta,
      resposta,
      ordem: (duvidas.at(-1)?.ordem ?? 0) + 10,
    });
    if (ok) {
      setPergunta("");
      setResposta("");
    }
  }

  const remover = (tipo: "programacao" | "duvida", id: string) =>
    acao.json("/api/admin/eventos/conteudo", "DELETE", { tipo, id });

  return (
    <div className="mt-8 space-y-6">
      {(acao.erro || acao.feito) && <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />}

      <section className="cartao p-5">
        <h3 className="titulo text-lg">Programação</h3>
        <p className="text-sm text-apagado">Na ordem em que acontece. Para mudar um item, remova e adicione de novo.</p>

        {programacao.length > 0 && (
          <ol className="mt-3 divide-y divide-linha rounded-[10px] border border-linha">
            {programacao.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3 text-sm">
                <span className="titulo w-14 shrink-0 text-laranja-escuro">{p.horario}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">{p.titulo}</span>
                  {p.descricao && <span className="block text-apagado">{p.descricao}</span>}
                </span>
                <button
                  type="button"
                  disabled={acao.ocupado}
                  onClick={() => remover("programacao", p.id)}
                  className="shrink-0 font-semibold text-ruim hover:underline disabled:opacity-40"
                >
                  Remover
                </button>
              </li>
            ))}
          </ol>
        )}

        <form onSubmit={addProgramacao} className="mt-3 grid gap-2 sm:grid-cols-[6rem_1fr_1fr_auto]">
          <input
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="08h30"
            aria-label="Horário"
            required
            maxLength={20}
            className="campo-texto"
          />
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Abertura"
            aria-label="Título"
            required
            maxLength={120}
            className="campo-texto"
          />
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
        </form>
      </section>

      <section className="cartao p-5">
        <h3 className="titulo text-lg">Dúvidas frequentes</h3>

        {duvidas.length > 0 && (
          <ul className="mt-3 divide-y divide-linha rounded-[10px] border border-linha">
            {duvidas.map((d) => (
              <li key={d.id} className="flex items-start gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">{d.pergunta}</span>
                  <span className="block text-apagado">{d.resposta}</span>
                </span>
                <button
                  type="button"
                  disabled={acao.ocupado}
                  onClick={() => remover("duvida", d.id)}
                  className="shrink-0 font-semibold text-ruim hover:underline disabled:opacity-40"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addDuvida} className="mt-3 space-y-2">
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
      </section>
    </div>
  );
}
