"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { Campo } from "@/components/Campo";
import { ProvedorJuca } from "@/components/juca/contexto";
import { JucaCanto } from "@/components/juca/Ancora";

export function FormularioEntrar({ proximo }: { proximo: string }) {
  return (
    <ProvedorJuca>
      <Miolo proximo={proximo} />
    </ProvedorJuca>
  );
}

function Miolo({ proximo }: { proximo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);

    if (error) {
      /*
       * Este é o momento em que a pessoa descobre a pendência: no login,
       * nunca no fim do formulário de inscrição. Manda direto para a tela que
       * explica e reenvia o link.
       */
      if (/email not confirmed|not confirmed/i.test(error.message)) {
        router.push(`/confirmar-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setErro(
        /invalid login/i.test(error.message)
          ? "E-mail ou senha não conferem."
          : "Não deu para entrar agora. Tente de novo em instantes."
      );
      return;
    }

    // refresh() para o layout reler a sessão e o cabeçalho trocar na hora.
    router.push(proximo);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={entrar} className="mt-8 space-y-5">
        <Campo
          rotulo="E-mail"
          tipo="email"
          valor={email}
          aoMudar={setEmail}
          autoComplete="email"
          obrigatorio
          estado="digitando"
          fala="Use o mesmo e-mail de sempre."
        />
        <Campo
          rotulo="Senha"
          tipo="senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="current-password"
          obrigatorio
          estado="digitando"
          fala="Não conto pra ninguém."
        />

        {erro && (
          <p role="alert" className="rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
            {erro}
          </p>
        )}

        <button type="submit" disabled={enviando} className="botao-primario w-full">
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <JucaCanto estado={erro ? "recusa" : "ocioso"} fala={erro ? "Vish..." : undefined} />
    </>
  );
}
