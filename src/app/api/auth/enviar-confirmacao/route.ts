import { NextResponse } from "next/server";
import { pegarSessao } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { Emails } from "@/lib/email";
import { urlDoSite } from "@/lib/site";

/** Um e-mail por minuto por pessoa. */
const ESPERA_SEGUNDOS = 60;

/**
 * Gera o link de confirmação e manda pelo nosso SMTP, com o nosso template.
 *
 * Serve tanto para o primeiro envio quanto para o reenvio — o Supabase não
 * participa. Isso tira do caminho o template do painel, o SMTP configurado lá
 * e o limite de envio dele, que eram três lugares diferentes para dar errado.
 *
 * Exige sessão: como o "Confirm email" do Supabase está desligado, quem se
 * cadastra já entra logado. Sem isso, seria um endpoint para disparar e-mail
 * em endereço alheio.
 */
export async function POST() {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (sessao.emailConfirmado) return NextResponse.json({ status: "ja_confirmado" });

  // A tabela de tokens não tem política de RLS: só o service role a alcança.
  const admin = criarClienteAdmin();

  const { data: ultimo } = await admin
    .from("confirmacoes_email")
    .select("criado_em")
    .eq("user_id", sessao.userId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimo) {
    const segundos = (Date.now() - new Date(ultimo.criado_em).getTime()) / 1000;
    if (segundos < ESPERA_SEGUNDOS) {
      return NextResponse.json(
        { erro: "muitas_tentativas", esperar: Math.ceil(ESPERA_SEGUNDOS - segundos) },
        { status: 429 }
      );
    }
  }

  const { data: novo, error } = await admin
    .from("confirmacoes_email")
    .insert({ user_id: sessao.userId })
    .select("token")
    .single();

  if (error || !novo) {
    console.error("[confirmacao] não gravou o token", error?.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 500 });
  }

  const envio = await Emails.confirmarEndereco(
    sessao.email,
    sessao.nome ?? sessao.email,
    `${urlDoSite()}/confirmar/${novo.token}`
  );

  if (!envio.ok) {
    // Token queimado junto: reenviar gera outro, e um token solto no banco é
    // um link válido que ninguém recebeu.
    await admin.from("confirmacoes_email").update({ usado_em: new Date().toISOString() }).eq("token", novo.token);
    return NextResponse.json({ erro: "falha_envio" }, { status: 502 });
  }

  return NextResponse.json({ status: "enviado" });
}
