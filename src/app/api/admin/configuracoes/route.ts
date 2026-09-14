import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { paraE164 } from "@/lib/validacao";

const Pedido = z.object({
  whatsapp: z.string().trim().min(8).max(30),
  instagram: z.string().trim().min(1).max(80),
  emailContato: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => (v ? v : null)),
  quemSomos: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v ? v : null)),
});

/** Aceita "@jubigoficial", "jubigoficial" ou o link do perfil. */
function limparInstagram(valor: string) {
  return valor
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .trim();
}

/** Contatos e textos do site, em Diretoria > Site. */
export async function PATCH(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const d = corpo.data;

  // wa.me só aceita dígitos com DDI; o E.164 garante que o número existe no formato.
  const e164 = paraE164(d.whatsapp, "BR");
  if (!e164) return NextResponse.json({ erro: "whatsapp_invalido" }, { status: 400 });

  const instagram = limparInstagram(d.instagram);
  if (!/^[A-Za-z0-9._]{1,30}$/.test(instagram))
    return NextResponse.json({ erro: "instagram_invalido" }, { status: 400 });

  if (d.emailContato && !z.email().safeParse(d.emailContato).success)
    return NextResponse.json({ erro: "email_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({
      whatsapp: e164.replace(/\D/g, ""),
      instagram,
      email_contato: d.emailContato,
      quem_somos: d.quemSomos,
      atualizado_em: new Date().toISOString(),
      atualizado_por: sessao.userId,
    })
    .eq("id", 1)
    .select("id");

  if (error || !data?.length) {
    console.error("[configuracoes] update falhou", error?.message ?? "nenhuma linha");
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
