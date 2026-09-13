import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Pendencias = {
  /** comprovantes esperando aprovação, fora de inscrição cancelada */
  comprovantes: number;
  /** contas que ainda não confirmaram o e-mail — só interessa ao admin */
  emailsPendentes: number | null;
};

/**
 * Contagem do que a diretoria tem para resolver, mostrada ao entrar no site.
 *
 * `head: true` com contagem: não traz linha nenhuma, só o número — roda em
 * toda página que a diretoria abre, então precisa custar quase nada.
 */
export async function contarPendencias(admin: boolean): Promise<Pendencias> {
  const supabase = await createClient();

  const [{ count: comprovantes }, emails] = await Promise.all([
    supabase
      .from("comprovantes")
      .select("id, inscricoes!inner(status)", { count: "exact", head: true })
      .is("aprovado", null)
      .neq("inscricoes.status", "cancelada"),
    admin
      ? supabase
          .from("perfis")
          .select("id", { count: "exact", head: true })
          .is("email_confirmado_em", null)
      : Promise.resolve({ count: null }),
  ]);

  return { comprovantes: comprovantes ?? 0, emailsPendentes: emails.count ?? null };
}
