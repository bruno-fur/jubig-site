import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pegarSessao } from "@/lib/sessao";
import { FormularioEntrar } from "./FormularioEntrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; senha?: string }>;
}) {
  const { proximo, senha } = await searchParams;
  if (await pegarSessao()) redirect(proximo ?? "/minhas-inscricoes");

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl">Entrar</h1>
      <p className="mt-2 text-apagado">
        Use a mesma conta para todos os eventos da JUBIG.
      </p>

      {senha === "redefinida" && (
        <p
          role="status"
          className="mt-6 flex items-center gap-3 rounded-[10px] bg-ok/10 px-4 py-3 text-sm font-medium text-ok"
        >
          <img src="/juca/joia.webp" alt="" className="h-9 w-9 object-contain" />
          Senha trocada. Agora é só entrar com a nova.
        </p>
      )}

      <FormularioEntrar proximo={proximo ?? "/minhas-inscricoes"} />

      <p className="mt-4 text-center text-sm">
        <Link href="/esqueci-senha" className="font-semibold text-laranja-escuro hover:underline">
          Esqueci minha senha
        </Link>
      </p>

      <p className="mt-6 text-center text-sm text-apagado">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="font-semibold text-laranja-escuro hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
