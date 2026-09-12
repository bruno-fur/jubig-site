import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Papel } from "@/tipos/db";

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

  /*
   * A confirmação é nossa, não do Supabase: `auth.users.email_confirmed_at`
   * fica preenchido no cadastro (o "Confirm email" do painel está desligado de
   * propósito) e não diz nada. Quem manda é `perfis.email_confirmado_em`, o
   * mesmo campo que a política de RLS consulta — as duas camadas olham para o
   * mesmo lugar.
   */
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, email_confirmado_em")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email!,
    emailConfirmado: Boolean(perfil?.email_confirmado_em),
    nome: perfil?.nome || (user.user_metadata?.nome as string) || null,
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

/** `null` para quem não é da equipe. */
export async function papelDe(userId: string): Promise<Papel | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("diretoria")
    .select("papel")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.papel as Papel) ?? null;
}

export async function ehDiretoria(userId: string): Promise<boolean> {
  return (await papelDe(userId)) !== null;
}

/** Painel da diretoria. Manda para a home quem não é — não confirma que a rota existe. */
export async function exigirDiretoria(): Promise<Sessao & { papel: Papel }> {
  const s = await exigirLogin();
  const papel = await papelDe(s.userId);
  if (!papel) redirect("/");
  return { ...s, papel };
}

/**
 * Telas que mexem na estrutura: modalidades, evento, equipe.
 *
 * Membro da diretoria valida comprovante e exporta lista, mas não apaga
 * modalidade com gente inscrita dentro nem muda quem tem acesso.
 */
export async function exigirAdmin(): Promise<Sessao & { papel: Papel }> {
  const s = await exigirDiretoria();
  if (s.papel !== "admin") redirect("/diretoria");
  return s;
}
