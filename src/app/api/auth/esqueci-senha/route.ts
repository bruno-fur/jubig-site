import { NextResponse } from "next/server";
import { z } from "zod";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { Emails } from "@/lib/email";
import { urlDoSite } from "@/lib/site";

/** Um pedido por minuto por conta. */
const ESPERA_SEGUNDOS = 60;

/**
 * Pedido de redefinição de senha.
 *
 * Confere se a conta existe e só manda e-mail quando existe — mas responde a
 * MESMA coisa nos dois casos. Dizer "esse e-mail não tem conta" transforma a
 * tela num jeito de descobrir quem está cadastrado, e aqui a lista é de jovens
 * a partir de 12 anos, com igreja e telefone. A tela orienta a conferir a
 * digitação, que resolve o caso honesto de erro de digitação.
 */
export async function POST(req: Request) {
  const corpo = z
    .object({ email: z.email() })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "email_invalido" }, { status: 400 });

  const resposta = NextResponse.json({ status: "enviado_se_existir" });
  const admin = criarClienteAdmin();

  const { data: userId, error } = await admin.rpc("usuario_por_email", {
    p_email: corpo.data.email,
  });
  if (error) {
    console.error("[senha] busca falhou", error.message);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }
  if (!userId) return resposta;

  const { data: ultimo } = await admin
    .from("redefinicoes_senha")
    .select("criado_em")
    .eq("user_id", userId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Mesmo no limite, a resposta é igual: o tempo de espera também revelaria
  // que a conta existe.
  if (ultimo && (Date.now() - new Date(ultimo.criado_em).getTime()) / 1000 < ESPERA_SEGUNDOS) {
    return resposta;
  }

  const { data: novo, error: erroToken } = await admin
    .from("redefinicoes_senha")
    .insert({ user_id: userId })
    .select("token")
    .single();
  if (erroToken || !novo) {
    console.error("[senha] token não gravou", erroToken?.message);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }

  const { data: perfil } = await admin.from("perfis").select("nome").eq("id", userId).maybeSingle();

  const envio = await Emails.redefinirSenha(
    corpo.data.email.trim().toLowerCase(),
    perfil?.nome || "",
    `${urlDoSite()}/redefinir-senha/${novo.token}`
  );
  if (!envio.ok) {
    await admin
      .from("redefinicoes_senha")
      .update({ usado_em: new Date().toISOString() })
      .eq("token", novo.token);
  }

  return resposta;
}
