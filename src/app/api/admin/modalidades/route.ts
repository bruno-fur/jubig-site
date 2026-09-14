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

const Modalidade = z.object({
  eventoId: z.uuid(),
  nome: z.string().trim().min(2).max(60),
  turno: z.enum(["manha", "tarde", "noite"]),
  vagas: z.number().int().min(1).max(2000),
  categoria: z.enum(["esporte", "oficina"]).default("esporte"),
  formato: z.enum(["individual", "dupla", "trio", "time_sorteado"]).default("individual"),
  descricao: opcional(500),
  responsavel: opcional(120),
  ordem: z.number().int().min(0).max(999).default(0),
});

/**
 * Oficina não tem formato: é sempre individual. `por_equipe` continua
 * preenchido para quem ainda lê a coluna antiga.
 */
function colunas(m: Partial<z.infer<typeof Modalidade>>) {
  const oficina = m.categoria === "oficina";
  const formato = oficina ? "individual" : m.formato;
  return {
    ...(m.nome !== undefined && { nome: m.nome }),
    ...(m.turno !== undefined && { turno: m.turno }),
    ...(m.vagas !== undefined && { vagas: m.vagas }),
    ...(m.categoria !== undefined && { categoria: m.categoria }),
    ...(formato !== undefined && { formato, por_equipe: formato !== "individual" }),
    ...(m.descricao !== undefined && { descricao: m.descricao }),
    ...(m.responsavel !== undefined && { responsavel: oficina ? m.responsavel : null }),
    ...(m.ordem !== undefined && { ordem: m.ordem }),
  };
}

/**
 * Modalidades: só admin.
 *
 * A RLS já recusa quem não é, mas o 403 explícito evita devolver "0 linhas
 * afetadas" como se tivesse dado certo — que é o que o PostgREST faz quando a
 * política esconde a linha.
 */
async function exigirAdminNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return { erro: NextResponse.json({ erro: "nao_autenticado" }, { status: 401 }) };
  if ((await papelDe(sessao.userId)) !== "admin")
    return { erro: NextResponse.json({ erro: "sem_permissao" }, { status: 403 }) };
  return { sessao };
}

export async function POST(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = Modalidade.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("esportes")
    .insert({ evento_id: corpo.data.eventoId, ...colunas(corpo.data) })
    .select()
    .single();

  if (error) {
    console.error("[modalidades] insert falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ modalidade: data });
}

export async function PATCH(req: Request) {
  const { erro } = await exigirAdminNaApi();
  if (erro) return erro;

  const corpo = Modalidade.partial().extend({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { id, ...campos } = corpo.data;

  const supabase = await createClient();

  /*
   * Mudar o formato de modalidade com gente dentro deixaria escolhas sem a
   * nota ou o parceiro que o formato novo exige — o sorteio sairia torto.
   */
  if (campos.formato !== undefined || campos.categoria !== undefined) {
    const [{ data: atual }, { count }] = await Promise.all([
      supabase.from("esportes").select("formato, categoria").eq("id", id).maybeSingle(),
      supabase.from("inscritos_esportes").select("inscrito_id", { count: "exact", head: true }).eq("esporte_id", id),
    ]);
    const mudou =
      (campos.formato !== undefined && campos.formato !== atual?.formato) ||
      (campos.categoria !== undefined && campos.categoria !== atual?.categoria);
    if (mudou && (count ?? 0) > 0)
      return NextResponse.json({ erro: "formato_com_inscritos", inscritos: count }, { status: 409 });
  }

  const { error } = await supabase.from("esportes").update(colunas(campos)).eq("id", id);

  if (error) {
    console.error("[modalidades] update falhou", error.message);
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
   * Modalidade com gente dentro não é apagada.
   *
   * A chave estrangeira apaga em cascata as escolhas de `inscritos_esportes`,
   * então um clique errado sumiria em silêncio com a modalidade de quem já
   * estava inscrito — e nem a diretoria saberia quem avisar.
   */
  const { count } = await supabase
    .from("inscritos_esportes")
    .select("inscrito_id", { count: "exact", head: true })
    .eq("esporte_id", corpo.data.id);

  if ((count ?? 0) > 0)
    return NextResponse.json({ erro: "tem_inscritos", inscritos: count }, { status: 409 });

  const { error } = await supabase.from("esportes").delete().eq("id", corpo.data.id);
  if (error) {
    console.error("[modalidades] delete falhou", error.message);
    return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
  }
  return NextResponse.json({ status: "ok" });
}
