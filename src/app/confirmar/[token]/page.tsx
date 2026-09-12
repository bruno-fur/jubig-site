import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { pegarSessao } from "@/lib/sessao";
import { proximoEvento } from "@/lib/eventos";

export const metadata: Metadata = { title: "Confirmando seu e-mail", robots: { index: false } };
export const dynamic = "force-dynamic";

type Resultado = "ok" | "ja_usado" | "expirado" | "invalido";

/**
 * Onde o link do e-mail cai.
 *
 * Página, não rota de API, porque quem abre é uma pessoa clicando no e-mail —
 * ela precisa ver o que aconteceu, não um JSON. Funciona deslogado: o link
 * costuma ser aberto no navegador do celular, que não é onde a conta foi
 * criada.
 */
export default async function Confirmar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let resultado: Resultado = "invalido";
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const admin = criarClienteAdmin();
    const { data, error } = await admin.rpc("confirmar_email", { p_token: token });
    if (error) console.error("[confirmar] rpc falhou", error.message);
    else resultado = (data as Resultado) ?? "invalido";
  }

  const sessao = await pegarSessao();
  const evento = await proximoEvento();

  // Link já usado quase sempre é a pessoa clicando duas vezes, ou o
  // antivírus do provedor abrindo o link antes dela. Não é erro.
  const deuCerto = resultado === "ok" || resultado === "ja_usado";

  if (deuCerto) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <img src="/juca/joia.webp" alt="" className="mx-auto w-32" />
        <h1 className="mt-4 text-3xl">E-mail confirmado!</h1>
        <p className="mt-2 text-apagado">
          {sessao
            ? "Sua conta está liberada para as inscrições."
            : "Tudo certo. Entre com sua conta para se inscrever."}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {sessao && evento ? (
            <Link href={`/${evento.slug}/inscricao`} className="botao-primario">
              Inscrever no {evento.nome}
            </Link>
          ) : (
            <Link href={sessao ? "/" : "/entrar"} className="botao-primario">
              {sessao ? "Ver os eventos" : "Entrar"}
            </Link>
          )}
          <Link href="/minhas-inscricoes" className="botao-secundario">
            Minhas inscrições
          </Link>
        </div>
      </div>
    );
  }

  const mensagem =
    resultado === "expirado"
      ? "Esse link venceu — eles valem 24 horas."
      : "Esse link não é válido. Confira se você copiou o endereço inteiro.";

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <img src="/juca/nao.webp" alt="" className="mx-auto w-32" />
      <h1 className="mt-4 text-3xl">Não deu para confirmar</h1>
      <p className="mt-2 text-apagado">{mensagem}</p>
      <p className="mt-2 text-apagado">
        {sessao
          ? "Peça um link novo na tela abaixo."
          : "Entre com sua conta e peça um link novo."}
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={sessao ? "/confirmar-email" : "/entrar"} className="botao-primario">
          {sessao ? "Pedir um link novo" : "Entrar"}
        </Link>
      </div>
    </div>
  );
}
