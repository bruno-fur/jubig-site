import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente do usuário logado: chave anônima + cookies de sessão.
 *
 * Usa a chave ANÔNIMA de propósito. Toda consulta feita por aqui passa pela
 * RLS — é ela a quarta camada da regra do e-mail confirmado. Se precisar de
 * poder de administrador (gerar signed URL, ler e-mail de outro usuário),
 * use `criarClienteAdmin` de `@/lib/supabase/admin`, nunca este.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* chamada a partir de Server Component: ignorar */
          }
        },
      },
    }
  );
}
