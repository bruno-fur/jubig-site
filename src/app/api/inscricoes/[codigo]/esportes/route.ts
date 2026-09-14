import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";

const Corpo = z.object({
  inscritoId: z.uuid(),
  escolhas: z
    .array(
      z.object({
        id: z.uuid(),
        nota: z.number().int().min(1).max(5).nullish(),
        parceiros: z.array(z.string().trim().max(80)).max(2).nullish(),
      })
    )
    .max(12),
  deBoa: z.boolean(),
});

/**
 * Troca de modalidade depois da inscrição feita.
 *
 * O prazo, a vaga, o limite por turno e o que cada formato exige (nota,
 * parceiros) são garantidos no banco — política "escolher meus esportes" e
 * trigger `inscritos_esportes_regras`. Aqui a conta é traduzir o erro.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!sessao.emailConfirmado) return NextResponse.json({ erro: "email_nao_confirmado" }, { status: 403 });

  const { codigo } = await params;
  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const { inscritoId, escolhas, deBoa } = corpo.data;

  if (!deBoa && escolhas.length === 0) return NextResponse.json({ erro: "sem_escolha" }, { status: 400 });

  const supabase = await createClient();

  // RLS já limita, mas o filtro explícito evita depender só dela.
  const { data: inscricao } = await supabase
    .from("inscricoes")
    .select("id, inscritos(id)")
    .eq("codigo", codigo.toUpperCase())
    .eq("responsavel_id", sessao.userId)
    .maybeSingle();

  const pertence = inscricao?.inscritos?.some((i: { id: string }) => i.id === inscritoId);
  if (!inscricao || !pertence) return NextResponse.json({ erro: "nao_encontrado" }, { status: 404 });

  /*
   * Uma chamada só. Em passos separados, o delete das escolhas antigas
   * passaria e o insert da nova poderia falhar — a pessoa ficaria sem nada.
   */
  let { error } = await supabase.rpc("trocar_escolhas", {
    p_inscrito: inscritoId,
    p_escolhas: escolhas,
    p_de_boa: deBoa,
  });

  // Banco ainda sem o schema novo: cai na função antiga, que só recebe os ids.
  if (error && /trocar_escolhas|PGRST202|Could not find the function/i.test(error.message)) {
    ({ error } = await supabase.rpc("trocar_esporte", {
      p_inscrito: inscritoId,
      p_esportes: escolhas.map((e) => e.id),
      p_de_boa: deBoa,
    }));
  }

  if (error) return NextResponse.json(traduzir(error.message), { status: statusDoErro(error.message) });
  return NextResponse.json({ status: "ok" });
}

function traduzir(msg: string) {
  if (/modalidade lotada/i.test(msg)) return { erro: "modalidade_lotada" };
  if (/limite_no_turno/i.test(msg)) return { erro: "limite_no_turno" };
  if (/nota_obrigatoria/i.test(msg)) return { erro: "nota_obrigatoria" };
  if (/parceiros_obrigatorios/i.test(msg)) return { erro: "parceiros_obrigatorios" };
  if (/oficina_mesmo_turno/i.test(msg)) return { erro: "oficina_mesmo_turno" };
  // A política de insert carrega o prazo de troca: recusa dela = prazo vencido.
  if (/row-level security|violates row-level/i.test(msg)) return { erro: "prazo_encerrado" };
  if (/inscrito_nao_encontrado/i.test(msg)) return { erro: "nao_encontrado" };
  console.error("[esportes] erro inesperado", msg);
  return { erro: "falha_ao_gravar" };
}

function statusDoErro(msg: string) {
  if (/lotada|limite_no_turno|oficina_mesmo_turno/i.test(msg)) return 409;
  if (/row-level security|violates row-level/i.test(msg)) return 403;
  if (/inscrito_nao_encontrado/i.test(msg)) return 404;
  return 400;
}
