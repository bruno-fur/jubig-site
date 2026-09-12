import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pegarSessao } from "@/lib/sessao";
import { FormularioCriarConta } from "./FormularioCriarConta";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CriarConta() {
  if (await pegarSessao()) redirect("/minhas-inscricoes");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl">Criar conta</h1>
      <p className="mt-2 text-apagado">
        Uma conta só para todos os eventos da JUBIG. Você pode inscrever a caravana inteira da sua
        igreja por ela.
      </p>

      <FormularioCriarConta />

      <p className="mt-6 text-center text-sm text-apagado">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-laranja-escuro hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
