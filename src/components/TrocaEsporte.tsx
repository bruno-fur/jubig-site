"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EscolhaEsportes } from "./EscolhaEsportes";
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
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState(atuais);
  const [soDeBoa, setSoDeBoa] = useState(deBoa);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!soDeBoa && escolhidos.length === 0) {
      setErro("Escolha ao menos uma modalidade ou marque “vou só de boa”.");
      return;
    }

    setSalvando(true);
    const r = await fetch(`/api/inscricoes/${codigo}/esportes`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inscritoId, esportes: soDeBoa ? [] : escolhidos, deBoa: soDeBoa }),
    });
    const corpo = await r.json().catch(() => ({}));
    setSalvando(false);

    if (!r.ok) {
      setErro(
        {
          prazo_encerrado: `A troca fechou em ${prazo}.`,
          modalidade_lotada: "Essa modalidade lotou. Escolha outra.",
          limite_no_turno: "Passou do limite de modalidades no turno.",
          nao_encontrado: "Inscrição não encontrada.",
        }[corpo.erro as string] ?? "Não deu para salvar agora."
      );
      return;
    }

    setAberto(false);
    router.refresh();
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
        erro={erro ?? undefined}
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
        <button type="button" onClick={() => setAberto(false)} className="botao-secundario px-4 py-2 text-sm">
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="botao-primario px-4 py-2 text-sm"
        >
          {salvando ? "Salvando..." : "Salvar troca"}
        </button>
      </div>
    </div>
  );
}
