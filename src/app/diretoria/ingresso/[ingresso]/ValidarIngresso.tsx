"use client";

import { useState } from "react";
import Link from "next/link";
import { CartaoPortaria, type DadosCartao } from "@/components/CartaoPortaria";
import { Recado } from "@/components/Recado";

const MENSAGEM: Record<string, string> = {
  ja_entrou: "Esse ingresso já tinha sido usado.",
  nao_confirmada: "A inscrição não está confirmada.",
  nao_encontrado: "Ingresso não encontrado.",
  sem_permissao: "Você não tem acesso à validação.",
};

/** Quem leu o QR com a câmera comum do celular cai aqui — mesmos passos da Validação. */
export function ValidarIngresso({ inicial }: { inicial: DadosCartao }) {
  const [dados, setDados] = useState(inicial);
  const [registrando, setRegistrando] = useState(false);
  const [liberadoAgora, setLiberadoAgora] = useState(false);
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
    if (r?.ok) setLiberadoAgora(true);
    else setErro(MENSAGEM[corpo.resultado ?? corpo.erro] ?? "Sem conexão. Tente de novo.");
  }

  return (
    <div className="space-y-4">
      {erro && <Recado erro={erro} />}
      <CartaoPortaria
        dados={dados}
        registrando={registrando}
        aoRegistrar={registrar}
        liberadoAgora={liberadoAgora}
      />
      <div className="grid grid-cols-2 gap-3">
        <Link href="/diretoria" className="botao-secundario py-4">
          Sair
        </Link>
        <Link href="/diretoria/validacao" className="botao-primario py-4">
          Próximo ingresso
        </Link>
      </div>
    </div>
  );
}
