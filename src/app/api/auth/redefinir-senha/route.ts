import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteAdmin } from "@/lib/supabase/admin";

const Corpo = z.object({
  token: z.uuid(),
  senha: z.string().min(8).max(72),
});

/**
 * Troca a senha a partir do link do e-mail.
 *
 * O token é consumido antes da troca, numa tacada só no banco: duas abas
 * enviando o mesmo link não trocam a senha duas vezes. Se a troca falhar
 * depois disso, o token volta a valer — senão a pessoa ficaria com um link
 * queimado e a senha antiga, sem entender por quê.
 */
export async function POST(req: Request) {
  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "senha_curta" }, { status: 400 });

  const admin = criarClienteAdmin();
  const { data: userId, error } = await admin.rpc("consumir_redefinicao", {
    p_token: corpo.data.token,
  });

  if (error) {
    console.error("[senha] consumir falhou", error.message);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }
  if (!userId) return NextResponse.json({ erro: "link_invalido" }, { status: 410 });

  const { error: erroTroca } = await admin.auth.admin.updateUserById(userId, {
    password: corpo.data.senha,
  });

  if (erroTroca) {
    await admin.from("redefinicoes_senha").update({ usado_em: null }).eq("token", corpo.data.token);
    console.error("[senha] troca falhou", erroTroca.message);
    const fraca = /weak|pwned|password should/i.test(erroTroca.message);
    return NextResponse.json({ erro: fraca ? "senha_fraca" : "falha" }, { status: 400 });
  }

  return NextResponse.json({ status: "ok" });
}
