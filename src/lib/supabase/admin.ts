import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com service role: ignora RLS por completo.
 *
 * O `import "server-only"` no topo faz o build QUEBRAR se este arquivo for
 * importado por engano de dentro de um componente "use client" — que é como a
 * chave vazaria para o navegador.
 *
 * Só use onde realmente não há alternativa:
 *   - `auth.admin.*` (ler e-mail de outro usuário, gerar link de confirmação)
 *   - signed URL de comprovante depois de conferir a permissão na mão
 *
 * Para qualquer leitura ou escrita em nome do usuário, use o cliente de
 * `@/lib/supabase/server`, que respeita a RLS.
 */
export function criarClienteAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
