"use client";

import { useState } from "react";
import { Girando } from "./Girando";

type Props = {
  email: string;
  /** "topo" aparece fixo em todas as páginas; "bloqueio" substitui o formulário de inscrição. */
  variante?: "topo" | "bloqueio";
};

/**
 * Regra do projeto: enquanto o e-mail não estiver confirmado, o usuário vê este
 * aviso em TODAS as páginas logadas — desde o primeiro login — e não consegue
 * abrir nenhuma inscrição. Nada de descobrir isso só no fim do formulário.
 */
export function AvisoEmailNaoConfirmado({ email, variante = "topo" }: Props) {
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "limite" | "erro">(
    "parado"
  );

  async function reenviar() {
    setEstado("enviando");
    const r = await fetch("/api/auth/enviar-confirmacao", {
      method: "POST",
    });
    setEstado(r.ok ? "enviado" : r.status === 429 ? "limite" : "erro");
  }

  const rotulo = {
    parado: "Reenviar e-mail",
    enviando: "Enviando...",
    enviado: "E-mail reenviado",
    limite: "Espere um minuto",
    erro: "Tentar de novo",
  }[estado];

  const botao = (
    <button
      onClick={reenviar}
      disabled={estado === "enviando" || estado === "enviado"}
      aria-busy={estado === "enviando"}
      className="inline-flex items-center gap-2 rounded-[10px] border-2 border-laranja-escuro px-4 py-2 text-sm font-semibold text-laranja-escuro disabled:opacity-50"
    >
      {estado === "enviando" && <Girando />}
      {rotulo}
    </button>
  );

  if (variante === "bloqueio") {
    return (
      <div className="cartao p-7 text-center">
        <img src="/juca/nao.webp" alt="" className="mx-auto mb-4 w-28" />
        <h2 className="titulo text-2xl text-tinta">Confirme seu e-mail para continuar</h2>
        <p className="mx-auto mt-2 max-w-md text-apagado">
          As inscrições da JUBIG só abrem depois que você confirmar <strong>{email}</strong>. Abra a
          caixa de entrada e clique no link que enviamos.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {botao}
          <p className="text-sm text-apagado">
            {estado === "limite"
              ? "O Supabase limita um reenvio por minuto. Aguarde e tente de novo."
              : "Não chegou? Confira o spam ou a aba Promoções."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-40 border-b border-[#F2C4BE] bg-[#FBE6D5] print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <img
          src="/juca/nervoso.webp"
          alt=""
          className="h-9 w-9 rounded-full bg-areia object-cover"
        />
        <p className="min-w-0 flex-1 text-sm text-laranja-escuro">
          <strong>Falta confirmar seu e-mail.</strong> Enquanto isso você não consegue se inscrever
          em nenhum evento. Enviamos o link para {email}.
        </p>
        {botao}
      </div>
    </div>
  );
}
