"use client";

import { useState } from "react";
import Link from "next/link";
import { Campo } from "@/components/Campo";
import { Girando } from "@/components/Girando";
import { ProvedorJuca } from "@/components/juca/contexto";
import { JucaCanto } from "@/components/juca/Ancora";

export default function EsqueciSenha() {
  return (
    <ProvedorJuca>
      <Miolo />
    </ProvedorJuca>
  );
}

function Miolo() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErro("Esse e-mail não parece certo.");
      return;
    }

    setEnviando(true);
    try {
      const r = await fetch("/api/auth/esqueci-senha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!r.ok) throw new Error();
      setEnviado(true);
    } catch {
      setErro("Não deu para enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="cartao p-7 text-center">
          <img src="/juca/heh.webp" alt="" className="mx-auto mb-4 w-28" />
          <h1 className="titulo text-2xl">Confira seu e-mail</h1>
          {/*
            A mesma mensagem existindo a conta ou não: dizer "não encontrado"
            deixaria qualquer um descobrir quem está cadastrado.
          */}
          <p className="mx-auto mt-2 max-w-sm text-apagado">
            Se <strong>{email.trim().toLowerCase()}</strong> tiver conta na JUBIG, o link para trocar
            a senha acabou de sair. Ele vale por 1 hora.
          </p>
          <p className="mt-4 text-sm text-apagado">
            Não chegou em alguns minutos? Confira o spam e se o e-mail foi digitado certo.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => setEnviado(false)} className="botao-secundario">
              Digitar outro e-mail
            </button>
            <Link href="/entrar" className="botao-primario">
              Voltar para entrar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl">Esqueci minha senha</h1>
      <p className="mt-2 text-apagado">
        Digite o e-mail da sua conta. Mandamos um link para você escolher uma senha nova.
      </p>

      <form onSubmit={pedir} className="mt-8 space-y-5" noValidate>
        <Campo
          rotulo="E-mail"
          tipo="email"
          valor={email}
          aoMudar={setEmail}
          erro={erro}
          obrigatorio
          autoComplete="email"
          estado="digitando"
          fala="O mesmo e-mail que você usa para entrar."
        />
        <button type="submit" disabled={enviando} aria-busy={enviando} className="botao-primario w-full">
          {enviando ? (
            <>
              <Girando />
              Enviando...
            </>
          ) : (
            "Enviar link"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-apagado">
        Lembrou?{" "}
        <Link href="/entrar" className="font-semibold text-laranja-escuro hover:underline">
          Entrar
        </Link>
      </p>

      <JucaCanto estado={erro ? "invalido" : "ocioso"} />
    </div>
  );
}
