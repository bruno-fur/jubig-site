import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova o cookie de sessão a cada navegação. Sem isso o token expira e o
 * usuário é deslogado no meio do formulário — coisa que só aparece depois de
 * uma hora de teste, quando já é tarde.
 *
 * Chave anônima: aqui nunca se lê dado de ninguém, só se atualiza a sessão.
 */
export async function atualizarSessao(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => req.cookies.set(name, value));
          resposta = NextResponse.next({ request: req });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        },
      },
    }
  );

  // Precisa ser getUser(): getSession() confia no cookie sem validar no servidor.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = req.nextUrl.pathname;
  /*
   * `/confirmar-email` fica de fora: o Supabase recusa o login de quem não
   * confirmou, então quem mais precisa daquela tela é quem ainda não tem sessão.
   */
  const exigeLogin =
    caminho.startsWith("/minhas-inscricoes") ||
    caminho.startsWith("/diretoria") ||
    caminho.startsWith("/inscricoes/") ||
    /^\/[^/]+\/inscricao/.test(caminho);

  if (!user && exigeLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("proximo", caminho);
    return NextResponse.redirect(url);
  }

  return resposta;
}
