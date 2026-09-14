"use client";

import { useMemo, useState } from "react";
import { EscolhaEsportes } from "./EscolhaEsportes";
import { Girando } from "./Girando";
import { useAcao } from "@/lib/useAcao";
import { escolhaParaEnvio, problemaDaEscolha, rotuloModalidades } from "@/lib/modalidades";
import type { DetalheEscolha, Turno, VagaEsporte } from "@/tipos/db";

type Atual = { id: string; nota: number | null; parceiros: string[] | null };

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
  atuais: Atual[];
  deBoa: boolean;
  prazo: string;
  maxPorTurno?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState(() => atuais.map((a) => a.id));
  const [detalhes, setDetalhes] = useState<Record<string, DetalheEscolha>>(() =>
    Object.fromEntries(atuais.map((a) => [a.id, { nota: a.nota, parceiros: a.parceiros }]))
  );
  const [soDeBoa, setSoDeBoa] = useState(deBoa);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const porId = useMemo(
    () => new Map(grupos.flatMap(([, lista]) => lista).map((m) => [m.esporte_id, m])),
    [grupos]
  );
  const rotulo = rotuloModalidades([...porId.values()]);

  const acao = useAcao({
    mensagens: {
      prazo_encerrado: `A troca fechou em ${prazo}.`,
      modalidade_lotada: "Essa modalidade lotou. Escolha outra.",
      limite_no_turno: "Passou do limite de esportes no turno.",
      nota_obrigatoria: "Falta a nota de habilidade no esporte com time sorteado.",
      parceiros_obrigatorios: "Faltam os nomes dos parceiros na dupla ou no trio.",
      oficina_mesmo_turno: "Só dá para fazer uma oficina por turno.",
      nao_encontrado: "Inscrição não encontrada.",
    },
  });

  async function salvar() {
    setErroLocal(null);
    if (!soDeBoa && escolhidos.length === 0) {
      setErroLocal(`Escolha ao menos uma ${rotulo.singular} ou marque “${rotulo.deBoa}”.`);
      return;
    }
    if (!soDeBoa) {
      const problema = escolhidos
        .map((id) => {
          const m = porId.get(id);
          return m ? problemaDaEscolha(m, detalhes[id]) : null;
        })
        .find(Boolean);
      if (problema) {
        setErroLocal(problema);
        return;
      }
    }

    const { ok } = await acao.json(`/api/inscricoes/${codigo}/esportes`, "PATCH", {
      inscritoId,
      escolhas: soDeBoa
        ? []
        : escolhidos.map((id) => escolhaParaEnvio(id, porId.get(id) ?? { nome: "" }, detalhes[id])),
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
        Trocar {rotulo.singular}
      </button>
    );
  }

  return (
    <div className="mt-3">
      <EscolhaEsportes
        titulo={nome}
        grupos={grupos}
        escolhidos={escolhidos}
        detalhes={detalhes}
        deBoa={soDeBoa}
        maxPorTurno={maxPorTurno}
        erro={erroLocal ?? acao.erro ?? undefined}
        aoEscolher={(ids) => {
          setEscolhidos(ids);
          setSoDeBoa(false);
        }}
        aoDetalhar={(id, d) => setDetalhes((atual) => ({ ...atual, [id]: d }))}
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
        <button type="button" onClick={salvar} disabled={acao.ocupado} className="botao-primario px-4 py-2 text-sm">
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
