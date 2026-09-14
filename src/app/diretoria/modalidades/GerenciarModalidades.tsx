"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import {
  ORDEM_TURNO,
  ROTULO_FORMATO,
  ROTULO_TURNO,
  type CategoriaModalidade,
  type Esporte,
  type Evento,
  type FormatoModalidade,
  type Turno,
} from "@/tipos/db";

type Props = {
  eventos: Evento[];
  esportes: Esporte[];
  /** esporte_id -> quantas pessoas já escolheram */
  ocupacao: Record<string, number>;
};

const MENSAGEM: Record<string, string> = {
  tem_inscritos: "Já tem gente inscrita nessa modalidade. Zere as vagas em vez de apagar.",
  formato_com_inscritos:
    "Já tem gente inscrita: trocar o formato deixaria escolhas sem nota ou parceiro. Crie outra modalidade.",
  sem_permissao: "Só administrador mexe nas modalidades.",
  pedido_invalido: "Confira os campos.",
  falha_ao_gravar: "Não deu para salvar agora.",
};

/** O que cada formato pede de quem se inscreve — aparece no cadastro para ninguém escolher no escuro. */
const DICA_FORMATO: Record<FormatoModalidade, string> = {
  individual: "Cada um por si (xadrez, tênis de mesa).",
  dupla: "Quem se inscreve escreve o nome da dupla.",
  trio: "Quem se inscreve escreve os dois parceiros.",
  time_sorteado: "Cada um dá nota de 1 a 5 para a própria habilidade; a diretoria sorteia times equilibrados.",
};

export function GerenciarModalidades({ eventos, esportes, ocupacao }: Props) {
  const [eventoId, setEventoId] = useState(eventos[0]?.id ?? "");
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Salvo." });
  const ocupado = acao.ocupado;

  const evento = eventos.find((e) => e.id === eventoId);
  const doEvento = useMemo(() => esportes.filter((e) => e.evento_id === eventoId), [esportes, eventoId]);

  // Novo cadastro já sugere o tipo do evento: oficina no congresso, esporte no resto.
  const [categoria, setCategoria] = useState<CategoriaModalidade>(evento?.tipo === "congresso" ? "oficina" : "esporte");
  const [formato, setFormato] = useState<FormatoModalidade>("individual");

  async function chamar(metodo: "POST" | "PATCH" | "DELETE", corpo: unknown) {
    const { ok } = await acao.json("/api/admin/modalidades", metodo, corpo);
    return ok;
  }

  async function criar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = new FormData(form);
    const ok = await chamar("POST", {
      eventoId,
      nome: String(f.get("nome") ?? ""),
      turno: String(f.get("turno") ?? "manha"),
      vagas: Number(f.get("vagas") ?? 0),
      categoria,
      formato: categoria === "oficina" ? "individual" : formato,
      responsavel: String(f.get("responsavel") ?? "") || null,
      descricao: String(f.get("descricao") ?? "") || null,
      ordem: doEvento.length,
    });
    if (ok) form.reset();
  }

  return (
    <>
      {eventos.length > 1 && (
        <select
          value={eventoId}
          onChange={(e) => {
            setEventoId(e.target.value);
            const tipo = eventos.find((x) => x.id === e.target.value)?.tipo;
            setCategoria(tipo === "congresso" ? "oficina" : "esporte");
          }}
          aria-label="Evento"
          className="mb-5 rounded-[10px] border-2 border-linha bg-white px-3 py-2 text-sm"
        >
          {eventos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      )}

      <div className="mb-4 empty:hidden">
        <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
      </div>

      {evento && !evento.tem_modalidades && (
        <p className="mb-4 rounded-[10px] bg-laranja/10 px-4 py-3 text-sm text-laranja-escuro">
          Este evento está com modalidades desligadas: o que for cadastrado aqui não aparece na inscrição. Ligue em
          Diretoria → Eventos → {evento.nome}.
        </p>
      )}

      {evento && <LimitePorTurno evento={evento} />}

      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">Nova {categoria === "oficina" ? "oficina" : "modalidade"}</h2>

        <div className="mt-3 inline-flex rounded-[10px] border-2 border-linha p-1" role="radiogroup" aria-label="Tipo">
          {(
            [
              ["esporte", "Esporte"],
              ["oficina", "Oficina / estudo"],
            ] as [CategoriaModalidade, string][]
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={categoria === valor}
              onClick={() => setCategoria(valor)}
              className={`rounded-[8px] px-4 py-1.5 text-sm font-semibold ${
                categoria === valor ? "bg-laranja text-white" : "text-apagado"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        <form onSubmit={criar} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <input
              name="nome"
              required
              placeholder={categoria === "oficina" ? "Vida financeira" : "Vôlei misto"}
              aria-label="Nome"
              className="campo-texto"
              maxLength={60}
            />
            <select name="turno" className="campo-texto" defaultValue="manha" aria-label="Turno">
              {ORDEM_TURNO.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TURNO[t]}
                </option>
              ))}
            </select>
            <input
              name="vagas"
              type="number"
              min={1}
              max={2000}
              defaultValue={categoria === "oficina" ? 40 : 20}
              required
              aria-label="Vagas"
              className="campo-texto"
            />
          </div>

          {categoria === "esporte" ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">Formato</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {(Object.keys(ROTULO_FORMATO) as FormatoModalidade[]).map((f) => (
                  <label
                    key={f}
                    className={`flex cursor-pointer flex-col rounded-[10px] border-2 p-3 ${
                      formato === f ? "border-laranja bg-laranja/5" : "border-linha"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-tinta">
                      <input
                        type="radio"
                        name="formato"
                        checked={formato === f}
                        onChange={() => setFormato(f)}
                        className="accent-[#D94C1A]"
                      />
                      {ROTULO_FORMATO[f]}
                    </span>
                    <span className="mt-1 text-xs text-apagado">{DICA_FORMATO[f]}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="responsavel"
                placeholder="Quem conduz (ex.: Thais Souza)"
                aria-label="Quem conduz"
                maxLength={120}
                className="campo-texto"
              />
              <input
                name="descricao"
                placeholder="Sobre o que é (aparece na inscrição)"
                aria-label="Descrição"
                maxLength={500}
                className="campo-texto"
              />
            </div>
          )}

          <button type="submit" disabled={ocupado} className="botao-primario">
            {ocupado ? (
              <>
                <Girando />
                Salvando...
              </>
            ) : (
              "Adicionar"
            )}
          </button>
        </form>
      </section>

      {ORDEM_TURNO.filter((t) => doEvento.some((e) => e.turno === t)).map((turno) => (
        <section key={turno} className="mb-5">
          <h2 className="titulo text-lg">{ROTULO_TURNO[turno]}</h2>
          <ul className="cartao mt-2 divide-y divide-linha">
            {doEvento
              .filter((e) => e.turno === turno)
              .map((e) => (
                <Linha
                  key={e.id}
                  esporte={e}
                  inscritos={ocupacao[e.id] ?? 0}
                  ocupado={ocupado}
                  aoSalvar={(mudanca) => chamar("PATCH", { id: e.id, ...mudanca })}
                  aoApagar={() => chamar("DELETE", { id: e.id })}
                />
              ))}
          </ul>
        </section>
      ))}

      {doEvento.length === 0 && (
        <div className="cartao flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nada cadastrado neste evento ainda.</p>
        </div>
      )}
    </>
  );
}

function LimitePorTurno({ evento }: { evento: Evento }) {
  const router = useRouter();
  const [valor, setValor] = useState(evento.max_esportes_por_turno ?? 0);
  const [salvando, setSalvando] = useState(false);

  async function salvar(novo: number) {
    setValor(novo);
    setSalvando(true);
    await fetch("/api/admin/evento", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: evento.id, maxEsportesPorTurno: novo }),
    });
    setSalvando(false);
    router.refresh();
  }

  return (
    <section className="cartao mb-6 p-5">
      <h2 className="titulo text-lg">Esportes por turno</h2>
      <p className="mt-1 text-sm text-apagado">
        Quantos esportes cada pessoa pode escolher no mesmo turno. Oficina é sempre uma por turno — ninguém está em
        dois estudos ao mesmo tempo.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            disabled={salvando}
            onClick={() => salvar(n)}
            aria-pressed={valor === n}
            className={`rounded-[10px] border-2 px-4 py-2 text-sm font-semibold ${
              valor === n ? "border-laranja bg-laranja/10 text-laranja-escuro" : "border-linha text-tinta"
            }`}
          >
            {n === 0 ? "Sem limite" : `Até ${n}`}
          </button>
        ))}
      </div>
    </section>
  );
}

function Linha({
  esporte,
  inscritos,
  ocupado,
  aoSalvar,
  aoApagar,
}: {
  esporte: Esporte;
  inscritos: number;
  ocupado: boolean;
  aoSalvar: (m: Record<string, unknown>) => Promise<boolean>;
  aoApagar: () => Promise<boolean>;
}) {
  const oficina = esporte.categoria === "oficina";
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(esporte.nome);
  const [vagas, setVagas] = useState(esporte.vagas);
  const [turno, setTurno] = useState<Turno>(esporte.turno);
  const [formato, setFormato] = useState<FormatoModalidade>(esporte.formato ?? "individual");
  const [responsavel, setResponsavel] = useState(esporte.responsavel ?? "");
  const [descricao, setDescricao] = useState(esporte.descricao ?? "");

  if (!editando) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-tinta">{esporte.nome}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                oficina ? "bg-ok/10 text-ok" : "bg-laranja/10 text-laranja-escuro"
              }`}
            >
              {oficina ? "Oficina" : ROTULO_FORMATO[esporte.formato ?? "individual"]}
            </span>
          </span>
          <span className="block text-xs text-apagado">
            {inscritos}/{esporte.vagas} vagas
            {oficina && esporte.responsavel && ` · com ${esporte.responsavel}`}
          </span>
          {esporte.descricao && <span className="block text-xs text-apagado">{esporte.descricao}</span>}
        </span>
        <span className="flex shrink-0 flex-wrap gap-3">
          <Link
            href={`/diretoria/modalidades/${esporte.id}`}
            className="font-semibold text-tinta hover:underline"
          >
            {esporte.formato === "time_sorteado" ? "Inscritos e times" : "Inscritos"}
          </Link>
          <button type="button" onClick={() => setEditando(true)} className="font-semibold text-laranja-escuro hover:underline">
            Editar
          </button>
          <button
            type="button"
            disabled={ocupado || inscritos > 0}
            title={inscritos > 0 ? "Tem gente inscrita" : undefined}
            onClick={aoApagar}
            className="font-semibold text-ruim hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            Apagar
          </button>
        </span>
      </li>
    );
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" className="campo-texto" />
        <select value={turno} onChange={(e) => setTurno(e.target.value as Turno)} aria-label="Turno" className="campo-texto">
          {ORDEM_TURNO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TURNO[t]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={Math.max(inscritos, 1)}
          value={vagas}
          onChange={(e) => setVagas(Number(e.target.value))}
          aria-label="Vagas"
          className="campo-texto"
        />
      </div>

      {oficina ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Quem conduz"
            aria-label="Quem conduz"
            className="campo-texto"
          />
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Sobre o que é"
            aria-label="Descrição"
            className="campo-texto"
          />
        </div>
      ) : (
        <select
          value={formato}
          disabled={inscritos > 0}
          onChange={(e) => setFormato(e.target.value as FormatoModalidade)}
          aria-label="Formato"
          title={inscritos > 0 ? "Com gente inscrita o formato não muda" : undefined}
          className="campo-texto"
        >
          {(Object.keys(ROTULO_FORMATO) as FormatoModalidade[]).map((f) => (
            <option key={f} value={f}>
              {ROTULO_FORMATO[f]} — {DICA_FORMATO[f]}
            </option>
          ))}
        </select>
      )}

      <span className="flex gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            const mudanca = oficina
              ? { nome, vagas, turno, responsavel: responsavel || null, descricao: descricao || null }
              : { nome, vagas, turno, ...(inscritos === 0 && { formato, categoria: "esporte" }) };
            if (await aoSalvar(mudanca)) setEditando(false);
          }}
          className="botao-primario px-4 py-2 text-sm"
        >
          Salvar
        </button>
        <button type="button" onClick={() => setEditando(false)} className="botao-secundario px-4 py-2 text-sm">
          Cancelar
        </button>
      </span>
    </li>
  );
}
