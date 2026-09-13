"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatarReais } from "@/lib/validacao";
import { SeloStatus } from "@/components/SeloStatus";
import { ROTULO_STATUS, type StatusInscricao } from "@/tipos/db";

export type LinhaInscricao = {
  codigo: string;
  status: StatusInscricao;
  valorCentavos: number;
  criadoEm: string;
  eventoId: string;
  evento: string;
  responsavelId: string;
  responsavel: string;
  responsavelEmail: string;
  pessoas: { nome: string; cpf: string; igreja: string }[];
  comprovantesPendentes: number;
};

const normal = (t: string) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ListaInscricoes({
  linhas,
  eventos,
  inicial,
}: {
  linhas: LinhaInscricao[];
  eventos: { id: string; nome: string }[];
  inicial: { evento: string; status: string; responsavel: string; q: string };
}) {
  const [evento, setEvento] = useState(inicial.evento);
  const [status, setStatus] = useState(inicial.status);
  const [responsavel, setResponsavel] = useState(inicial.responsavel);
  const [busca, setBusca] = useState(inicial.q);

  const visiveis = useMemo(() => {
    const q = normal(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    return linhas.filter((l) => {
      if (evento && l.eventoId !== evento) return false;
      if (status === "pendente_analise" ? l.comprovantesPendentes === 0 : status && l.status !== status) return false;
      if (responsavel && l.responsavelId !== responsavel) return false;
      if (!q) return true;
      return (
        normal(l.codigo).includes(q) ||
        normal(l.responsavel).includes(q) ||
        normal(l.responsavelEmail).includes(q) ||
        l.pessoas.some(
          (p) =>
            normal(p.nome).includes(q) ||
            normal(p.igreja).includes(q) ||
            (digitos.length >= 3 && p.cpf.includes(digitos))
        )
      );
    });
  }, [linhas, evento, status, responsavel, busca]);

  const nomeResponsavelFiltrado = responsavel
    ? linhas.find((l) => l.responsavelId === responsavel)?.responsavel
    : null;

  const totalPessoas = visiveis.reduce((n, l) => n + (l.status === "cancelada" ? 0 : l.pessoas.length), 0);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Código, nome, CPF, igreja ou e-mail"
          aria-label="Buscar inscrição"
          className="campo-texto"
        />
        <select value={evento} onChange={(e) => setEvento(e.target.value)} aria-label="Evento" className="campo-texto">
          <option value="">Todos os eventos</option>
          {eventos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação" className="campo-texto">
          <option value="">Todas as situações</option>
          <option value="pendente_analise">Com comprovante para analisar</option>
          {(Object.keys(ROTULO_STATUS) as StatusInscricao[]).map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </div>

      {nomeResponsavelFiltrado && (
        <p className="mt-2 text-sm text-apagado">
          Só as inscrições de <strong className="text-tinta">{nomeResponsavelFiltrado}</strong> ·{" "}
          <button type="button" onClick={() => setResponsavel("")} className="font-semibold text-laranja-escuro hover:underline">
            ver todas
          </button>
        </p>
      )}

      <p className="mt-3 text-sm text-apagado" aria-live="polite">
        {visiveis.length} inscriç{visiveis.length === 1 ? "ão" : "ões"} · {totalPessoas} pessoas ativas
      </p>

      <ul className="mt-2 space-y-3">
        {visiveis.map((l) => (
          <li key={l.codigo}>
            <Link
              href={`/diretoria/inscricoes/${l.codigo}`}
              className={`cartao flex flex-wrap items-start justify-between gap-3 p-4 transition hover:border-laranja ${
                l.status === "cancelada" ? "opacity-60" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-tinta">{l.codigo}</span>
                  <SeloStatus status={l.status} />
                  {l.comprovantesPendentes > 0 && l.status !== "cancelada" && (
                    <span className="rounded-full bg-laranja px-2 py-0.5 text-[11px] font-semibold text-white">
                      {l.comprovantesPendentes} para analisar
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-apagado">
                  {l.evento} · {new Date(l.criadoEm).toLocaleDateString("pt-BR")}
                </span>
                <span className="mt-1 block text-sm text-tinta">
                  {l.pessoas.map((p) => p.nome).join(", ")}
                </span>
                <span className="block text-xs text-apagado">
                  Responsável: {l.responsavel}
                  {l.responsavelEmail && ` · ${l.responsavelEmail}`}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="titulo block text-lg">{formatarReais(l.valorCentavos)}</span>
                <span className="text-xs text-apagado">
                  {l.pessoas.length} {l.pessoas.length === 1 ? "pessoa" : "pessoas"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {visiveis.length === 0 && (
        <div className="cartao mt-3 flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nenhuma inscrição com esses filtros.</p>
        </div>
      )}
    </>
  );
}
