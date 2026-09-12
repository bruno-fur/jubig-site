import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Onde o link do e-mail cai. Troca o código pela sessão e manda a pessoa para
 * a tela certa. Se o link já foi usado ou venceu, `/confirmar-email` explica e
 * oferece reenvio — nunca mostra erro cru do Supabase.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const proximo = searchParams.get("proximo") ?? "/confirmado";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${proximo}`);
    console.error("[auth] callback falhou", error.message);
  }

  return NextResponse.redirect(`${origin}/confirmar-email?erro=link`);
}
