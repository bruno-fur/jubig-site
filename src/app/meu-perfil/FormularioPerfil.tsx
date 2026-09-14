"use client";

import { useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Campo } from "@/components/Campo";
import { CampoTelefone } from "@/components/CampoTelefone";
import { CampoIgreja } from "@/components/CampoIgreja";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { ProvedorJuca } from "@/components/juca/contexto";
import { JucaCanto } from "@/components/juca/Ancora";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mascaraTelefone } from "@/lib/mascaras";
import { nomeCompleto, paraE164 } from "@/lib/validacao";
import { useAcao } from "@/lib/useAcao";
import type { OpcaoIgreja } from "@/tipos/db";

type Inicial = {
  nome: string;
  telefoneNacional: string;
  pais: CountryCode;
  igrejaId: string;
  igrejaAntiga: string | null;
};

const MENSAGEM: Record<string, string> = {
  nome_incompleto: "Precisa do nome e do sobrenome.",
  telefone_invalido: "Telefone incompleto para o país escolhido.",
  igreja_invalida: "Escolha a sua igreja na lista.",
  pedido_invalido: "Confira os campos.",
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
};

export function FormularioPerfil(props: { email: string; igrejas: OpcaoIgreja[]; inicial: Inicial }) {
  return (
    <ProvedorJuca>
      <Miolo {...props} />
    </ProvedorJuca>
  );
}

function Miolo({ email, igrejas, inicial }: { email: string; igrejas: OpcaoIgreja[]; inicial: Inicial }) {
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: "Perfil salvo." });
  const [nome, setNome] = useState(inicial.nome);
  const [pais, setPais] = useState<CountryCode>(inicial.pais);
  const [telefone, setTelefone] = useState(() =>
    inicial.telefoneNacional ? mascaraTelefone(inicial.telefoneNacional, inicial.pais) : ""
  );
  const [e164, setE164] = useState<string | null>(() =>
    inicial.telefoneNacional ? paraE164(inicial.telefoneNacional, inicial.pais) : null
  );
  const [igrejaId, setIgrejaId] = useState(inicial.igrejaId);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!nomeCompleto(nome)) novos.nome = "Precisa do nome e do sobrenome.";
    if (telefone && !e164) novos.telefone = "Número incompleto para o país escolhido.";
    if (!igrejaId) novos.igreja = "Escolha a sua igreja na lista.";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    await acao.json("/api/perfil", "PATCH", { nome: nome.trim(), telefone: e164 ?? "", igrejaId });
  }

  return (
    <>
      <form onSubmit={salvar} className="cartao mt-8 space-y-5 p-5" noValidate>
        <h2 className="titulo text-xl">Seus dados</h2>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-tinta">E-mail</p>
          <p className="rounded-[10px] bg-areia px-3 py-2.5 break-all text-tinta">{email}</p>
          <p className="mt-1.5 text-sm text-apagado">
            Para trocar o e-mail da conta, fale com a diretoria.
          </p>
        </div>

        <Campo
          rotulo="Nome completo"
          valor={nome}
          aoMudar={setNome}
          erro={erros.nome}
          obrigatorio
          autoComplete="name"
          estado={nomeCompleto(nome) ? "valido" : "digitando"}
          fala={nomeCompleto(nome) ? "Tudo certo!" : "Nome e sobrenome."}
        />

        {inicial.igrejaAntiga && !igrejaId && (
          <p className="rounded-[10px] bg-laranja/10 px-3 py-2 text-sm text-laranja-escuro">
            Hoje está &quot;{inicial.igrejaAntiga}&quot;, escrito à mão antes da lista existir. Escolha a sua
            igreja abaixo.
          </p>
        )}
        <CampoIgreja rotulo="Sua igreja" igrejas={igrejas} valor={igrejaId} aoMudar={setIgrejaId} erro={erros.igreja} />

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

        {(acao.erro || acao.feito) && <Recado erro={acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />}

        <button type="submit" disabled={acao.ocupado} aria-busy={acao.ocupado} className="botao-primario w-full">
          {acao.ocupado ? (
            <>
              <Girando />
              Salvando...
            </>
          ) : (
            "Salvar dados"
          )}
        </button>
      </form>

      <TrocarSenha />

      <JucaCanto estado={acao.erro ? "recusa" : acao.feito ? "valido" : "ocioso"} fala={acao.feito ? "Salvo!" : undefined} />
    </>
  );
}

/** Troca de senha de quem já está logado — não precisa do link por e-mail. */
function TrocarSenha() {
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setFeito(null);
    if (senha.length < 8) return setErro("Use pelo menos 8 caracteres.");
    if (senha !== repetir) return setErro("As duas senhas não estão iguais.");

    setEnviando(true);
    const { error } = await criarClienteNavegador().auth.updateUser({ password: senha });
    setEnviando(false);

    if (error) {
      setErro(
        /different from the old|same/i.test(error.message)
          ? "A senha nova precisa ser diferente da atual."
          : "Não deu para trocar agora. Saia, entre de novo e tente outra vez."
      );
      return;
    }
    setSenha("");
    setRepetir("");
    setFeito("Senha trocada. Use a nova no próximo login.");
  }

  return (
    <form onSubmit={trocar} className="cartao mt-6 space-y-5 p-5" noValidate>
      <h2 className="titulo text-xl">Trocar senha</h2>
      <Campo
        rotulo="Senha nova"
        tipo="senha"
        valor={senha}
        aoMudar={setSenha}
        autoComplete="new-password"
        dica="Mínimo de 8 caracteres."
        estado={senha.length >= 8 ? "valido" : senha ? "incompleto" : "digitando"}
        fala={senha.length >= 8 ? "Boa senha." : "Pelo menos 8 caracteres."}
      />
      <Campo
        rotulo="Repita a senha nova"
        tipo="senha"
        valor={repetir}
        aoMudar={setRepetir}
        autoComplete="new-password"
        estado={repetir && repetir === senha ? "valido" : "digitando"}
        fala={repetir && repetir === senha ? "Iguais!" : "Igual à de cima."}
      />

      {(erro || feito) && <Recado erro={erro} sucesso={feito} aoFechar={() => (setErro(null), setFeito(null))} />}

      <button type="submit" disabled={enviando} aria-busy={enviando} className="botao-secundario w-full">
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
  );
}
