"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatarReais } from "@/lib/validacao";
import type { ComprovanteDoPagamento, InscricaoDoPagamento, SituacaoPagamento } from "@/lib/pagamentos";

type Comprovante = Omit<ComprovanteDoPagamento, "caminho"> & { url: string | null; ehPdf: boolean };

type Resumo = {
  esperado: number;
  recebido: number;
  emAnalise: number;
  falta: number;
  aDevolver: number;
  inscricoes: InscricaoDoPagamento[];
  comprovantes: Comprovante[];
};

type Aba = "comprovantes" | "inscricoes" | "sem_comprovante" | "devolver";
type FiltroComprovante = "todos" | "pendente" | "aprovado" | "recusado";

const SITUACAO: Record<SituacaoPagamento, { texto: string; cor: string }> = {
  quitado: { texto: "Quitado", cor: "bg-ok/10 text-ok" },
  parcial: { texto: "Pago em parte", cor: "bg-laranja/10 text-laranja-escuro" },
  em_analise: { texto: "Em análise", cor: "bg-laranja/10 text-laranja-escuro" },
  recusado: { texto: "Comprovante recusado", cor: "bg-ruim/10 text-ruim" },
  sem_comprovante: { texto: "Sem comprovante", cor: "bg-tinta/10 text-apagado" },
  cancelada: { texto: "Cancelada", cor: "bg-tinta/10 text-apagado" },
};

const COMPROVANTE: Record<Comprovante["situacao"], { texto: string; cor: string }> = {
  pendente: { texto: "Aguardando análise", cor: "bg-laranja/10 text-laranja-escuro" },
  aprovado: { texto: "Aprovado", cor: "bg-ok/10 text-ok" },
  recusado: { texto: "Recusado", cor: "bg-ruim/10 text-ruim" },
};

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const normal = (t: string) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ListaPagamentos({
  eventos,
  eventoAtual,
  resumo,
}: {
  eventos: { slug: string; nome: string }[];
  eventoAtual: string;
  resumo: Resumo;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("comprovantes");
  const [filtro, setFiltro] = useState<FiltroComprovante>("todos");
  const [busca, setBusca] = useState("");

  const q = normal(busca.trim());
  const combina = (...campos: string[]) => !q || campos.some((c) => normal(c).includes(q));

  const comprovantes = useMemo(
    () =>
      resumo.comprovantes.filter(
        (c) => (filtro === "todos" || c.situacao === filtro) && combina(c.codigo, c.responsavel)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resumo.comprovantes, filtro, q]
  );
  const semComprovante = resumo.inscricoes.filter((i) => i.situacao === "sem_comprovante");
  const devolver = resumo.inscricoes.filter((i) => i.situacao === "cancelada" && i.pago > 0);
  const pendentes = resumo.comprovantes.filter((c) => c.situacao === "pendente").length;
  const percentual = resumo.esperado > 0 ? Math.round((resumo.recebido / resumo.esperado) * 100) : 0;

  const abas: [Aba, string, number][] = [
    ["comprovantes", "Comprovantes", resumo.comprovantes.length],
    ["inscricoes", "Por inscrição", resumo.inscricoes.length],
    ["sem_comprovante", "Sem comprovante", semComprovante.length],
    ["devolver", "A devolver", devolver.length],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={eventoAtual}
          onChange={(e) => router.push(`/diretoria/pagamentos?evento=${e.target.value}`)}
          aria-label="Evento"
          className="campo-texto w-auto"
        >
          {eventos.map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.nome}
            </option>
          ))}
        </select>
        <a href={`/api/admin/pagamentos?evento=${eventoAtual}`} className="botao-secundario">
          Baixar planilha (CSV)
        </a>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Esperado" valor={formatarReais(resumo.esperado)} />
        <Numero rotulo="Recebido (aprovado)" valor={formatarReais(resumo.recebido)} cor="text-ok" />
        <Numero
          rotulo={`Em análise · ${pendentes} ${pendentes === 1 ? "comprovante" : "comprovantes"}`}
          valor={formatarReais(resumo.emAnalise)}
          cor="text-laranja-escuro"
        />
        <Numero rotulo="Falta receber" valor={formatarReais(resumo.falta)} />
      </section>

      <div className="mt-3">
        <div
          className="h-2 overflow-hidden rounded-full bg-linha"
          role="progressbar"
          aria-valuenow={percentual}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Recebido do esperado"
        >
          <div className="h-full bg-ok" style={{ width: `${Math.min(percentual, 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-apagado">{percentual}% do esperado já foi aprovado.</p>
      </div>

      {resumo.aDevolver > 0 && (
        <p className="mt-4 rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
          {formatarReais(resumo.aDevolver)} de inscrições canceladas que já tinham pagamento aprovado. Veja em
          &quot;A devolver&quot;.
        </p>
      )}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-linha" role="tablist">
        {abas.map(([id, titulo, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`-mb-px shrink-0 rounded-t-[10px] border-b-[3px] px-4 py-2.5 text-sm font-semibold ${
              aba === id ? "border-laranja bg-laranja/10 text-laranja-escuro" : "border-transparent text-apagado hover:text-tinta"
            }`}
          >
            {titulo} <span className="font-normal">({n})</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código ou responsável"
          aria-label="Buscar"
          className="campo-texto"
        />
      </div>

      {aba === "comprovantes" && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos"],
                ["pendente", "Aguardando análise"],
                ["aprovado", "Aprovados"],
                ["recusado", "Recusados"],
              ] as [FiltroComprovante, string][]
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                  filtro === valor ? "border-laranja bg-laranja/10 text-laranja-escuro" : "border-linha text-apagado"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          <ul className="mt-3 space-y-3">
            {comprovantes.map((c) => (
              <li key={c.id} className="cartao flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COMPROVANTE[c.situacao].cor}`}>
                      {COMPROVANTE[c.situacao].texto}
                    </span>
                    <Link
                      href={`/diretoria/inscricoes/${c.codigo}`}
                      className="font-mono font-semibold text-tinta hover:underline"
                    >
                      {c.codigo}
                    </Link>
                    {c.statusInscricao === "cancelada" && (
                      <span className="text-xs font-semibold text-ruim">inscrição cancelada</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-tinta">
                    {c.responsavel} · parcela {c.parcela}/{c.parcelas} · {formatarReais(c.valorParcela)}
                  </p>
                  <p className="text-xs text-apagado">
                    Enviado {quando(c.enviadoEm)}
                    {c.situacao !== "pendente" &&
                      ` · ${c.situacao === "aprovado" ? "aprovado" : "recusado"} por ${c.avaliadoPor ?? "—"} em ${quando(c.avaliadoEm)}`}
                  </p>
                  {c.motivo && <p className="mt-1 text-xs text-ruim">Motivo: {c.motivo}</p>}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-laranja-escuro hover:underline">
                      {c.ehPdf ? "Abrir PDF" : "Ver comprovante"}
                    </a>
                  ) : (
                    <span className="text-apagado">arquivo indisponível</span>
                  )}
                  {c.situacao === "pendente" && (
                    <Link href={`/diretoria/inscricoes/${c.codigo}`} className="font-semibold text-tinta hover:underline">
                      Analisar →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {comprovantes.length === 0 && <Vazio texto="Nenhum comprovante com esse filtro." />}
        </>
      )}

      {aba === "inscricoes" && (
        <ListaInscricoes itens={resumo.inscricoes.filter((i) => combina(i.codigo, i.responsavel, i.email))} />
      )}

      {aba === "sem_comprovante" && (
        <>
          <p className="mt-3 text-sm text-apagado">
            Inscrições que ainda não mandaram nenhum comprovante, das mais antigas para as mais novas.
          </p>
          <ListaInscricoes itens={semComprovante.filter((i) => combina(i.codigo, i.responsavel, i.email))} />
        </>
      )}

      {aba === "devolver" && (
        <>
          <p className="mt-3 text-sm text-apagado">
            Canceladas depois de ter pagamento aprovado. A devolução é feita fora do site, direto com a pessoa.
          </p>
          <ListaInscricoes itens={devolver.filter((i) => combina(i.codigo, i.responsavel, i.email))} />
        </>
      )}
    </>
  );
}

function ListaInscricoes({ itens }: { itens: InscricaoDoPagamento[] }) {
  if (itens.length === 0) return <Vazio texto="Nada por aqui." />;
  return (
    <ul className="mt-3 space-y-2">
      {itens.map((i) => (
        <li key={i.codigo} className="cartao flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <Link href={`/diretoria/inscricoes/${i.codigo}`} className="font-mono font-semibold text-tinta hover:underline">
                {i.codigo}
              </Link>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SITUACAO[i.situacao].cor}`}>
                {SITUACAO[i.situacao].texto}
              </span>
            </p>
            <p className="mt-1 text-tinta">
              {i.responsavel} · {i.pessoas} {i.pessoas === 1 ? "pessoa" : "pessoas"}
            </p>
            <p className="text-xs text-apagado">
              Inscrita {quando(i.criadaEm)} · {i.enviados} {i.enviados === 1 ? "comprovante" : "comprovantes"}
              {i.parcelas > 1 && ` · ${i.aprovados}/${i.parcelas} parcelas aprovadas`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold text-tinta">{formatarReais(i.valor)}</p>
            <p className="text-xs text-ok">pago {formatarReais(i.pago)}</p>
            {i.falta > 0 && <p className="text-xs text-apagado">falta {formatarReais(i.falta)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="cartao p-4">
      <p className={`titulo text-xl ${cor ?? "text-tinta"}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-apagado">{rotulo}</p>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="cartao mt-3 flex items-center gap-4 p-6">
      <img src="/juca/joia.webp" alt="" className="w-14" />
      <p className="text-apagado">{texto}</p>
    </div>
  );
}
