import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { horaLegivel } from "@/lib/programacao";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const TIPOS = [
  "abertura",
  "devocional",
  "louvor",
  "palestra",
  "atividade",
  "esporte",
  "refeicao",
  "intervalo",
  "encerramento",
] as const;

const Item = z.object({
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish()
    .transform((v) => (v ? v : null)),
  dia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish()
    .transform((v) => (v ? v : null)),
  tipo: z.enum(TIPOS).nullish(),
  titulo: z.string().trim().min(2).max(120),
  descricao: opcional(300),
});

const Novo = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("programacao"),
    eventoId: z.uuid(),
    /** Um item ou o modelo de dia inteiro. */
    itens: z.array(Item).min(1).max(30),
  }),
  z.object({
    tipo: z.literal("duvida"),
    eventoId: z.uuid(),
    duvidas: z
      .array(
        z.object({
          pergunta: z.string().trim().min(5).max(200),
          resposta: z.string().trim().min(2).max(1000),
        })
      )
      .min(1)
      .max(20),
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

/**
 * Programação e dúvidas da página do evento.
 *
 * Aceita lista, não só um item: o botão "montar dia padrão" grava os onze
 * itens de uma vez, e onze chamadas seguidas no 4G falhariam no meio,
 * deixando meia programação no ar.
 *
 * `horario` continua sendo preenchido com o texto ("08h30") porque a coluna é
 * NOT NULL desde o começo e ainda há evento cadastrado só com ela.
 */
export async function POST(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = Novo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const d = corpo.data;

  if (d.tipo === "programacao") {
    const linhas = d.itens.map((i, n) => ({
      evento_id: d.eventoId,
      horario: horaLegivel({ hora: i.hora ?? null }) || "a definir",
      hora: i.hora,
      dia: i.dia,
      tipo: i.tipo ?? null,
      titulo: i.titulo,
      descricao: i.descricao,
      ordem: n,
    }));

    const { error } = await supabase.from("programacao").insert(linhas);
    if (error) {
      console.error("[conteudo] programacao falhou", error.message);
      return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
    }
    return NextResponse.json({ status: "ok", itens: linhas.length });
  }

  const { error } = await supabase.from("duvidas").insert(
    d.duvidas.map((q, n) => ({
      evento_id: d.eventoId,
      pergunta: q.pergunta,
      resposta: q.resposta,
      ordem: n,
    }))
  );
  if (error) {
    console.error("[conteudo] duvidas falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok", itens: d.duvidas.length });
}

const Ajuste = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("programacao"),
    id: z.uuid(),
    hora: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullish(),
    dia: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    categoria: z.enum(TIPOS).nullish(),
    titulo: z.string().trim().min(2).max(120),
    descricao: opcional(300),
  }),
  z.object({
    tipo: z.literal("duvida"),
    id: z.uuid(),
    pergunta: z.string().trim().min(5).max(200),
    resposta: z.string().trim().min(2).max(1000),
  }),
]);

/**
 * Corrigir no lugar, sem apagar e recriar.
 *
 * Dúvida escrita errada e horário que mudou são o caso comum: refazer do zero
 * perderia a ordem e, na dúvida, o texto que já estava certo.
 */
export async function PATCH(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = Ajuste.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const d = corpo.data;

  const supabase = await createClient();
  const { error } =
    d.tipo === "programacao"
      ? await supabase
          .from("programacao")
          .update({
            hora: d.hora ?? null,
            horario: horaLegivel({ hora: d.hora ?? null }) || "a definir",
            dia: d.dia ?? null,
            tipo: d.categoria ?? null,
            titulo: d.titulo,
            descricao: d.descricao,
          })
          .eq("id", d.id)
      : await supabase
          .from("duvidas")
          .update({ pergunta: d.pergunta, resposta: d.resposta })
          .eq("id", d.id);

  if (error) {
    console.error("[conteudo] update falhou", error.message);
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
