import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pegarSessao } from "@/lib/sessao";
import { AvisoEmailNaoConfirmado } from "@/components/AvisoEmailNaoConfirmado";

export const metadata: Metadata = { title: "Confirme seu e-mail" };

/**
 * Página pública de propósito: o Supabase barra o login de quem não confirmou,
 * então quem mais precisa desta tela é justamente quem ainda não tem sessão.
 * O e-mail vem da sessão quando existe; senão, da querystring.
 */
export default async function ConfirmarEmail({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; erro?: string }>;
}) {
  const { email: emailParam, erro } = await searchParams;
  const sessao = await pegarSessao();

  if (sessao?.emailConfirmado) redirect("/minhas-inscricoes");

  const email = sessao?.email ?? emailParam;
  if (!email) redirect("/entrar");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {erro === "link" && (
        <p className="mb-5 rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
          Esse link já foi usado ou venceu. Peça um novo abaixo.
        </p>
      )}

      <AvisoEmailNaoConfirmado email={email} variante="bloqueio" />

      <p className="mt-6 text-center text-sm text-apagado">
        Já confirmou?{" "}
        <Link href="/entrar" className="font-semibold text-laranja-escuro hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
