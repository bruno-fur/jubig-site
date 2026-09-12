"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CountryCode } from "libphonenumber-js";
import { Campo } from "@/components/Campo";
import { CampoTelefone } from "@/components/CampoTelefone";
import { ProvedorJuca } from "@/components/juca/contexto";
import { JucaCanto } from "@/components/juca/Ancora";
import type { EstadoJuca } from "@/components/juca/Juca";
import { Etapas } from "@/components/Etapas";
import { EscolhaEsportes } from "@/components/EscolhaEsportes";
import { dataParaISO } from "@/lib/mascaras";
import { formatarReais, idadeNaData, nomeCompleto, validarCPF, dataValida } from "@/lib/validacao";
import type { VagaEsporte } from "@/tipos/db";

type EventoResumo = {
  slug: string;
  nome: string;
  dataEvento: string;
  idadeMinima: number;
  maxParcelas: number;
  valorCentavos: number;
};

type Pessoa = {
  chave: string;
  nome: string;
  cpf: string;
  nascimento: string;
  igreja: string;
  telefone: string;
  pais: CountryCode;
  e164: string | null;
  deBoa: boolean;
  esportes: string[];
};

const ETAPAS = ["Quem vai", "Esportes", "Conferir", "Pagamento"];

function pessoaVazia(igreja = ""): Pessoa {
  return {
    chave: crypto.randomUUID(),
    nome: "",
    cpf: "",
    nascimento: "",
    igreja,
    telefone: "",
    pais: "BR",
    e164: null,
    deBoa: false,
    esportes: [],
  };
}

export function FormularioInscricao(props: {
  evento: EventoResumo;
  grupos: [string, VagaEsporte[]][];
  vagasRestantes: number | null;
  perfil: { nome: string; igreja: string; telefone: string };
}) {
  return (
    <ProvedorJuca>
      <Miolo {...props} />
    </ProvedorJuca>
  );
}

function Miolo({
  evento,
  grupos,
  vagasRestantes,
  perfil,
}: {
  evento: EventoResumo;
  grupos: [string, VagaEsporte[]][];
  vagasRestantes: number | null;
  perfil: { nome: string; igreja: string; telefone: string };
}) {
  const router = useRouter();

  const [etapa, setEtapa] = useState(0);
  const [pessoas, setPessoas] = useState<Pessoa[]>(() => [
    { ...pessoaVazia(perfil.igreja), nome: perfil.nome },
  ]);
  const [parcelas, setParcelas] = useState(1);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const temEsportes = grupos.length > 0;
  const total = evento.valorCentavos * pessoas.length;
  const poucasVagas = vagasRestantes !== null && vagasRestantes > 0 && vagasRestantes <= 20;

  function mexer(i: number, mudanca: Partial<Pessoa>) {
    setPessoas((lista) => lista.map((p, j) => (j === i ? { ...p, ...mudanca } : p)));
  }

  function adicionar() {
    setPessoas((lista) => [...lista, pessoaVazia(lista[0]?.igreja ?? "")]);
  }

  function remover(i: number) {
    setPessoas((lista) => lista.filter((_, j) => j !== i));
  }

  /** Erros da etapa "Quem vai", indexados por `${i}.campo`. */
  function conferirPessoas() {
    const e: Record<string, string> = {};
    const cpfsVistos = new Map<string, number>();

    pessoas.forEach((p, i) => {
      if (!nomeCompleto(p.nome)) e[`${i}.nome`] = "Precisa do nome e do sobrenome.";

      const cpf = p.cpf.replace(/\D/g, "");
      if (cpf.length < 11) e[`${i}.cpf`] = "Faltam dígitos.";
      else if (!validarCPF(cpf)) e[`${i}.cpf`] = "Esse CPF não confere.";
      else if (cpfsVistos.has(cpf))
        e[`${i}.cpf`] = `Esse CPF já está na pessoa ${cpfsVistos.get(cpf)! + 1}.`;
      else cpfsVistos.set(cpf, i);

      const iso = dataParaISO(p.nascimento);
      if (!iso) e[`${i}.nascimento`] = "Data incompleta.";
      else if (!dataValida(iso)) e[`${i}.nascimento`] = "Essa data não existe.";
      else if (idadeNaData(iso, evento.dataEvento) < evento.idadeMinima)
        e[`${i}.nascimento`] = `Precisa ter ${evento.idadeMinima} anos na data do evento.`;

      if (p.igreja.trim().length < 3) e[`${i}.igreja`] = "De qual igreja?";
      if (p.telefone && !p.e164) e[`${i}.telefone`] = "Número incompleto para o país escolhido.";
    });

    setErros(e);
    return Object.keys(e).length === 0;
  }

  function conferirEsportes() {
    const e: Record<string, string> = {};
    pessoas.forEach((p, i) => {
      if (!p.deBoa && p.esportes.length === 0)
        e[`${i}.esportes`] = "Escolha ao menos uma modalidade ou marque “vou só de boa”.";
    });
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function avancar() {
    setErroGeral(null);
    if (etapa === 0 && !conferirPessoas()) return;
    if (etapa === 1 && temEsportes && !conferirEsportes()) return;
    setEtapa((n) => Math.min(n + 1, ETAPAS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function voltar() {
    setErroGeral(null);
    setEtapa((n) => Math.max(n - 1, 0));
  }

  async function enviar() {
    setErroGeral(null);
    setEnviando(true);

    const resposta = await fetch("/api/inscricoes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        evento: evento.slug,
        parcelas,
        inscritos: pessoas.map((p) => ({
          nome: p.nome.trim(),
          cpf: p.cpf.replace(/\D/g, ""),
          nascimento: dataParaISO(p.nascimento),
          telefone: p.e164 ?? "",
          igreja: p.igreja.trim(),
          deBoa: p.deBoa,
          esportes: p.deBoa ? [] : p.esportes,
        })),
      }),
    });

    const corpo = await resposta.json().catch(() => ({}));
    setEnviando(false);

    if (!resposta.ok) {
      setErroGeral(mensagemDeErro(corpo));
      // Erro de gente ou de CPF é na etapa 1; de modalidade, na 2.
      if (["nome_incompleto", "cpf_invalido", "cpf_repetido", "idade_minima", "cpf_ja_inscrito", "nascimento_invalido"].includes(corpo.erro))
        setEtapa(0);
      else if (["modalidade_lotada", "conflito_horario", "sem_escolha"].includes(corpo.erro))
        setEtapa(1);
      return;
    }

    router.push(`/inscricoes/${corpo.codigo}`);
    router.refresh();
  }

  /* O Juca do canto reage ao estado do formulário como um todo. */
  const estadoCanto: EstadoJuca = useMemo(() => {
    if (erroGeral) return "recusa";
    if (pessoas.length >= 4) return "exagero";
    if (poucasVagas) return "urgencia";
    return "ocioso";
  }, [erroGeral, pessoas.length, poucasVagas]);

  const falaCanto = useMemo(() => {
    if (erroGeral) return erroGeral;
    if (pessoas.length >= 4) return `${pessoas.length} pessoas! Caravana da pesada.`;
    if (poucasVagas) return `Só ${vagasRestantes} vagas restando!`;
    return undefined;
  }, [erroGeral, pessoas.length, poucasVagas, vagasRestantes]);

  return (
    <>
      <Etapas titulos={ETAPAS} atual={etapa} />

      {erroGeral && (
        <p role="alert" className="mt-6 rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
          {erroGeral}
        </p>
      )}

      {etapa === 0 && (
        <section className="mt-6 space-y-6">
          {pessoas.map((p, i) => (
            <FichaPessoa
              key={p.chave}
              indice={i}
              pessoa={p}
              erros={erros}
              podeRemover={pessoas.length > 1}
              aoMexer={(m) => mexer(i, m)}
              aoRemover={() => remover(i)}
            />
          ))}

          <button type="button" onClick={adicionar} className="botao-secundario w-full">
            + Adicionar outra pessoa
          </button>
          <p className="text-center text-sm text-apagado">
            Uma inscrição só para a caravana inteira da igreja. O pagamento é somado no fim.
          </p>
        </section>
      )}

      {etapa === 1 && (
        <section className="mt-6 space-y-6">
          {!temEsportes ? (
            <div className="cartao p-6 text-center text-apagado">
              Este evento ainda não tem modalidades cadastradas. Pode seguir.
            </div>
          ) : (
            pessoas.map((p, i) => (
              <EscolhaEsportes
                key={p.chave}
                titulo={p.nome.trim() || `Pessoa ${i + 1}`}
                grupos={grupos}
                escolhidos={p.esportes}
                deBoa={p.deBoa}
                erro={erros[`${i}.esportes`]}
                aoEscolher={(esportes) => mexer(i, { esportes, deBoa: false })}
                aoMarcarDeBoa={(deBoa) => mexer(i, { deBoa, esportes: deBoa ? [] : p.esportes })}
              />
            ))
          )}
        </section>
      )}

      {etapa === 2 && (
        <Conferencia
          evento={evento}
          pessoas={pessoas}
          grupos={grupos}
          parcelas={parcelas}
          aoTrocarParcelas={setParcelas}
          total={total}
        />
      )}

      <div className="mt-8 flex gap-3">
        {etapa > 0 && (
          <button type="button" onClick={voltar} className="botao-secundario">
            Voltar
          </button>
        )}
        {etapa < 2 ? (
          <button type="button" onClick={avancar} className="botao-primario flex-1">
            Continuar
          </button>
        ) : (
          <button type="button" onClick={enviar} disabled={enviando} className="botao-primario flex-1">
            {enviando ? "Registrando..." : `Registrar inscrição — ${formatarReais(total)}`}
          </button>
        )}
      </div>

      <JucaCanto estado={estadoCanto} fala={falaCanto} />
    </>
  );
}

function FichaPessoa({
  indice,
  pessoa,
  erros,
  podeRemover,
  aoMexer,
  aoRemover,
}: {
  indice: number;
  pessoa: Pessoa;
  erros: Record<string, string>;
  podeRemover: boolean;
  aoMexer: (m: Partial<Pessoa>) => void;
  aoRemover: () => void;
}) {
  const cpfLimpo = pessoa.cpf.replace(/\D/g, "");
  const cpfEstado: EstadoJuca =
    cpfLimpo.length === 0 ? "digitando" : cpfLimpo.length < 11 ? "incompleto" : validarCPF(cpfLimpo) ? "valido" : "invalido";

  return (
    <fieldset className="cartao p-5">
      <legend className="flex w-full items-center justify-between gap-3 px-1">
        <span className="titulo text-lg">
          {indice === 0 ? "Você" : `Pessoa ${indice + 1}`}
        </span>
        {podeRemover && (
          <button
            type="button"
            onClick={aoRemover}
            className="text-sm font-semibold text-ruim hover:underline"
          >
            Remover
          </button>
        )}
      </legend>

      <div className="mt-4 space-y-5">
        <Campo
          rotulo="Nome completo"
          valor={pessoa.nome}
          aoMudar={(nome) => aoMexer({ nome })}
          erro={erros[`${indice}.nome`]}
          obrigatorio
          autoComplete={indice === 0 ? "name" : "off"}
          estado={nomeCompleto(pessoa.nome) ? "valido" : "digitando"}
          fala={nomeCompleto(pessoa.nome) ? "Anotado!" : "Nome e sobrenome."}
        />

        <Campo
          rotulo="CPF"
          tipo="cpf"
          valor={pessoa.cpf}
          aoMudar={(cpf) => aoMexer({ cpf })}
          erro={erros[`${indice}.cpf`]}
          obrigatorio
          estado={cpfEstado}
          fala={
            cpfEstado === "valido"
              ? "CPF confere!"
              : cpfEstado === "incompleto"
                ? `Faltam ${11 - cpfLimpo.length} dígitos.`
                : "Só os números."
          }
          dica="Serve para não inscrever a mesma pessoa duas vezes."
        />

        <Campo
          rotulo="Data de nascimento"
          tipo="data"
          valor={pessoa.nascimento}
          aoMudar={(nascimento) => aoMexer({ nascimento })}
          erro={erros[`${indice}.nascimento`]}
          obrigatorio
          placeholder="dd/mm/aaaa"
          estado={dataParaISO(pessoa.nascimento) ? "valido" : "incompleto"}
          fala="A idade conta na data do evento."
        />

        <Campo
          rotulo="Igreja"
          valor={pessoa.igreja}
          aoMudar={(igreja) => aoMexer({ igreja })}
          erro={erros[`${indice}.igreja`]}
          obrigatorio
          estado={pessoa.igreja.trim().length >= 3 ? "valido" : "digitando"}
          fala="Qual igreja representa?"
        />

        <CampoTelefone
          valor={pessoa.telefone}
          pais={pessoa.pais}
          erro={erros[`${indice}.telefone`]}
          aoMudar={(telefone, pais, e164) => aoMexer({ telefone, pais, e164 })}
        />
      </div>
    </fieldset>
  );
}

function Conferencia({
  evento,
  pessoas,
  grupos,
  parcelas,
  aoTrocarParcelas,
  total,
}: {
  evento: EventoResumo;
  pessoas: Pessoa[];
  grupos: [string, VagaEsporte[]][];
  parcelas: number;
  aoTrocarParcelas: (n: number) => void;
  total: number;
}) {
  const nomeDoEsporte = useMemo(() => {
    const mapa = new Map<string, string>();
    grupos.forEach(([horario, lista]) =>
      lista.forEach((e) => mapa.set(e.esporte_id, `${e.nome} (${horario})`))
    );
    return mapa;
  }, [grupos]);

  return (
    <section className="mt-6 space-y-5">
      <div className="cartao divide-y divide-linha">
        {pessoas.map((p, i) => (
          <div key={p.chave} className="p-5">
            <p className="titulo text-lg">{p.nome.trim() || `Pessoa ${i + 1}`}</p>
            <p className="mt-1 text-sm text-apagado">
              {p.cpf} · {p.nascimento} · {p.igreja}
            </p>
            <p className="mt-2 text-sm">
              {p.deBoa ? (
                <span className="text-apagado">Vai só de boa, sem competir.</span>
              ) : (
                p.esportes.map((id) => nomeDoEsporte.get(id) ?? id).join(", ")
              )}
            </p>
          </div>
        ))}
      </div>

      {evento.maxParcelas > 1 && (
        <div className="cartao p-5">
          <p className="titulo text-lg">Como quer pagar?</p>
          <p className="mt-1 text-sm text-apagado">
            O PIX não parcela sozinho: cada parcela é um pagamento e um comprovante separados.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: evento.maxParcelas }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => aoTrocarParcelas(n)}
                aria-pressed={parcelas === n}
                className={`rounded-[10px] border-2 px-4 py-2 text-sm font-semibold ${
                  parcelas === n
                    ? "border-laranja bg-laranja/10 text-laranja-escuro"
                    : "border-linha text-tinta"
                }`}
              >
                {n === 1 ? "À vista" : `${n}x de ${formatarReais(Math.ceil(total / n))}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cartao flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-apagado">
            {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"} ·{" "}
            {formatarReais(evento.valorCentavos)} cada
          </p>
          <p className="titulo text-2xl">{formatarReais(total)}</p>
        </div>
        <img src="/juca/joia.webp" alt="" className="w-16" />
      </div>
    </section>
  );
}

function mensagemDeErro(corpo: { erro?: string; inscrito?: string; minima?: number; mensagem?: string }) {
  const quem = corpo.inscrito ? ` (${corpo.inscrito})` : "";
  switch (corpo.erro) {
    case "email_nao_confirmado":
      return "Confirme seu e-mail antes de se inscrever.";
    case "nome_incompleto":
      return `Falta o sobrenome${quem}.`;
    case "cpf_invalido":
      return `CPF inválido${quem}.`;
    case "cpf_repetido":
      return `Esse CPF aparece duas vezes na mesma inscrição${quem}.`;
    case "cpf_ja_inscrito":
      return "Um dos CPFs já está inscrito neste evento.";
    case "nascimento_invalido":
      return `Data de nascimento inválida${quem}.`;
    case "idade_minima":
      return `Idade mínima de ${corpo.minima ?? 12} anos na data do evento${quem}.`;
    case "sem_escolha":
      return `Falta escolher a modalidade ou marcar "vou só de boa"${quem}.`;
    case "modalidade_lotada":
      return "Uma das modalidades lotou enquanto você preenchia. Escolha outra.";
    case "conflito_horario":
      return "Tem duas modalidades no mesmo horário.";
    case "evento_lotado":
      return "As vagas do evento acabaram.";
    case "inscricoes_encerradas":
      return "As inscrições deste evento já fecharam.";
    case "parcelas_acima_do_limite":
      return "Esse número de parcelas não vale para este evento.";
    default:
      return "Não deu para registrar agora. Tente de novo em instantes.";
  }
}
