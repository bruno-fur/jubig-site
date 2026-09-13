"use client";

import { useState } from "react";
import { Girando } from "./Girando";
import { Recado } from "./Recado";
import { useAcao } from "@/lib/useAcao";

const MENSAGEM: Record<string, string> = {
  motivo_obrigatorio: "Escreva o motivo — ele vai no e-mail para a pessoa.",
  fale_com_diretoria:
    "Esta inscrição já foi paga. Para cancelar e combinar a devolução, fale com a diretoria no WhatsApp.",
  ja_cancelada: "Esta inscrição já estava cancelada.",
  nao_encontrada: "Inscrição não encontrada.",
};

/**
 * Cancelar com confirmação em dois passos: cancelamento não tem desfazer, e a
 * vaga volta para a fila na hora — numa modalidade quase lotada, outra pessoa
 * pode ocupar em minutos.
 */
export function CancelarInscricao({
  codigo,
  motivoObrigatorio,
  pessoas,
}: {
  codigo: string;
  /** diretoria cancelando a inscrição de outra pessoa */
  motivoObrigatorio: boolean;
  pessoas: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Inscrição cancelada." });

  const motivoCurto = motivoObrigatorio && motivo.trim().length < 5;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-sm font-semibold text-ruim hover:underline"
      >
        Cancelar inscrição
      </button>
    );
  }

  return (
    <div className="rounded-[16px] border border-ruim/30 bg-ruim/5 p-4">
      <p className="font-semibold text-ruim">Cancelar a inscrição {codigo}?</p>
      <p className="mt-1 text-sm text-tinta">
        {pessoas > 1 ? `As ${pessoas} pessoas saem` : "A pessoa sai"} do evento e as vagas voltam na
        hora. Não dá para desfazer — para voltar, é preciso se inscrever de novo.
      </p>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-semibold text-tinta">
          Motivo{motivoObrigatorio ? " *" : " (opcional)"}
        </span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={500}
          className="campo-texto"
        />
      </label>

      {acao.erro && (
        <div className="mt-3">
          <Recado erro={acao.erro} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={acao.ocupado || motivoCurto}
          onClick={() => acao.json(`/api/inscricoes/${codigo}/cancelar`, "POST", { motivo })}
          className="botao-primario bg-ruim hover:bg-ruim/85"
        >
          {acao.ocupado ? (
            <>
              <Girando />
              Cancelando...
            </>
          ) : (
            "Confirmar cancelamento"
          )}
        </button>
        <button
          type="button"
          disabled={acao.ocupado}
          onClick={() => {
            setAberto(false);
            acao.limpar();
          }}
          className="botao-secundario"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
