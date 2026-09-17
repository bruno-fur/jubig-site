import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { validarCPF } from "@/lib/validacao";

const Pessoa = z.object({
  nome: z.string().trim().min(3).max(120),
  cpf: z.string().trim(),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  telefone: z.string().trim().max(30).nullish(),
  igrejaId: z.uuid(),
  deBoa: z.boolean().default(false),
  esportes: z
    .array(
      z.object({
        id: z.uuid(),
        nota: z.number().int().min(1).max(5).nullish(),
        parceiros: z.array(z.string().trim().min(1).max(120)).max(2).nullish(),
      })
    )
    .max(10)
    .default([]),
});

const Pedido = z.object({
  evento: z.string().trim().min(1),
  forma: z.enum(["pix", "dinheiro", "cartao", "cortesia"]),
  /** Nulo = valor do evento vezes o número de pessoas. */
  valorCentavos: z.number().int().min(0).max(10_000_000).nullish(),
  observacao: z.string().trim().max(300).nullish(),
  inscritos: z.array(Pessoa).min(1).max(20),
});

/** Erro do banco -> o que a tela mostra. */
function traduzir(msg: string) {
  if (msg.includes("sem_permissao")) return { erro: "sem_permissao", status: 403 };
  if (msg.includes("evento_nao_encontrado")) return { erro: "evento_nao_encontrado", status: 404 };
  if (msg.includes("evento_sem_inscricao")) return { erro: "evento_sem_inscricao", status: 400 };
  if (msg.includes("evento_lotado")) return { erro: "evento_lotado", status: 409 };
  if (msg.includes("forma_invalida")) return { erro: "forma_invalida", status: 400 };
  if (msg.includes("idade_minima")) return { erro: "idade_minima", status: 400, nome: msg.split(":")[1] };
  if (msg.includes("igreja_invalida")) return { erro: "igreja_invalida", status: 400, nome: msg.split(":")[1] };
  if (msg.includes("inscrito_unico_por_evento") || msg.includes("duplicate key"))
    return { erro: "cpf_repetido", status: 409 };
  if (msg.includes("oficina_mesmo_turno")) return { erro: "oficina_mesmo_turno", status: 400 };
  if (msg.includes("nota_obrigatoria") || msg.includes("parceiros"))
    return { erro: "escolha_incompleta", status: 400 };
  return { erro: "falha_ao_gravar", status: 400 };
}

/**
 * Inscrição no balcão: a diretoria inscreve quem chegou no dia e pagou ali.
 *
 * Toda a diretoria, não só admin — quem está na mesa recebendo o dinheiro
 * costuma ser membro. A inscrição nasce confirmada e a regra de quem pode
 * criar mora em `criar_inscricao_balcao`, no banco.
 */
export async function POST(req: Request) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!(await papelDe(sessao.userId)))
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const corpo = Pedido.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });
  const d = corpo.data;

  // CPF aqui e no banco: o dígito verificador é o que separa erro de digitação
  // na mesa de CPF inventado.
  const cpfs = new Set<string>();
  for (const p of d.inscritos) {
    const cpf = p.cpf.replace(/\D/g, "");
    if (!validarCPF(cpf)) return NextResponse.json({ erro: "cpf_invalido", nome: p.nome }, { status: 400 });
    if (cpfs.has(cpf)) return NextResponse.json({ erro: "cpf_repetido", nome: p.nome }, { status: 400 });
    cpfs.add(cpf);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_inscricao_balcao", {
    p_slug: d.evento,
    p_inscritos: d.inscritos.map((p) => ({
      nome: p.nome,
      cpf: p.cpf.replace(/\D/g, ""),
      nascimento: p.nascimento,
      telefone: p.telefone || null,
      igrejaId: p.igrejaId,
      deBoa: p.deBoa,
      esportes: p.esportes.map((e) => ({
        id: e.id,
        nota: e.nota ?? null,
        parceiros: e.parceiros?.filter((x) => x.trim()) ?? null,
      })),
    })),
    p_forma: d.forma,
    p_valor_centavos: d.valorCentavos ?? null,
    p_observacao: d.observacao || null,
  });

  if (error) {
    console.error("[inscricoes/balcao] falhou", error.message);
    const t = traduzir(error.message);
    return NextResponse.json({ erro: t.erro, nome: t.nome }, { status: t.status });
  }

  return NextResponse.json({ codigo: String(data) });
}
