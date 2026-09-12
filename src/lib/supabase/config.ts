/**
 * Quais variáveis do Supabase estão faltando.
 *
 * Sem elas o `createServerClient` estoura, e como ele é chamado no proxy e no
 * layout raiz, o site inteiro devolve "Internal Server Error" em branco — nem
 * a página de erro carrega, porque ela também passa pelo layout. Quem vê isso
 * não tem como saber que o problema é uma variável de ambiente.
 */
export function faltandoConfiguracao(): string[] {
  const faltando: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) faltando.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim())
    faltando.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return faltando;
}

export const supabaseConfigurado = () => faltandoConfiguracao().length === 0;
