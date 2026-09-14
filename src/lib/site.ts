/**
 * Endereço público do site.
 *
 * Vai parar em lugar que não dá para corrigir depois: link dentro do e-mail,
 * `src` das figurinhas do Juca na caixa de entrada, redirect da confirmação de
 * conta. Errar aqui significa e-mail com imagem quebrada e link que não volta
 * para lugar nenhum — e o e-mail já saiu, não tem como editar.
 *
 * Ordem:
 *   1. NEXT_PUBLIC_SITE_URL — o domínio final, quando existir
 *   2. a URL de produção que a própria Vercel injeta
 *   3. localhost, para desenvolvimento
 */
export function urlDoSite(): string {
  const explicito = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicito) return explicito.replace(/\/+$/, "");

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/** Perfil do Instagram, sem o @. Um lugar só: já esteve escrito de dois jeitos. */
export const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM ?? "jubigoficial";
