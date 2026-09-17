import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { EQUIPES_PADRAO } from "@/lib/equipes";

const cor = z.string().regex(/^#[0-9a-f]{6}$/i);
const nome = z.string().trim().min(1).max(30);

/**
 * Tudo das pulseiras numa rota só, separado por `acao`. São ações pequenas,
 * todas da diretoria, e no dia do evento quem usa é quem está na porta — por
 * isso vale para membro também, não só admin (a RLS pede o mesmo).
 */
const Pedido = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("criar_padrao"), eventoId: z.uuid() }),
  z.object({ acao: z.literal("criar"), eventoId: z.uuid(), nome, cor }),
  z.object({ acao: z.literal("editar"), id: z.uuid(), nome, cor }),
  z.object({ acao: z.literal("apagar"), id: z.uuid() }),
  z.object({
    acao: z.literal("pontuar"),
    equipeId: z.uuid(),
    valor: z.number().int().min(-1000).max(1000).refine((v) => v !== 0),
    motivo: z.string().trim().max(80).nullish(),
  }),
  z.object({ acao: z.literal("apagar_ponto"), id: z.uuid() }),
  z.object({ acao: z.literal("mover"), inscritoId: z.uuid(), equipeId: z.uuid().nullable() }),
  z.object({ acao: z.literal("equilibrar"), eventoId: z.uuid() }),
  z.object({
    acao: z.literal("sortear"),
    eventoId: z.uuid(),
    soPresentes: z.boolean(),
    refazer: z.boolean(),
  }),
]);

const STATUS: Record<string, number> = {
  sem_permissao: 403,
  nao_encontrado: 404,
  equipe_de_outro_evento: 400,
};

export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!(await papelDe(sessao.userId)))
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const p = corpo.data;
  const supabase = await createClient();

  const falhou = (onde: string, msg: string) => {
    console.error(`[equipes] ${onde} falhou`, msg);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  };

  switch (p.acao) {
    case "criar_padrao": {
      // Só cria se o evento ainda não tem nenhuma: dois cliques não viram oito equipes.
      const { count } = await supabase
        .from("equipes")
        .select("id", { count: "exact", head: true })
        .eq("evento_id", p.eventoId);
      if ((count ?? 0) > 0) return NextResponse.json({ erro: "ja_tem_equipes" }, { status: 409 });

      const { error } = await supabase
        .from("equipes")
        .insert(EQUIPES_PADRAO.map((e, i) => ({ evento_id: p.eventoId, nome: e.nome, cor: e.cor, ordem: i })));
      return error ? falhou("criar_padrao", error.message) : NextResponse.json({ status: "ok" });
    }

    case "criar": {
      const { count } = await supabase
        .from("equipes")
        .select("id", { count: "exact", head: true })
        .eq("evento_id", p.eventoId);
      const { error } = await supabase
        .from("equipes")
        .insert({ evento_id: p.eventoId, nome: p.nome, cor: p.cor, ordem: count ?? 0 });
      return error ? falhou("criar", error.message) : NextResponse.json({ status: "ok" });
    }

    case "editar": {
      const { error } = await supabase.from("equipes").update({ nome: p.nome, cor: p.cor }).eq("id", p.id);
      return error ? falhou("editar", error.message) : NextResponse.json({ status: "ok" });
    }

    case "apagar": {
      // Quem estava nela volta para "sem equipe" (on delete set null); os pontos vão junto.
      const { error } = await supabase.from("equipes").delete().eq("id", p.id);
      return error ? falhou("apagar", error.message) : NextResponse.json({ status: "ok" });
    }

    case "pontuar": {
      const { error } = await supabase
        .from("pontos_equipe")
        .insert({ equipe_id: p.equipeId, valor: p.valor, motivo: p.motivo || null });
      return error ? falhou("pontuar", error.message) : NextResponse.json({ status: "ok" });
    }

    case "apagar_ponto": {
      const { error } = await supabase.from("pontos_equipe").delete().eq("id", p.id);
      return error ? falhou("apagar_ponto", error.message) : NextResponse.json({ status: "ok" });
    }

    case "mover": {
      const { data, error } = await supabase.rpc("mover_para_equipe", {
        p_inscrito: p.inscritoId,
        p_equipe: p.equipeId,
      });
      if (error) return falhou("mover", error.message);
      const r = String(data);
      return r === "ok"
        ? NextResponse.json({ status: "ok" })
        : NextResponse.json({ erro: r }, { status: STATUS[r] ?? 400 });
    }

    case "equilibrar": {
      const { data, error } = await supabase.rpc("equilibrar_equipes", { p_evento: p.eventoId });
      return error ? falhou("equilibrar", error.message) : NextResponse.json({ movidos: Number(data) });
    }

    case "sortear": {
      const { data, error } = await supabase.rpc("sortear_equipes", {
        p_evento: p.eventoId,
        p_so_presentes: p.soPresentes,
        p_refazer: p.refazer,
      });
      return error ? falhou("sortear", error.message) : NextResponse.json({ sorteados: Number(data) });
    }
  }
}
