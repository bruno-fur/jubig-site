import type { Metadata } from "next";
import Link from "next/link";
import { pegarSessao } from "@/lib/sessao";
import { proximoEvento } from "@/lib/eventos";

export const metadata: Metadata = { title: "E-mail confirmado" };

export default async function Confirmado() {
  const sessao = await pegarSessao();
  const evento = await proximoEvento();

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <img src="/juca/joia.webp" alt="" className="mx-auto w-32" />
      <h1 className="mt-4 text-3xl">E-mail confirmado!</h1>
      <p className="mt-2 text-apagado">
        {sessao
          ? "Tudo certo, sua conta está liberada para as inscrições."
          : "Tudo certo. Agora é só entrar com sua conta."}
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {sessao ? (
          evento ? (
            <Link href={`/${evento.slug}/inscricao`} className="botao-primario">
              Inscrever no {evento.nome}
            </Link>
          ) : (
            <Link href="/" className="botao-primario">
              Ver os eventos
            </Link>
          )
        ) : (
          <Link href="/entrar" className="botao-primario">
            Entrar
          </Link>
        )}
        <Link href="/minhas-inscricoes" className="botao-secundario">
          Minhas inscrições
        </Link>
      </div>
    </div>
  );
}
