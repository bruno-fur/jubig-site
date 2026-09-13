import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";

const Igreja = z.object({
  nome: z.string().trim().min(3).max(120),
  cidade: z.string().trim().min(2).max(80),
  estado: z.string().trim().length(2).default("PR"),
  endereco: z.string().trim().max(200).nullish(),
  // Limites do oeste do Paraná são folgados de propósito: a união pode crescer
  // para a fronteira, e coordenada fora do mundo o Postgres já recusaria.
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  responsavel: z.string().trim().max(120).nullish(),
  telefone: z.string().trim().max(20).nullish(),
  instagram: z.string().trim().max(40).nullish(),
  ativa: z.boolean().default(true),
  ordem: z.number().int().min(0).max(999).default(0),
});

async function exigirAdminNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return { erro: NextResponse.json({ erro: "nao_autenticado" }, { status: 401 }) };
  if ((await papelDe(sessao.userId)) !== "admin")
    return { erro: NextResponse.json({ erro: "sem_permissao" }, { status: 403 }) };
  return {};
}

export async function POST(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = Igreja.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("igrejas").insert(corpo.data);
  if (error) {
    console.error("[igrejas] insert falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}

export async function PATCH(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = Igreja.partial()
    .extend({ id: z.uuid() })
    .safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const { id, ...campos } = corpo.data;
  const supabase = await createClient();
  const { error } = await supabase.from("igrejas").update(campos).eq("id", id);
  if (error) {
    console.error("[igrejas] update falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}

export async function DELETE(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = z.object({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();

  /*
   * Igreja que já sediou um JubigTour não é apagada.
   *
   * A chave estrangeira é `on delete set null`, então o evento passado
   * perderia em silêncio a informação de onde aconteceu — e a agenda mostra
   * eventos antigos. Desativar tira do mapa e preserva o histórico.
   */
  const { count } = await supabase
    .from("eventos")
    .select("id", { count: "exact", head: true })
    .eq("igreja_id", corpo.data.id);

  if ((count ?? 0) > 0)
    return NextResponse.json({ erro: "tem_eventos", eventos: count }, { status: 409 });

  const { error } = await supabase.from("igrejas").delete().eq("id", corpo.data.id);
  if (error) {
    console.error("[igrejas] delete falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
