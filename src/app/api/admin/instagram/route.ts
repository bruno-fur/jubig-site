import { NextResponse } from "next/server";
import { z } from "zod";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { atualizarInstagram, conectarInstagram, desconectarInstagram } from "@/lib/instagram";

const Pedido = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("conectar"), token: z.string().trim().min(20).max(1000) }),
  z.object({ acao: z.literal("atualizar") }),
]);

async function exigirAdminNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });
  return null;
}

/**
 * Conecta a conta do Instagram ou força uma atualização.
 *
 * A chave nunca volta na resposta: depois de guardada, nem o admin a vê de
 * novo. Para trocar, cola outra.
 */
export async function POST(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  if (corpo.data.acao === "conectar") {
    const r = await conectarInstagram(corpo.data.token);
    if (!r.ok) return NextResponse.json({ erro: "token_invalido", detalhe: r.erro }, { status: 400 });
    return NextResponse.json({ status: "conectado", usuario: r.usuario });
  }

  const r = await atualizarInstagram();
  if (!r.ok) return NextResponse.json({ erro: "falha_instagram", detalhe: r.erro }, { status: 502 });
  return NextResponse.json({ status: "atualizado" });
}

export async function DELETE() {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;
  await desconectarInstagram();
  return NextResponse.json({ status: "desconectado" });
}
