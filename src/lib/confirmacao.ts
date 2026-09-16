import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { Emails } from "@/lib/email";
import { urlDoSite } from "@/lib/site";
import { estourouOTeto } from "@/lib/limites";

/** Um e-mail por minuto por conta. */
const ESPERA_SEGUNDOS = 60;

export type ResultadoConfirmacao =
  | { status: "enviado" }
  | { status: "ja_confirmado" }
  | { status: "muitas_tentativas"; esperar: number }
  | { status: "sem_email" }
  | { status: "falha" };

/**
 * Gera o link de confirmação de e-mail e manda pelo nosso SMTP.
 *
 * Compartilhado entre a própria pessoa (depois do cadastro) e o admin (quando
 * o e-mail não chegou). O limite de um por minuto vale nos dois casos: um
 * admin clicando várias vezes também queimaria a cota do Gmail.
 */
export async function enviarConfirmacao(userId: string): Promise<ResultadoConfirmacao> {
  const admin = criarClienteAdmin();

  const [{ data: conta }, { data: perfil }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("perfis").select("nome, email_confirmado_em").eq("id", userId).maybeSingle(),
  ]);

  const email = conta?.user?.email;
  if (!email) return { status: "sem_email" };
  if (perfil?.email_confirmado_em) return { status: "ja_confirmado" };

  const { data: ultimo } = await admin
    .from("confirmacoes_email")
    .select("criado_em")
    .eq("user_id", userId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimo) {
    const segundos = (Date.now() - new Date(ultimo.criado_em).getTime()) / 1000;
    if (segundos < ESPERA_SEGUNDOS)
      return { status: "muitas_tentativas", esperar: Math.ceil(ESPERA_SEGUNDOS - segundos) };
  }

  // Teto por hora: um ataque em lista de e-mails não queima a cota do Gmail.
  if (await estourouOTeto(admin, "confirmacoes_email")) return { status: "falha" };

  const { data: novo, error } = await admin
    .from("confirmacoes_email")
    .insert({ user_id: userId })
    .select("token")
    .single();
  if (error || !novo) {
    console.error("[confirmacao] não gravou o token", error?.message);
    return { status: "falha" };
  }

  const envio = await Emails.confirmarEndereco(
    email,
    perfil?.nome || email,
    `${urlDoSite()}/confirmar/${novo.token}`
  );

  if (!envio.ok) {
    // Token queimado junto: um link válido que ninguém recebeu é só risco.
    await admin
      .from("confirmacoes_email")
      .update({ usado_em: new Date().toISOString() })
      .eq("token", novo.token);
    return { status: "falha" };
  }

  return { status: "enviado" };
}
