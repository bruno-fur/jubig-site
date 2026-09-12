import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirLogin } from "@/lib/sessao";
import { AvisoEmailNaoConfirmado } from "@/components/AvisoEmailNaoConfirmado";

export const metadata: Metadata = { title: "Confirme seu e-mail" };

/**
 * Tela de bloqueio: é para onde `exigirEmailConfirmado()` manda quem tenta
 * abrir uma inscrição sem ter confirmado. Camada 2 das quatro.
 *
 * Exige login porque o reenvio precisa saber de quem é a conta — e, com a
 * confirmação própria, quem não confirmou consegue entrar normalmente.
 */
export default async function ConfirmarEmail() {
  const sessao = await exigirLogin();
  if (sessao.emailConfirmado) redirect("/minhas-inscricoes");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <AvisoEmailNaoConfirmado email={sessao.email} variante="bloqueio" />

      <p className="mt-6 text-center text-sm text-apagado">
        Confirmou em outra aba?{" "}
        <Link href="/minhas-inscricoes" className="font-semibold text-laranja-escuro hover:underline">
          Recarregar
        </Link>
      </p>
    </div>
  );
}
