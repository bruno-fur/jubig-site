"use client";

import { formatarCPF, formatarDataCurta, formatarTelefone } from "@/lib/validacao";
import { Girando } from "./Girando";
import { nomeDaEquipe, textoSobre } from "@/lib/equipes";
import { ROTULO_STATUS, type StatusInscricao } from "@/tipos/db";

export type DadosCartao = {
  ingresso: string;
  nome: string;
  cpf: string;
  nascimento: string;
  idade: number;
  telefone: string | null;
  igreja: string;
  deBoa: boolean;
  modalidades: string[];
  codigo: string;
  status: StatusInscricao;
  evento: string;
  responsavel: string | null;
  checkinEm: string | null;
  checkinPor: string | null;
  equipe?: { nome: string; cor: string } | null;
};

const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * O que a portaria vê ao ler um QR.
 *
 * O selo do topo é a primeira coisa lida, e em cor forte: na fila, com gente
 * esperando, ninguém lê parágrafo. Verde libera, laranja já entrou, vermelho
 * barra.
 */
export function CartaoPortaria({
  dados,
  registrando,
  aoRegistrar,
  liberadoAgora = false,
  semMoldura = false,
}: {
  dados: DadosCartao;
  registrando: boolean;
  aoRegistrar: () => void;
  /** A entrada acabou de ser registrada por quem está com o celular: verde, não "já entrou". */
  liberadoAgora?: boolean;
  /** Dentro da janela da validação, que já tem a própria moldura. */
  semMoldura?: boolean;
}) {
  const confirmada = dados.status === "confirmada";
  const jaEntrou = Boolean(dados.checkinEm);

  const selo = !confirmada
    ? { texto: `Não liberado · ${ROTULO_STATUS[dados.status]}`, cor: "bg-ruim text-white", juca: "nao" }
    : liberadoAgora
      ? { texto: "Entrada liberada", cor: "bg-ok text-white", juca: "joia" }
      : jaEntrou
        ? { texto: `Já entrou · ${hora(dados.checkinEm!)}`, cor: "bg-laranja text-white", juca: "choque" }
        : { texto: "Pode entrar — confira e libere", cor: "bg-ok text-white", juca: "feliz" };

  return (
    <article className={semMoldura ? "overflow-hidden" : "cartao overflow-hidden"} aria-live="polite">
      <div className={`flex items-center gap-3 px-5 py-4 ${selo.cor}`}>
        <img src={`/juca/${selo.juca}.webp`} alt="" className="h-12 w-12 object-contain" />
        <p className="titulo text-xl">{selo.texto}</p>
      </div>

      {/*
        Pulseira em faixa grande logo abaixo do selo: é o que quem está na
        porta fala em voz alta enquanto entrega a pulseira.
      */}
      {dados.equipe && (confirmada && (jaEntrou || liberadoAgora)) && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ background: dados.equipe.cor, color: textoSobre(dados.equipe.cor) }}
        >
          <span className="text-sm font-semibold uppercase tracking-wide">Pulseira</span>
          <span className="titulo text-3xl">{nomeDaEquipe(dados.equipe.nome)}</span>
        </div>
      )}

      <div className="p-5">
        <p className="titulo text-2xl leading-tight">{dados.nome}</p>
        <p className="text-apagado">
          {dados.igreja} · {dados.idade} anos
        </p>

        <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <Item rotulo="Evento" valor={dados.evento} />
          <Item rotulo="Inscrição" valor={dados.codigo} mono />
          <Item rotulo="CPF" valor={formatarCPF(dados.cpf)} mono />
          <Item rotulo="Nascimento" valor={formatarDataCurta(dados.nascimento)} />
          <Item rotulo="Telefone" valor={dados.telefone ? formatarTelefone(dados.telefone) : "—"} />
          <Item rotulo="Responsável" valor={dados.responsavel ?? "—"} />
          <Item
            rotulo="Modalidades"
            valor={dados.deBoa ? "vai só de boa" : dados.modalidades.join(", ") || "—"}
            largo
          />
          {jaEntrou && (
            <Item
              rotulo="Entrada registrada"
              valor={`${hora(dados.checkinEm!)}${dados.checkinPor ? ` por ${dados.checkinPor}` : ""}`}
              largo
            />
          )}
        </dl>

        {confirmada && !jaEntrou && (
          <button
            type="button"
            onClick={aoRegistrar}
            disabled={registrando}
            aria-busy={registrando}
            className="botao-primario mt-5 w-full bg-ok py-4 text-lg hover:bg-ok/85"
          >
            {registrando ? (
              <>
                <Girando />
                Liberando...
              </>
            ) : (
              "Liberar entrada"
            )}
          </button>
        )}
      </div>
    </article>
  );
}

function Item({
  rotulo,
  valor,
  mono,
  largo,
}: {
  rotulo: string;
  valor: string;
  mono?: boolean;
  largo?: boolean;
}) {
  return (
    <div className={largo ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-apagado">{rotulo}</dt>
      <dd className={`font-semibold text-tinta ${mono ? "font-mono" : ""}`}>{valor}</dd>
    </div>
  );
}
