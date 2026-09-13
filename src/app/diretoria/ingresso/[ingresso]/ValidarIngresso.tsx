"use client";

import { useState } from "react";
import Link from "next/link";
import { CartaoPortaria, type DadosCartao } from "@/components/CartaoPortaria";
import { Recado } from "@/components/Recado";

const MENSAGEM: Record<string, string> = {
  ja_entrou: "Esse ingresso já tinha sido usado.",
  nao_confirmada: "A inscrição não está confirmada.",
  nao_encontrado: "Ingresso não encontrado.",
  sem_permissao: "Você não tem acesso à portaria.",
};

export function ValidarIngresso({ inicial }: { inicial: DadosCartao }) {
  const [dados, setDados] = useState(inicial);
  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function registrar() {
    setErro(null);
    setRegistrando(true);
    const r = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ingresso: dados.ingresso }),
    }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setRegistrando(false);

    if (corpo.dados) setDados(corpo.dados);
    if (!r?.ok) setErro(MENSAGEM[corpo.resultado ?? corpo.erro] ?? "Sem conexão. Tente de novo.");
  }

  return (
    <div className="space-y-4">
      {erro && <Recado erro={erro} />}
      <CartaoPortaria dados={dados} registrando={registrando} aoRegistrar={registrar} />
      <Link href="/diretoria/portaria" className="botao-secundario w-full">
        Ler o próximo
      </Link>
    </div>
  );
}
