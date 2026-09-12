import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { urlDoSite } from "@/lib/site";

/**
 * Reenvia o e-mail de confirmação.
 *
 * Atende dois casos:
 *   - já logado: usa o e-mail da sessão, o corpo é ignorado;
 *   - ainda não consegue logar (o Supabase barra login sem confirmação):
 *     aceita o e-mail no corpo.
 *
 * Usa `auth.resend`, não `admin.generateLink`: aquele exige a senha e recusa
 * endereço já cadastrado, que é justamente quem pede reenvio. Como é o próprio
 * endpoint do Supabase, o limite de envio por e-mail e por IP é o dele — não
 * dá para transformar isto em disparador de spam.
 *
 * Quem entrega o e-mail é o SMTP configurado no Supabase (Resend, ver README).
 */
export async function POST(req: Request) {
  const sessao = await pegarSessao();

  let email = sessao?.email;
  if (!email) {
    const corpo = await req.json().catch(() => ({}));
    email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : undefined;
  }
  if (!email) return NextResponse.json({ erro: "sem_email" }, { status: 400 });
  if (sessao?.emailConfirmado) return NextResponse.json({ status: "ja_confirmado" });

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${urlDoSite()}/auth/callback?proximo=/confirmado` },
  });

  if (error) {
    console.error("[auth] reenvio falhou", email, error.message);
    // O Supabase limita reenvio por minuto — a tela precisa dizer isso.
    const limite = /rate|seconds|security purposes/i.test(error.message);
    return NextResponse.json(
      { erro: limite ? "muitas_tentativas" : "falha_envio" },
      { status: limite ? 429 : 400 }
    );
  }

  return NextResponse.json({ status: "enviado" });
}
