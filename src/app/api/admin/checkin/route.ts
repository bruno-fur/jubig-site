import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { dadosDoIngresso } from "@/lib/ingressos";

const STATUS: Record<string, number> = {
  ok: 200,
  ja_entrou: 409,
  nao_confirmada: 409,
  nao_encontrado: 404,
  sem_permissao: 403,
};

/**
 * Registra a entrada. A regra de uma vez só mora em `registrar_checkin`, com
 * lock de linha: dois celulares da portaria lendo o mesmo QR ao mesmo tempo
 * não registram duas entradas.
 */
export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!(await papelDe(sessao.userId)))
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = z.object({ ingresso: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_checkin", { p_ingresso: corpo.data.ingresso });
  if (error) {
    console.error("[checkin] falhou", error.message);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }

  const resultado = String(data);
  // Devolve o estado atualizado junto: a tela mostra quem registrou e a hora.
  const dados = await dadosDoIngresso(corpo.data.ingresso);
  return NextResponse.json(
    { resultado, dados },
    { status: STATUS[resultado] ?? 400, headers: { "cache-control": "private, no-store" } }
  );
}
