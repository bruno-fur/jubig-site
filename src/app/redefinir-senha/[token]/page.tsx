import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { FormularioNovaSenha } from "./FormularioNovaSenha";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Onde o link do e-mail cai.
 *
 * Confere o token antes de mostrar o formulário, SEM consumir: consumir aqui
 * queimaria o link quando o antivírus do provedor abre o e-mail sozinho, antes
 * da pessoa. Quem consome é o envio da senha nova.
 */
export default async function RedefinirSenha({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let valido = false;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const admin = criarClienteAdmin();
    const { data } = await admin
      .from("redefinicoes_senha")
      .select("expira_em, usado_em")
      .eq("token", token)
      .maybeSingle();
    valido = Boolean(data && !data.usado_em && new Date(data.expira_em) > new Date());
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {valido ? (
        <>
          <h1 className="text-3xl">Escolha uma senha nova</h1>
          <p className="mt-2 text-apagado">Depois de trocar, você volta para a tela de entrar.</p>
          <FormularioNovaSenha token={token} />
        </>
      ) : (
        <div className="cartao p-7 text-center">
          <img src="/juca/nao.webp" alt="" className="mx-auto mb-4 w-28" />
          <h1 className="titulo text-2xl">Esse link não vale mais</h1>
          <p className="mt-2 text-apagado">
            Ele já foi usado, passou de 1 hora ou foi copiado pela metade. Peça um novo.
          </p>
          <Link href="/esqueci-senha" className="botao-primario mt-6">
            Pedir outro link
          </Link>
        </div>
      )}
    </div>
  );
}
