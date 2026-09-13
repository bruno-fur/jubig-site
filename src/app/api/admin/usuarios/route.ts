import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { enviarConfirmacao } from "@/lib/confirmacao";

const Pedido = z.object({
  userId: z.uuid(),
  acao: z.enum(["reenviar_confirmacao", "confirmar_email"]),
});

/**
 * Ações do admin sobre uma conta.
 *
 *   reenviar_confirmacao — manda de novo o link, com o mesmo limite de 1/min
 *   confirmar_email      — confirma sem link, para quando o e-mail não chega
 *                          nunca (caixa cheia, filtro corporativo, digitação
 *                          que só a pessoa não percebe)
 *
 * Confirmar à mão libera a pessoa para se inscrever. Por isso só admin, e
 * registra no log quem fez.
 */
export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { userId, acao } = corpo.data;

  if (acao === "reenviar_confirmacao") {
    const r = await enviarConfirmacao(userId);
    if (r.status === "enviado") return NextResponse.json({ status: "enviado" });
    if (r.status === "ja_confirmado") return NextResponse.json({ erro: "ja_confirmado" }, { status: 409 });
    if (r.status === "muitas_tentativas")
      return NextResponse.json({ erro: "muitas_tentativas", esperar: r.esperar }, { status: 429 });
    return NextResponse.json({ erro: "falha_envio" }, { status: 502 });
  }

  const admin = criarClienteAdmin();
  const { data, error } = await admin
    .from("perfis")
    .update({ email_confirmado_em: new Date().toISOString() })
    .eq("id", userId)
    .is("email_confirmado_em", null)
    .select("id");

  if (error) {
    console.error("[usuarios] confirmar falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  if (!data?.length) return NextResponse.json({ erro: "ja_confirmado" }, { status: 409 });

  console.log("[usuarios] e-mail confirmado manualmente", { conta: userId, por: sessao.userId });
  return NextResponse.json({ status: "confirmado" });
}
