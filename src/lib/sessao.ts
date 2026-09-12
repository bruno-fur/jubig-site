import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Sessao = {
  userId: string;
  email: string;
  emailConfirmado: boolean;
  nome: string | null;
};

export async function pegarSessao(): Promise<Sessao | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email!,
    emailConfirmado: Boolean(user.email_confirmed_at),
    nome: (user.user_metadata?.nome as string) ?? null,
  };
}

/** Usar em toda página logada. */
export async function exigirLogin(): Promise<Sessao> {
  const s = await pegarSessao();
  if (!s) redirect("/entrar");
  return s;
}

/**
 * Usar em TODA rota que cria ou altera inscrição — página e API.
 * A checagem do banner é só visual; esta é a que vale.
 */
export async function exigirEmailConfirmado(): Promise<Sessao> {
  const s = await exigirLogin();
  if (!s.emailConfirmado) redirect("/confirmar-email");
  return s;
}

export async function ehDiretoria(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("diretoria").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

/** Painel da diretoria. Devolve 404 para quem não é — não confirma que a rota existe. */
export async function exigirDiretoria(): Promise<Sessao> {
  const s = await exigirLogin();
  if (!(await ehDiretoria(s.userId))) redirect("/");
  return s;
}
