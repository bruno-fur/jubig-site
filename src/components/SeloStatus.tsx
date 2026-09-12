import { ROTULO_STATUS, type StatusInscricao } from "@/tipos/db";

const ESTILO: Record<StatusInscricao, string> = {
  aguardando_pagamento: "bg-laranja/10 text-laranja-escuro",
  em_analise: "bg-areia text-apagado",
  confirmada: "bg-ok/10 text-ok",
  recusada: "bg-ruim/10 text-ruim",
  cancelada: "bg-tinta/10 text-apagado",
};

export function SeloStatus({ status }: { status: StatusInscricao }) {
  return (
    <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${ESTILO[status]}`}>
      {ROTULO_STATUS[status]}
    </span>
  );
}
