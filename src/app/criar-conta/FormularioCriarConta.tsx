"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CountryCode } from "libphonenumber-js";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { Campo } from "@/components/Campo";
import { Girando } from "@/components/Girando";
import { CampoTelefone } from "@/components/CampoTelefone";
import { ProvedorJuca } from "@/components/juca/contexto";
import { JucaCanto } from "@/components/juca/Ancora";
import { nomeCompleto } from "@/lib/validacao";

export function FormularioCriarConta() {
  return (
    <ProvedorJuca>
      <Miolo />
    </ProvedorJuca>
  );
}

function Miolo() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [igreja, setIgreja] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pais, setPais] = useState<CountryCode>("BR");
  const [e164, setE164] = useState<string | null>(null);
  const [senha, setSenha] = useState("");

  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [falhouEnvio, setFalhouEnvio] = useState(false);

  function conferir() {
    const e: Record<string, string> = {};
    if (!nomeCompleto(nome)) e.nome = "Precisa do nome e do sobrenome.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Esse e-mail não parece certo.";
    if (igreja.trim().length < 3) e.igreja = "De qual igreja você é?";
    if (telefone && !e164) e.telefone = "Número incompleto para o país escolhido.";
    if (senha.length < 8) e.senha = "Use pelo menos 8 caracteres.";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function criar(ev: React.FormEvent) {
    ev.preventDefault();
    setErroGeral(null);
    if (!conferir()) return;

    setEnviando(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: {
        // Vai para o perfil pelo trigger `ao_criar_usuario` do schema.
        data: { nome: nome.trim(), telefone: e164 ?? null, igreja: igreja.trim() },
      },
    });

    if (error) {
      setEnviando(false);
      setErroGeral(
        /already registered|already exists/i.test(error.message)
          ? "Esse e-mail já tem conta. Tente entrar."
          : "Não deu para criar a conta agora. Tente de novo em instantes."
      );
      return;
    }

    /*
     * O "Confirm email" do Supabase está desligado, então o cadastro já
     * devolve sessão: a pessoa entra logada e o e-mail de confirmação sai
     * pelo nosso SMTP, com o nosso template.
     */
    const envio = await fetch("/api/auth/enviar-confirmacao", { method: "POST" });
    setEnviando(false);
    setFalhouEnvio(!envio.ok);
    setPronto(true);

    // refresh() para o layout reler a sessão e a faixa de aviso aparecer.
    router.refresh();
  }

  if (pronto) {
    return (
      <div className="cartao mt-8 p-7 text-center">
        <img
          src={falhouEnvio ? "/juca/nervoso.webp" : "/juca/heh.webp"}
          alt=""
          className="mx-auto mb-4 w-28"
        />
        <h2 className="titulo text-2xl">
          {falhouEnvio ? "Conta criada, mas o e-mail não saiu" : "Falta um clique"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-apagado">
          {falhouEnvio ? (
            <>
              Sua conta está criada e você já está logado, mas não conseguimos enviar o link de
              confirmação agora. Tente de novo pelo botão abaixo.
            </>
          ) : (
            <>
              Enviamos um link de confirmação para <strong>{email.trim().toLowerCase()}</strong>.
              Enquanto você não clicar nele,{" "}
              <strong>não dá para se inscrever em nenhum evento</strong>.
            </>
          )}
        </p>
        {!falhouEnvio && (
          <p className="mt-4 text-sm text-apagado">Não chegou? Confira o spam ou a aba Promoções.</p>
        )}
        <Link href="/confirmar-email" className="botao-secundario mt-5">
          {falhouEnvio ? "Tentar de novo" : "Reenviar o link"}
        </Link>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={criar} className="mt-8 space-y-5" noValidate>
        <Campo
          rotulo="Nome completo"
          valor={nome}
          aoMudar={setNome}
          erro={erros.nome}
          obrigatorio
          autoComplete="name"
          estado={nomeCompleto(nome) ? "valido" : "digitando"}
          fala={nomeCompleto(nome) ? "Prazer!" : "Nome e sobrenome, por favor."}
        />
        <Campo
          rotulo="E-mail"
          tipo="email"
          valor={email}
          aoMudar={setEmail}
          erro={erros.email}
          obrigatorio
          autoComplete="email"
          dica="É para cá que vai o link de confirmação e o comprovante da inscrição."
          estado="digitando"
          fala="Capriche: o link vai pra cá."
        />
        <Campo
          rotulo="Sua igreja"
          valor={igreja}
          aoMudar={setIgreja}
          erro={erros.igreja}
          obrigatorio
          placeholder="Primeira Igreja Batista de..."
          estado={igreja.trim().length >= 3 ? "valido" : "digitando"}
          fala="Serve para montar a caravana."
        />
        <CampoTelefone
          valor={telefone}
          pais={pais}
          erro={erros.telefone}
          aoMudar={(v, p, n) => {
            setTelefone(v);
            setPais(p);
            setE164(n);
          }}
        />
        <Campo
          rotulo="Senha"
          tipo="senha"
          valor={senha}
          aoMudar={setSenha}
          erro={erros.senha}
          obrigatorio
          autoComplete="new-password"
          dica="Mínimo de 8 caracteres."
          estado={senha.length >= 8 ? "valido" : senha.length > 0 ? "incompleto" : "digitando"}
          fala={senha.length >= 8 ? "Boa senha." : "Pelo menos 8 caracteres."}
        />

        {erroGeral && (
          <p role="alert" className="rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
            {erroGeral}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          aria-busy={enviando}
          className="botao-primario w-full"
        >
          {enviando ? (
            <>
              <Girando />
              Criando...
            </>
          ) : (
            "Criar conta"
          )}
        </button>
      </form>

      <JucaCanto
        estado={erroGeral ? "recusa" : "ocioso"}
        fala={erroGeral ? "Deu ruim aqui." : "Bora pro JubigDay!"}
      />
    </>
  );
}
