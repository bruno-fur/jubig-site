import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";

/** Texto opcional: vazio vira null, para o banco não guardar "". */
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Evento = z.object({
  tipo: z.enum(["jubigday", "congresso", "tour"]),
  nome: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  prefixo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,5}$/),
  descricao: texto(800),
  dataEvento: dia,
  dataFim: dia.nullish().transform((v) => v ?? null),
  horaInicio: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish()
    .transform((v) => v ?? null),
  cidade: z.string().trim().min(2).max(80),
  localNome: texto(120),
  localEndereco: texto(200),
  localMapaUrl: z
    .url()
    .max(500)
    .nullish()
    .transform((v) => v ?? null),
  igrejaId: z
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  temInscricao: z.boolean(),
  temModalidades: z.boolean(),
  valorCentavos: z.number().int().min(0).max(10_000_000),
  idadeMinima: z.number().int().min(0).max(99),
  maxParcelas: z.number().int().min(1).max(12),
  vagas: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .nullish()
    .transform((v) => v ?? null),
  abertura: z.enum(["em_breve", "agendada", "abertas"]),
  /** "2026-09-20T19:00", horário de Brasília */
  inscricoesDe: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullish()
    .transform((v) => v ?? null),
  inscricoesAte: dia.nullish().transform((v) => v ?? null),
  trocaEsporteAteDias: z.number().int().min(0).max(60),
  maxEsportesPorTurno: z.number().int().min(0).max(10),
  pixChave: texto(77),
  pixNome: texto(25),
  pixCidade: texto(15),
  publicado: z.boolean(),
});

type DadosEvento = z.infer<typeof Evento>;

/**
 * Regras que atravessam campos. Cada uma vira um código de erro com mensagem
 * própria na tela — "confira os campos" não ajuda ninguém a achar o problema.
 */
function conferir(d: DadosEvento): string | null {
  if (d.dataFim && d.dataFim < d.dataEvento) return "data_fim_antes";
  if (!d.temInscricao) return null;

  if (d.abertura === "agendada" && !d.inscricoesDe) return "abertura_sem_data";
  if (d.inscricoesAte && d.inscricoesAte > (d.dataFim ?? d.dataEvento)) return "fecha_depois_do_evento";
  if (d.abertura === "agendada" && d.inscricoesDe && d.inscricoesAte && d.inscricoesDe.slice(0, 10) > d.inscricoesAte)
    return "abre_depois_de_fechar";

  // Chave de celular sem +55: o app do banco não acha e o pagamento não sai.
  if (d.pixChave && /^\d{10,11}$/.test(d.pixChave)) return "pix_celular_sem_55";

  const cobra = d.valorCentavos > 0;
  if (d.publicado && cobra && !(d.pixChave && d.pixNome && d.pixCidade)) return "pix_incompleto";
  return null;
}

function colunas(d: DadosEvento) {
  const inscricao = d.temInscricao;
  return {
    tipo: d.tipo,
    nome: d.nome,
    slug: d.slug,
    prefixo: d.prefixo,
    descricao: d.descricao,
    data_evento: d.dataEvento,
    data_fim: d.dataFim,
    hora_inicio: d.horaInicio,
    cidade: d.cidade,
    local_nome: d.localNome,
    local_endereco: d.localEndereco,
    local_mapa_url: d.localMapaUrl,
    igreja_id: d.igrejaId,
    tem_inscricao: inscricao,
    tem_modalidades: inscricao && d.temModalidades,
    valor_centavos: inscricao ? d.valorCentavos : 0,
    idade_minima: d.idadeMinima,
    max_parcelas: d.maxParcelas,
    vagas: d.vagas,
    inscricoes_em_breve: inscricao && d.abertura === "em_breve",
    inscricoes_de: inscricao && d.abertura === "agendada" ? `${d.inscricoesDe}:00-03:00` : null,
    inscricoes_ate: d.inscricoesAte,
    troca_esporte_ate_dias: d.trocaEsporteAteDias,
    max_esportes_por_turno: d.maxEsportesPorTurno,
    pix_chave: d.pixChave,
    pix_nome: d.pixNome?.toUpperCase() ?? null,
    pix_cidade: d.pixCidade?.toUpperCase() ?? null,
    publicado: d.publicado,
  };
}

async function exigirAdminNaApi() {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if ((await papelDe(sessao.userId)) !== "admin")
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });
  return null;
}

/**
 * Prefixo repetido quebra o código da inscrição: o contador é por evento, então
 * dois eventos "JD" gerariam dois "JD-0001" e o segundo nunca gravaria.
 */
async function prefixoEmUso(prefixo: string, exceto?: string) {
  const supabase = await createClient();
  let consulta = supabase.from("eventos").select("id", { count: "exact", head: true }).eq("prefixo", prefixo);
  if (exceto) consulta = consulta.neq("id", exceto);
  const { count } = await consulta;
  return (count ?? 0) > 0;
}

function erroDoBanco(mensagem: string) {
  if (/eventos_slug_key|duplicate key.*slug/i.test(mensagem))
    return NextResponse.json({ erro: "slug_repetido" }, { status: 409 });
  console.error("[eventos] gravar falhou", mensagem);
  return NextResponse.json({ erro: "falha_ao_gravar" }, { status: 400 });
}

export async function POST(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = Evento.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const problema = conferir(corpo.data);
  if (problema) return NextResponse.json({ erro: problema }, { status: 400 });
  if (await prefixoEmUso(corpo.data.prefixo))
    return NextResponse.json({ erro: "prefixo_repetido" }, { status: 409 });

  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos").insert(colunas(corpo.data)).select("id").single();
  if (error) return erroDoBanco(error.message);
  return NextResponse.json({ status: "ok", id: data.id });
}

export async function PATCH(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = Evento.extend({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const { id, ...dados } = corpo.data;
  const problema = conferir(dados);
  if (problema) return NextResponse.json({ erro: problema }, { status: 400 });
  if (await prefixoEmUso(dados.prefixo, id))
    return NextResponse.json({ erro: "prefixo_repetido" }, { status: 409 });

  const supabase = await createClient();
  const { data, error } = await supabase.from("eventos").update(colunas(dados)).eq("id", id).select("id");
  if (error) return erroDoBanco(error.message);
  if (!data?.length) return NextResponse.json({ erro: "evento_nao_encontrado" }, { status: 404 });
  return NextResponse.json({ status: "ok", id });
}

export async function DELETE(req: Request) {
  const negado = await exigirAdminNaApi();
  if (negado) return negado;

  const corpo = z.object({ id: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "pedido_invalido" }, { status: 400 });

  const supabase = await createClient();

  // Evento com inscrição não some: tem pagamento e comprovante pendurados nele.
  const { count } = await supabase
    .from("inscricoes")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", corpo.data.id);
  if ((count ?? 0) > 0)
    return NextResponse.json({ erro: "tem_inscricoes", inscricoes: count }, { status: 409 });

  const { error } = await supabase.from("eventos").delete().eq("id", corpo.data.id);
  if (error) return erroDoBanco(error.message);
  return NextResponse.json({ status: "ok" });
}
