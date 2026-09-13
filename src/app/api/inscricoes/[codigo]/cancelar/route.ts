import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { pegarSessao } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import { formatarData } from "@/lib/validacao";

const STATUS: Record<string, number> = {
  ok: 200,
  ja_cancelada: 409,
  fale_com_diretoria: 409,
  motivo_obrigatorio: 400,
  nao_encontrada: 404,
};

/**
 * Cancela a inscrição. Quem pode e com que condição mora em
 * `cancelar_inscricao`, no banco — esta rota só traduz e avisa por e-mail
 * quando quem cancelou não é o dono.
 */
export async function POST(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  const { codigo } = await params;
  const corpo = z
    .object({ motivo: z.string().max(500).optional().default("") })
    .safeParse(await req.json().catch(() => ({})));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();

  // Lido antes: depois de cancelar, o status anterior (pago ou não) se perde.
  const { data: antes } = await supabase
    .from("inscricoes")
    .select("responsavel_id, status, eventos(nome, slug, data_evento), inscritos(nome)")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  const { data, error } = await supabase.rpc("cancelar_inscricao", {
    p_codigo: codigo,
    p_motivo: corpo.data.motivo,
  });
  if (error) {
    console.error("[cancelar] falhou", error.message);
    return NextResponse.json({ erro: "falha" }, { status: 500 });
  }

  const resultado = String(data);
  if (resultado !== "ok") return NextResponse.json({ erro: resultado }, { status: STATUS[resultado] ?? 400 });

  const ev = antes?.eventos as unknown as { nome: string; slug: string; data_evento: string } | undefined;

  // A pessoa precisa saber que a diretoria tirou a inscrição dela, e por quê.
  if (antes && ev && antes.responsavel_id !== sessao.userId) {
    const admin = criarClienteAdmin();
    const { data: dono } = await admin.auth.admin.getUserById(antes.responsavel_id);
    const { data: perfil } = await admin
      .from("perfis")
      .select("nome")
      .eq("id", antes.responsavel_id)
      .maybeSingle();

    if (dono?.user?.email) {
      await Emails.inscricaoCancelada(dono.user.email, perfil?.nome || "", {
        codigo: codigo.toUpperCase(),
        evento: ev.nome,
        slug: ev.slug,
        data: formatarData(ev.data_evento),
        motivo: corpo.data.motivo.trim(),
        estavaPaga: antes.status === "confirmada",
      });
    }
  }

  return NextResponse.json({ status: "cancelada" });
}
