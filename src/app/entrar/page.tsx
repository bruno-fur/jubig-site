import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pegarSessao } from "@/lib/sessao";
import { FormularioEntrar } from "./FormularioEntrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;
  if (await pegarSessao()) redirect(proximo ?? "/minhas-inscricoes");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl">Entrar</h1>
      <p className="mt-2 text-apagado">
        Use a mesma conta para todos os eventos da JUBIG.
      </p>

      <FormularioEntrar proximo={proximo ?? "/minhas-inscricoes"} />

      <p className="mt-6 text-center text-sm text-apagado">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="font-semibold text-laranja-escuro hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
