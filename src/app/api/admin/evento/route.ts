import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";

const Pedido = z.object({
  id: z.uuid(),
  maxEsportesPorTurno: z.number().int().min(0).max(10).optional(),
  publicado: z.boolean().optional(),
  inscricoesAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

/** Ajustes do evento que a diretoria precisa mexer sem abrir o SQL Editor. */
export async function PATCH(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { id, maxEsportesPorTurno, publicado, inscricoesAte } = corpo.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("eventos")
    .update({
      ...(maxEsportesPorTurno !== undefined && { max_esportes_por_turno: maxEsportesPorTurno }),
      ...(publicado !== undefined && { publicado }),
      ...(inscricoesAte !== undefined && { inscricoes_ate: inscricoesAte }),
    })
    .eq("id", id);

  if (error) {
    console.error("[evento] update falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
