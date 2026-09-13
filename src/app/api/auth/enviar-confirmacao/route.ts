import { NextResponse } from "next/server";
import { pegarSessao } from "@/lib/sessao";
import { enviarConfirmacao } from "@/lib/confirmacao";

/**
 * A própria pessoa pede o link de confirmação — no cadastro ou no reenvio.
 *
 * Exige sessão: como o "Confirm email" do Supabase está desligado, quem se
 * cadastra já entra logado. Sem isso, seria um endpoint para disparar e-mail
 * em endereço alheio.
 */
export async function POST() {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (sessao.emailConfirmado) return NextResponse.json({ status: "ja_confirmado" });

  const r = await enviarConfirmacao(sessao.userId);

  switch (r.status) {
    case "enviado":
    case "ja_confirmado":
      return NextResponse.json({ status: r.status });
    case "muitas_tentativas":
      return NextResponse.json({ erro: "muitas_tentativas", esperar: r.esperar }, { status: 429 });
    default:
      return NextResponse.json({ erro: "falha_envio" }, { status: 502 });
  }
}
