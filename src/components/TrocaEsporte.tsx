"use client";

import { useState } from "react";
import { EscolhaEsportes } from "./EscolhaEsportes";
import { Girando } from "./Girando";
import { useAcao } from "@/lib/useAcao";
import type { Turno, VagaEsporte } from "@/tipos/db";

export function TrocaEsporte({
  codigo,
  inscritoId,
  nome,
  grupos,
  atuais,
  deBoa,
  prazo,
  maxPorTurno,
}: {
  codigo: string;
  inscritoId: string;
  nome: string;
  grupos: [Turno, VagaEsporte[]][];
  atuais: string[];
  deBoa: boolean;
  prazo: string;
  maxPorTurno?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState(atuais);
  const [soDeBoa, setSoDeBoa] = useState(deBoa);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const acao = useAcao({
    mensagens: {
      prazo_encerrado: `A troca fechou em ${prazo}.`,
      modalidade_lotada: "Essa modalidade lotou. Escolha outra.",
      limite_no_turno: "Passou do limite de modalidades no turno.",
      nao_encontrado: "Inscrição não encontrada.",
    },
  });

  async function salvar() {
    setErroLocal(null);
    if (!soDeBoa && escolhidos.length === 0) {
      setErroLocal("Escolha ao menos uma modalidade ou marque “vou só de boa”.");
      return;
    }

    const { ok } = await acao.json(`/api/inscricoes/${codigo}/esportes`, "PATCH", {
      inscritoId,
      esportes: soDeBoa ? [] : escolhidos,
      deBoa: soDeBoa,
    });
    if (ok) setAberto(false);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 text-sm font-semibold text-laranja-escuro hover:underline"
      >
        Trocar de modalidade
      </button>
    );
  }

  return (
    <div className="mt-3">
      <EscolhaEsportes
        titulo={nome}
        grupos={grupos}
        escolhidos={escolhidos}
        deBoa={soDeBoa}
        maxPorTurno={maxPorTurno}
        erro={erroLocal ?? acao.erro ?? undefined}
        aoEscolher={(ids) => {
          setEscolhidos(ids);
          setSoDeBoa(false);
        }}
        aoMarcarDeBoa={(v) => {
          setSoDeBoa(v);
          if (v) setEscolhidos([]);
        }}
      />
      <p className="mt-2 text-xs text-apagado">Dá para trocar até {prazo}.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={acao.ocupado}
          onClick={() => setAberto(false)}
          className="botao-secundario px-4 py-2 text-sm"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={acao.ocupado}
          className="botao-primario px-4 py-2 text-sm"
        >
          {acao.ocupado ? (
            <>
              <Girando />
              {acao.atualizando ? "Atualizando..." : "Salvando..."}
            </>
          ) : (
            "Salvar troca"
          )}
        </button>
      </div>
    </div>
  );
}
