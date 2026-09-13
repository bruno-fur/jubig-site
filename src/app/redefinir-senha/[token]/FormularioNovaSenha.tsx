"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Campo } from "@/components/Campo";
import { Girando } from "@/components/Girando";
import { ProvedorJuca } from "@/components/juca/contexto";
import { JucaCanto } from "@/components/juca/Ancora";

export function FormularioNovaSenha({ token }: { token: string }) {
  return (
    <ProvedorJuca>
      <Miolo token={token} />
    </ProvedorJuca>
  );
}

function Miolo({ token }: { token: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erros, setErros] = useState<{ senha?: string; repetida?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [linkMorto, setLinkMorto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setErroGeral(null);

    const novos: typeof erros = {};
    if (senha.length < 8) novos.senha = "Use pelo menos 8 caracteres.";
    if (repetida !== senha) novos.repetida = "As duas senhas não são iguais.";
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    const r = await fetch("/api/auth/redefinir-senha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, senha }),
    }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);

    if (r?.ok) {
      // Só vai para o login depois que a troca foi gravada de verdade.
      router.replace("/entrar?senha=redefinida");
      return;
    }

    if (corpo.erro === "link_invalido") return setLinkMorto(true);
    setErroGeral(
      corpo.erro === "senha_fraca"
        ? "Essa senha é fácil demais de adivinhar. Escolha outra."
        : "Não deu para trocar agora. Tente de novo em instantes."
    );
  }

  if (linkMorto) {
    return (
      <div className="cartao mt-8 p-7 text-center">
        <img src="/juca/nao.webp" alt="" className="mx-auto mb-4 w-28" />
        <h2 className="titulo text-2xl">Esse link não vale mais</h2>
        <p className="mt-2 text-apagado">
          Ele já foi usado ou passou de 1 hora. Peça um novo — leva um minuto.
        </p>
        <Link href="/esqueci-senha" className="botao-primario mt-6">
          Pedir outro link
        </Link>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={trocar} className="mt-8 space-y-5" noValidate>
        <Campo
          rotulo="Senha nova"
          tipo="senha"
          valor={senha}
          aoMudar={setSenha}
          erro={erros.senha}
          obrigatorio
          autoComplete="new-password"
          dica="Mínimo de 8 caracteres."
          estado={senha.length >= 8 ? "valido" : senha ? "incompleto" : "digitando"}
          fala={senha.length >= 8 ? "Boa senha." : "Pelo menos 8 caracteres."}
        />
        <Campo
          rotulo="Repita a senha nova"
          tipo="senha"
          valor={repetida}
          aoMudar={setRepetida}
          erro={erros.repetida}
          obrigatorio
          autoComplete="new-password"
          estado={repetida && repetida === senha ? "valido" : repetida ? "incompleto" : "digitando"}
          fala={repetida && repetida === senha ? "Batem!" : "Igualzinha à de cima."}
        />

        {erroGeral && (
          <p role="alert" className="rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
            {erroGeral}
          </p>
        )}

        <button type="submit" disabled={enviando} aria-busy={enviando} className="botao-primario w-full">
          {enviando ? (
            <>
              <Girando />
              Trocando...
            </>
          ) : (
            "Trocar senha"
          )}
        </button>
      </form>

      <JucaCanto estado={erroGeral ? "recusa" : "ocioso"} />
    </>
  );
}
