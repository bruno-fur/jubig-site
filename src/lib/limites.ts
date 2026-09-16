import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Teto por hora dos e-mails automáticos.
 *
 * O limite por conta (1 por minuto) não protege contra quem varre uma lista de
 * endereços: cada conta recebe o primeiro e-mail, e a cota diária do Gmail
 * (~500) acaba antes do meio-dia. Sem cota, nenhuma inscrição de verdade
 * recebe código nem comprovante.
 *
 * Os números cabem no uso real da JUBIG: 250 inscrições não geram 60 pedidos
 * de confirmação na mesma hora, e redefinição de senha é coisa de uma aqui,
 * outra ali.
 */
export const TETO_POR_HORA = {
  confirmacoes_email: 60,
  redefinicoes_senha: 30,
} as const;

export async function estourouOTeto(
  admin: SupabaseClient,
  tabela: keyof typeof TETO_POR_HORA
): Promise<boolean> {
  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from(tabela)
    .select("token", { count: "exact", head: true })
    .gte("criado_em", desde);

  // Falha na contagem não pode travar o site: o limite por conta continua valendo.
  if (error) {
    console.error("[limites] não deu para contar", tabela, error.message);
    return false;
  }

  if ((count ?? 0) < TETO_POR_HORA[tabela]) return false;
  console.error(`[limites] teto por hora atingido em ${tabela}: ${count}`);
  return true;
}
