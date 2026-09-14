import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const Novo = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("programacao"),
    eventoId: z.uuid(),
    horario: z.string().trim().min(1).max(20),
    titulo: z.string().trim().min(2).max(120),
    descricao: opcional(300),
    ordem: z.number().int().min(0).max(999).default(0),
  }),
  z.object({
    tipo: z.literal("duvida"),
    eventoId: z.uuid(),
    pergunta: z.string().trim().min(5).max(200),
    resposta: z.string().trim().min(2).max(1000),
    ordem: z.number().int().min(0).max(999).default(0),
  }),
]);

const Apagar = z.object({ tipo: z.enum(["programacao", "duvida"]), id: z.uuid() });

async function exigirAdminNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });
  return null;
}

/** Programação e dúvidas da página do evento — antes só pelo painel do Supabase. */
export async function POST(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = Novo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const d = corpo.data;
  const { error } =
    d.tipo === "programacao"
      ? await supabase.from("programacao").insert({
          evento_id: d.eventoId,
          horario: d.horario,
          titulo: d.titulo,
          descricao: d.descricao,
          ordem: d.ordem,
        })
      : await supabase.from("duvidas").insert({
          evento_id: d.eventoId,
          pergunta: d.pergunta,
          resposta: d.resposta,
          ordem: d.ordem,
        });

  if (error) {
    console.error("[conteudo] insert falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}

export async function DELETE(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = Apagar.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const tabela = corpo.data.tipo === "programacao" ? "programacao" : "duvidas";
  const { error } = await supabase.from(tabela).delete().eq("id", corpo.data.id);
  if (error) {
    console.error("[conteudo] delete falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
