"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ORDEM_TURNO, ROTULO_TURNO, type Esporte, type Evento, type Turno } from "@/tipos/db";

type Props = {
  eventos: Evento[];
  esportes: Esporte[];
  /** esporte_id -> quantas pessoas já escolheram */
  ocupacao: Record<string, number>;
};

const MENSAGEM: Record<string, string> = {
  tem_inscritos: "Já tem gente inscrita nessa modalidade. Zere as vagas em vez de apagar.",
  sem_permissao: "Só administrador mexe nas modalidades.",
  pedido_invalido: "Confira os campos.",
  falha_ao_gravar: "Não deu para salvar agora.",
};

export function GerenciarModalidades({ eventos, esportes, ocupacao }: Props) {
  const router = useRouter();
  const [eventoId, setEventoId] = useState(eventos[0]?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const evento = eventos.find((e) => e.id === eventoId);
  const doEvento = useMemo(
    () => esportes.filter((e) => e.evento_id === eventoId),
    [esportes, eventoId]
  );

  async function chamar(metodo: "POST" | "PATCH" | "DELETE", corpo: unknown) {
    setErro(null);
    setOcupado(true);
    const r = await fetch("/api/admin/modalidades", {
      method: metodo,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await r.json().catch(() => ({}));
    setOcupado(false);

    if (!r.ok) {
      setErro(MENSAGEM[dados.erro as string] ?? "Não deu para salvar agora.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function criar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const ok = await chamar("POST", {
      eventoId,
      nome: String(f.get("nome") ?? ""),
      turno: String(f.get("turno") ?? "manha"),
      vagas: Number(f.get("vagas") ?? 0),
      porEquipe: f.get("porEquipe") === "on",
      ordem: Number(f.get("ordem") ?? 0),
    });
    if (ok) ev.currentTarget.reset();
  }

  return (
    <>
      {eventos.length > 1 && (
        <select
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
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

      {erro && (
        <p role="alert" className="mb-4 rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
          {erro}
        </p>
      )}

      {evento && <LimitePorTurno evento={evento} />}

      <section className="cartao mb-6 p-5">
        <h2 className="titulo text-lg">Nova modalidade</h2>
        <form onSubmit={criar} className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input name="nome" required placeholder="Nome" className="campo-texto" maxLength={60} />
          <select name="turno" className="campo-texto" defaultValue="manha">
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
            defaultValue={20}
            required
            placeholder="Vagas"
            className="campo-texto"
          />
          <button type="submit" disabled={ocupado} className="botao-primario">
            Adicionar
          </button>
          <label className="flex items-center gap-2 text-sm text-apagado sm:col-span-4">
            <input name="porEquipe" type="checkbox" className="h-4 w-4 accent-[#D94C1A]" />
            Disputada por equipe
          </label>
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
          <p className="text-apagado">Nenhuma modalidade neste evento ainda.</p>
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
      <h2 className="titulo text-lg">Modalidades por turno</h2>
      <p className="mt-1 text-sm text-apagado">
        Quantas cada pessoa pode escolher no mesmo turno. O banco recusa o que passar disso.
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
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(esporte.nome);
  const [vagas, setVagas] = useState(esporte.vagas);
  const [turno, setTurno] = useState<Turno>(esporte.turno);

  if (!editando) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="min-w-0">
          <span className="block font-semibold text-tinta">{esporte.nome}</span>
          <span className="block text-xs text-apagado">
            {inscritos}/{esporte.vagas} vagas
            {esporte.por_equipe && " · por equipe"}
          </span>
        </span>
        <span className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="font-semibold text-laranja-escuro hover:underline"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={ocupado || inscritos > 0}
            title={inscritos > 0 ? "Tem gente inscrita nesta modalidade" : undefined}
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
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <input value={nome} onChange={(e) => setNome(e.target.value)} className="campo-texto" />
      <select
        value={turno}
        onChange={(e) => setTurno(e.target.value as Turno)}
        className="campo-texto"
      >
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
        className="campo-texto"
      />
      <span className="flex gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            if (await aoSalvar({ nome, vagas, turno })) setEditando(false);
          }}
          className="botao-primario px-4 py-2 text-sm"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="botao-secundario px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </span>
    </li>
  );
}
