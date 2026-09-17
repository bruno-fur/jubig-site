"use client";

import { useState } from "react";
import Link from "next/link";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { formatarReais, idadeNaData, validarCPF } from "@/lib/validacao";
import { NOTAS, parceirosNecessarios, precisaNota, problemaDaEscolha } from "@/lib/modalidades";
import {
  ORDEM_TURNO,
  ROTULO_FORMA,
  ROTULO_TURNO,
  type CategoriaModalidade,
  type DetalheEscolha,
  type FormaPagamento,
  type FormatoModalidade,
  type OpcaoIgreja,
  type Turno,
} from "@/tipos/db";

type ModalidadeBalcao = {
  id: string;
  nome: string;
  turno: Turno;
  categoria?: CategoriaModalidade;
  formato?: FormatoModalidade;
  restantes: number;
};

export type EventoBalcao = {
  slug: string;
  nome: string;
  dataEvento: string;
  idadeMinima: number;
  valorCentavos: number;
  maxPorTurno: number;
  modalidades: ModalidadeBalcao[];
};

type Pessoa = {
  chave: string;
  nome: string;
  cpf: string;
  nascimento: string;
  telefone: string;
  igrejaId: string;
  esportes: string[];
  detalhes: Record<string, DetalheEscolha>;
};

const MENSAGEM: Record<string, string> = {
  sem_permissao: "Só a diretoria inscreve pelo balcão.",
  cpf_invalido: "CPF inválido. Confira os números com a pessoa.",
  cpf_repetido: "Esse CPF já está inscrito neste evento.",
  igreja_invalida: "Escolha a igreja na lista.",
  idade_minima: "Essa pessoa é nova demais para este evento.",
  evento_lotado: "As vagas do evento acabaram.",
  evento_sem_inscricao: "Esse evento não tem inscrição.",
  escolha_incompleta: "Falta a nota ou o nome do parceiro em alguma modalidade.",
  oficina_mesmo_turno: "Só uma oficina por turno.",
  pedido_invalido: "Confira os campos: nome completo, CPF, nascimento e igreja.",
  falha_ao_gravar: "Não deu para salvar. Confira se o schema.sql mais recente já foi aplicado no Supabase.",
};

const vazia = (): Pessoa => ({
  chave: crypto.randomUUID(),
  nome: "",
  cpf: "",
  nascimento: "",
  telefone: "",
  igrejaId: "",
  esportes: [],
  detalhes: {},
});

export function FormularioBalcao({ eventos, igrejas }: { eventos: EventoBalcao[]; igrejas: OpcaoIgreja[] }) {
  const acao = useAcao({ mensagens: MENSAGEM, recarregar: false });
  const [slug, setSlug] = useState(eventos[0].slug);
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pessoas, setPessoas] = useState<Pessoa[]>([vazia()]);
  const [pronto, setPronto] = useState<string | null>(null);
  /** Erro conferido aqui mesmo, antes de chamar a API. */
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const evento = eventos.find((e) => e.slug === slug)!;
  const total = evento.valorCentavos * pessoas.length;
  const valorCentavos = valor.trim() ? Math.round(Number(valor.replace(",", ".")) * 100) : null;

  const trocar = (chave: string, campo: keyof Pessoa, v: unknown) =>
    setPessoas((atual) => atual.map((p) => (p.chave === chave ? { ...p, [campo]: v } : p)));

  function marcarEsporte(p: Pessoa, m: ModalidadeBalcao, marcado: boolean) {
    const esportes = marcado ? [...p.esportes, m.id] : p.esportes.filter((x) => x !== m.id);
    trocar(p.chave, "esportes", esportes);
  }

  function detalhe(p: Pessoa, id: string, d: DetalheEscolha) {
    trocar(p.chave, "detalhes", { ...p.detalhes, [id]: { ...p.detalhes[id], ...d } });
  }

  /** Mesma conferência da inscrição pelo site, para o erro aparecer no campo certo. */
  function problema(): string | null {
    for (const p of pessoas) {
      if (p.nome.trim().split(/\s+/).length < 2) return `Escreva o nome completo de ${p.nome || "quem está na frente"}.`;
      if (!validarCPF(p.cpf)) return `CPF inválido em ${p.nome || "uma das pessoas"}.`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.nascimento)) return `Falta a data de nascimento de ${p.nome}.`;
      if (idadeNaData(p.nascimento, evento.dataEvento) < evento.idadeMinima)
        return `${p.nome} tem menos de ${evento.idadeMinima} anos na data do evento.`;
      if (!p.igrejaId) return `Escolha a igreja de ${p.nome}.`;
      for (const id of p.esportes) {
        const m = evento.modalidades.find((x) => x.id === id)!;
        const erro = problemaDaEscolha(m, p.detalhes[id]);
        if (erro) return `${p.nome}: ${erro}`;
      }
    }
    return null;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const erro = problema();
    setErroLocal(erro);
    if (erro) return;

    const { ok, dados } = await acao.json("/api/admin/inscricoes", "POST", {
      evento: slug,
      forma,
      valorCentavos,
      observacao: observacao || null,
      inscritos: pessoas.map((p) => ({
        nome: p.nome.trim(),
        cpf: p.cpf.replace(/\D/g, ""),
        nascimento: p.nascimento,
        telefone: p.telefone || null,
        igrejaId: p.igrejaId,
        deBoa: p.esportes.length === 0,
        esportes: p.esportes.map((id) => ({
          id,
          nota: p.detalhes[id]?.nota ?? null,
          parceiros: p.detalhes[id]?.parceiros?.filter((x) => x.trim()) ?? null,
        })),
      })),
    });

    if (ok) {
      setErroLocal(null);
      setPronto(String(dados.codigo));
      setPessoas([vazia()]);
      setValor("");
      setObservacao("");
    }
  }

  if (pronto) {
    return (
      <section className="cartao space-y-4 p-6">
        <div className="flex items-center gap-3">
          <img src="/juca/joia.webp" alt="" className="h-12 w-12 object-contain" />
          <div>
            <p className="titulo text-xl">Inscrição {pronto} confirmada</p>
            <p className="text-sm text-apagado">
              Paga em {ROTULO_FORMA[forma].toLowerCase()}. O ingresso com QR já pode ser aberto ou impresso.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/inscricoes/${pronto}/ingressos`} className="botao-primario">
            Abrir o ingresso
          </Link>
          <Link href={`/diretoria/inscricoes/${pronto}`} className="botao-secundario">
            Ver a inscrição
          </Link>
          <button type="button" onClick={() => setPronto(null)} className="botao-secundario">
            Inscrever outra pessoa
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <section className="cartao space-y-4 p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-tinta">Evento</span>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="campo-texto">
            {eventos.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.nome} · {formatarReais(e.valorCentavos)} por pessoa
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-tinta">Como pagou</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROTULO_FORMA) as FormaPagamento[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForma(f)}
                aria-pressed={forma === f}
                className={`rounded-[10px] border-2 px-4 py-2 text-sm font-semibold ${
                  forma === f ? "border-laranja bg-laranja/10 text-laranja-escuro" : "border-linha text-tinta"
                }`}
              >
                {ROTULO_FORMA[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-tinta">Valor recebido</span>
            <input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={(total / 100).toFixed(2).replace(".", ",")}
              className="campo-texto"
            />
            <span className="mt-1 block text-xs text-apagado">
              Vazio = {formatarReais(total)} ({pessoas.length} × {formatarReais(evento.valorCentavos)}). Mude só se
              houve desconto combinado.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-tinta">Observação</span>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={300}
              placeholder="Ex.: pagou no cartão, maquininha da tesouraria"
              className="campo-texto"
            />
          </label>
        </div>
      </section>

      {pessoas.map((p, i) => (
        <section key={p.chave} className="cartao space-y-4 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="titulo text-lg">{p.nome.trim() || `Pessoa ${i + 1}`}</p>
            {pessoas.length > 1 && (
              <button
                type="button"
                onClick={() => setPessoas((atual) => atual.filter((x) => x.chave !== p.chave))}
                className="text-sm font-semibold text-ruim hover:underline"
              >
                Tirar
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Nome completo</span>
              <input
                value={p.nome}
                onChange={(e) => trocar(p.chave, "nome", e.target.value)}
                autoComplete="off"
                className="campo-texto"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">CPF</span>
              <input
                inputMode="numeric"
                value={p.cpf}
                onChange={(e) => trocar(p.chave, "cpf", e.target.value)}
                placeholder="000.000.000-00"
                className="campo-texto"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Nascimento</span>
              <input
                type="date"
                value={p.nascimento}
                onChange={(e) => trocar(p.chave, "nascimento", e.target.value)}
                className="campo-texto"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-tinta">Telefone (opcional)</span>
              <input
                inputMode="tel"
                value={p.telefone}
                onChange={(e) => trocar(p.chave, "telefone", e.target.value)}
                placeholder="+55 45 99811-2434"
                className="campo-texto"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-tinta">Igreja</span>
            <select
              value={p.igrejaId}
              onChange={(e) => trocar(p.chave, "igrejaId", e.target.value)}
              className="campo-texto"
            >
              <option value="">Escolha a igreja</option>
              {igrejas.map((ig) => (
                <option key={ig.id} value={ig.id}>
                  {ig.nome} · {ig.cidade}
                </option>
              ))}
            </select>
          </label>

          {evento.modalidades.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-tinta">
                Modalidades <span className="font-normal text-apagado">— sem marcar nada, entra como &quot;só de boa&quot;</span>
              </legend>
              <div className="space-y-3">
                {ORDEM_TURNO.filter((t) => evento.modalidades.some((m) => m.turno === t)).map((turno) => (
                  <div key={turno}>
                    <p className="text-xs font-semibold text-apagado uppercase">{ROTULO_TURNO[turno]}</p>
                    <div className="mt-1 space-y-2">
                      {evento.modalidades
                        .filter((m) => m.turno === turno)
                        .map((m) => {
                          const marcado = p.esportes.includes(m.id);
                          const quantos = parceirosNecessarios(m);
                          return (
                            <div key={m.id} className="rounded-[10px] border border-linha p-2.5">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  disabled={!marcado && m.restantes <= 0}
                                  onChange={(e) => marcarEsporte(p, m, e.target.checked)}
                                />
                                <span className="font-semibold text-tinta">{m.nome}</span>
                                <span className={m.restantes <= 0 ? "text-ruim" : "text-apagado"}>
                                  {m.restantes <= 0 ? "lotada" : `${m.restantes} vagas`}
                                </span>
                              </label>

                              {marcado && precisaNota(m) && (
                                <select
                                  value={p.detalhes[m.id]?.nota ?? ""}
                                  onChange={(e) => detalhe(p, m.id, { nota: Number(e.target.value) || null })}
                                  aria-label={`Habilidade em ${m.nome}`}
                                  className="campo-texto mt-2 py-1.5 text-sm"
                                >
                                  <option value="">Como joga?</option>
                                  {NOTAS.map(([n, texto]) => (
                                    <option key={n} value={n}>
                                      {n} — {texto}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {marcado && quantos > 0 && (
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {Array.from({ length: quantos }, (_, k) => (
                                    <input
                                      key={k}
                                      value={p.detalhes[m.id]?.parceiros?.[k] ?? ""}
                                      onChange={(e) => {
                                        const atuais = [...(p.detalhes[m.id]?.parceiros ?? [])];
                                        atuais[k] = e.target.value;
                                        detalhe(p, m.id, { parceiros: atuais });
                                      }}
                                      placeholder={`Nome do parceiro ${quantos > 1 ? k + 1 : ""}`.trim()}
                                      aria-label={`Parceiro em ${m.nome}`}
                                      className="campo-texto py-1.5 text-sm"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
        </section>
      ))}

      <button
        type="button"
        onClick={() => setPessoas((atual) => [...atual, vazia()])}
        className="botao-secundario"
      >
        + Outra pessoa na mesma inscrição
      </button>

      <Recado erro={erroLocal ?? acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />

      <div className="cartao flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-apagado">
          {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"} ·{" "}
          <strong className="text-tinta">{formatarReais(valorCentavos ?? total)}</strong> em{" "}
          {ROTULO_FORMA[forma].toLowerCase()}
        </p>
        <button type="submit" disabled={acao.ocupado} className="botao-primario">
          {acao.ocupado && <Girando />}
          Confirmar inscrição
        </button>
      </div>
    </form>
  );
}
