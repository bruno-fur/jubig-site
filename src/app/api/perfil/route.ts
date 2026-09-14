import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { nomeCompleto, paraE164 } from "@/lib/validacao";

const Pedido = z.object({
  nome: z.string().trim().min(3).max(120),
  /** E.164 ou vazio para tirar o telefone */
  telefone: z.string().trim().max(20),
  igrejaId: z.uuid(),
});

/**
 * A própria pessoa atualiza nome, telefone e igreja.
 *
 * Grava com o cliente da sessão: a RLS só deixa mexer na própria linha, e o
 * trigger `proteger_perfil` impede que isso vire atalho para confirmar o
 * e-mail sem o link.
 */
export async function PATCH(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { nome, telefone, igrejaId } = corpo.data;

  if (!nomeCompleto(nome)) return NextResponse.json({ erro: "nome_incompleto" }, { status: 400 });

  const e164 = telefone ? paraE164(telefone) : null;
  if (telefone && !e164) return NextResponse.json({ erro: "telefone_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { data: igreja } = await supabase
    .from("igrejas")
    .select("id, nome, cidade")
    .eq("id", igrejaId)
    .eq("ativa", true)
    .maybeSingle();
  if (!igreja) return NextResponse.json({ erro: "igreja_invalida" }, { status: 400 });

  const { data, error } = await supabase
    .from("perfis")
    .update({
      nome,
      telefone: e164,
      igreja_id: igreja.id,
      igreja: `${igreja.nome} (${igreja.cidade})`,
    })
    .eq("id", sessao.userId)
    .select("id");

  if (error || !data?.length) {
    console.error("[perfil] update falhou", error?.message ?? "nenhuma linha");
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
