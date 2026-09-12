import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";

const Corpo = z.object({
  inscritoId: z.uuid(),
  esportes: z.array(z.uuid()).max(12),
  deBoa: z.boolean(),
});

/**
 * Troca de modalidade depois da inscrição feita.
 *
 * O prazo, a vaga e o conflito de horário são todos garantidos no banco
 * (política "escolher meus esportes" e trigger `inscritos_esportes_regras`).
 * Aqui a conta é traduzir o erro do Postgres para algo legível na tela.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!sessao.emailConfirmado)
    return NextResponse.json({ erro: "email_nao_confirmado" }, { status: 403 });

  const { codigo } = await params;
  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { inscritoId, esportes, deBoa } = corpo.data;

  if (!deBoa && esportes.length === 0)
    return NextResponse.json({ erro: "sem_escolha" }, { status: 400 });

  const supabase = await createClient();

  // RLS já limita, mas o filtro explícito evita depender só dela.
  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("id, inscritos(id)")
    .eq("codigo", codigo.toUpperCase())
    .eq("responsavel_id", sessao.userId)
    .maybeSingle();

  const pertence = inscricao?.inscritos?.some((i: { id: string }) => i.id === inscritoId);
  if (!inscricao || !pertence)
    return NextResponse.json({ erro: "nao_encontrado" }, { status: 404 });

  /*
   * Uma chamada só. Em passos separados, o delete das modalidades antigas
   * passaria e o insert da nova poderia falhar por lotação — a pessoa perderia
   * a escolha que já tinha e ficaria sem nenhuma.
   */
  const { error } = await supabase.rpc("trocar_esporte", {
    p_inscrito: inscritoId,
    p_esportes: esportes,
    p_de_boa: deBoa,
  });
  if (error) return NextResponse.json(traduzir(error.message), { status: statusDoErro(error.message) });

  return NextResponse.json({ status: "ok" });
}

function traduzir(msg: string) {
  if (/modalidade lotada/i.test(msg)) return { erro: "modalidade_lotada" };
  if (/limite_no_turno/i.test(msg)) return { erro: "limite_no_turno" };
  // A política de insert carrega o prazo de troca: recusa dela = prazo vencido.
  if (/row-level security|violates row-level/i.test(msg)) return { erro: "prazo_encerrado" };
  if (/inscrito_nao_encontrado/i.test(msg)) return { erro: "nao_encontrado" };
  console.error("[esportes] erro inesperado", msg);
  return { erro: "falha_ao_gravar" };
}

function statusDoErro(msg: string) {
  if (/lotada|limite_no_turno/i.test(msg)) return 409;
  if (/row-level security|violates row-level/i.test(msg)) return 403;
  if (/inscrito_nao_encontrado/i.test(msg)) return 404;
  return 400;
}
