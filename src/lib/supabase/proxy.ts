import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { faltandoConfiguracao } from "./config";

/**
 * Renova o cookie de sessão a cada navegação. Sem isso o token expira e o
 * usuário é deslogado no meio do formulário — coisa que só aparece depois de
 * uma hora de teste, quando já é tarde.
 *
 * Chave anônima: aqui nunca se lê dado de ninguém, só se atualiza a sessão.
 */
export async function atualizarSessao(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });

  /*
   * Sem as chaves, o `createServerClient` estoura aqui dentro — e erro em
   * proxy derruba TODA requisição, inclusive a página de erro e o 404. O
   * resultado é o site inteiro devolvendo "Internal Server Error" em branco.
   *
   * Deixar passar não abre brecha: quem protege as rotas é `exigirLogin` e a
   * RLS, que continuam valendo. O layout raiz cuida de avisar o que falta.
   */
  const faltando = faltandoConfiguracao();
  if (faltando.length > 0) {
    console.error("[proxy] sem configuração do Supabase, faltam:", faltando.join(", "));
    return resposta;
  }

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
   * `/confirmar-email` entrou na lista: com a confirmação própria, quem não
   * confirmou entra normalmente no site — e é justamente por isso que a tela
   * de reenvio só faz sentido com sessão.
   *
   * `/confirmar/<token>` fica de fora: o link do e-mail costuma ser aberto no
   * celular, que não é onde a conta foi criada.
   */
  const exigeLogin =
    caminho.startsWith("/minhas-inscricoes") ||
    caminho.startsWith("/confirmar-email") ||
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
