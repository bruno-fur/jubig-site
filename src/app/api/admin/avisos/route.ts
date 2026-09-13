import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { Emails } from "@/lib/email";
import { LIMITE_DISPARO, enviarEmFila, responsaveisDoEvento } from "@/lib/disparo";

const Aviso = z.object({
  eventoId: z.uuid(),
  titulo: z.string().trim().min(3).max(120),
  mensagem: z.string().trim().min(5).max(4000),
  enviarEmail: z.boolean().default(true),
});

/**
 * Publica um aviso na página do evento e, se pedido, manda por e-mail.
 *
 * O aviso é gravado antes do envio: se o Gmail cair no meio, a informação já
 * está no site e o contador mostra quantos receberam.
 */
export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Aviso.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { eventoId, titulo, mensagem, enviarEmail } = corpo.data;

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nome, slug")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento) return NextResponse.json({ erro: "evento_nao_encontrado" }, { status: 404 });

  const { data: aviso, error } = await supabase
    .from("avisos")
    .insert({ evento_id: eventoId, titulo, mensagem, criado_por: sessao.userId })
    .select("id")
    .single();
  if (error || !aviso) {
    console.error("[avisos] insert falhou", error?.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }

  if (!enviarEmail) return NextResponse.json({ status: "publicado", enviados: 0 });

  const todos = await responsaveisDoEvento(eventoId);
  const destinatarios = todos.slice(0, LIMITE_DISPARO);

  const { enviados, falhas } = await enviarEmFila(destinatarios, (d) =>
    Emails.aviso(d.email, d.nome, { evento: evento.nome, slug: evento.slug, titulo, mensagem })
  );

  await supabase.from("avisos").update({ enviados }).eq("id", aviso.id);

  return NextResponse.json({
    status: "publicado",
    enviados,
    falhas,
    // Passou do teto: a tela avisa quantos ficaram de fora em vez de fingir que foi para todos.
    ficaramDeFora: Math.max(todos.length - LIMITE_DISPARO, 0),
  });
}

export async function DELETE(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = z.object({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  // Tirar do site não desfaz e-mail já enviado — a tela diz isso antes.
  const supabase = await createClient();
  const { error } = await supabase.from("avisos").delete().eq("id", corpo.data.id);
  if (error) return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  return NextResponse.json({ status: "ok" });
}
