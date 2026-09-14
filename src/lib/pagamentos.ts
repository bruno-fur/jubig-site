import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todosOsUsuarios } from "@/lib/usuarios";
import type { StatusInscricao } from "@/tipos/db";

export type SituacaoPagamento =
  | "quitado"
  | "parcial"
  | "em_analise"
  | "recusado"
  | "sem_comprovante"
  | "cancelada";

export type ComprovanteDoPagamento = {
  id: string;
  codigo: string;
  statusInscricao: StatusInscricao;
  responsavel: string;
  parcela: number;
  parcelas: number;
  valorParcela: number;
  enviadoEm: string;
  situacao: "pendente" | "aprovado" | "recusado";
  avaliadoPor: string | null;
  avaliadoEm: string | null;
  motivo: string | null;
  caminho: string;
};

export type InscricaoDoPagamento = {
  codigo: string;
  status: StatusInscricao;
  responsavel: string;
  email: string;
  pessoas: number;
  valor: number;
  parcelas: number;
  pago: number;
  falta: number;
  enviados: number;
  aprovados: number;
  pendentes: number;
  recusados: number;
  ultimoEnvio: string | null;
  criadaEm: string;
  situacao: SituacaoPagamento;
};

export type ResumoPagamentos = {
  esperado: number;
  recebido: number;
  emAnalise: number;
  falta: number;
  aDevolver: number;
  inscricoes: InscricaoDoPagamento[];
  comprovantes: ComprovanteDoPagamento[];
};

type Linha = {
  codigo: string;
  status: StatusInscricao;
  parcelas: number;
  valor_centavos: number;
  criado_em: string;
  responsavel_id: string;
  comprovantes: {
    id: string;
    parcela: number;
    caminho: string;
    enviado_em: string;
    aprovado: boolean | null;
    avaliado_em: string | null;
    avaliado_por: string | null;
    motivo: string | null;
  }[];
  inscritos: { count: number }[];
};

/**
 * Tudo que entrou (e o que falta entrar) de um evento.
 *
 * O valor da parcela segue a mesma conta da tela de pagamento (arredonda para
 * cima), e o pago nunca passa do total — senão a soma de 3x R$33,34 mostraria
 * um centavo a mais do que a inscrição vale.
 *
 * Inscrição cancelada fica fora do esperado e do recebido; se tinha parcela
 * aprovada, entra em "a devolver", que é dinheiro que a JUBIG precisa acertar.
 */
export async function pagamentosDoEvento(supabase: SupabaseClient, eventoId: string): Promise<ResumoPagamentos> {
  const [{ data }, usuarios] = await Promise.all([
    supabase
      .from("inscricoes")
      .select(
        "codigo, status, parcelas, valor_centavos, criado_em, responsavel_id, comprovantes(id, parcela, caminho, enviado_em, aprovado, avaliado_em, avaliado_por, motivo), inscritos(count)"
      )
      .eq("evento_id", eventoId)
      .order("criado_em", { ascending: true })
      .limit(5000),
    todosOsUsuarios(),
  ]);

  const porId = new Map(usuarios.map((u) => [u.id, u]));
  const nomeDe = (id: string | null) => (id ? porId.get(id)?.nome || porId.get(id)?.email || "—" : null);

  const resumo: ResumoPagamentos = {
    esperado: 0,
    recebido: 0,
    emAnalise: 0,
    falta: 0,
    aDevolver: 0,
    inscricoes: [],
    comprovantes: [],
  };

  for (const i of (data ?? []) as Linha[]) {
    const valorParcela = Math.ceil(i.valor_centavos / i.parcelas);
    const aprovadas = new Set(i.comprovantes.filter((c) => c.aprovado === true).map((c) => c.parcela));
    const pendentes = i.comprovantes.filter((c) => c.aprovado === null).length;
    const recusados = i.comprovantes.filter((c) => c.aprovado === false).length;
    const pago = Math.min(i.valor_centavos, aprovadas.size * valorParcela);
    const falta = i.valor_centavos - pago;
    const cancelada = i.status === "cancelada";
    const responsavel = porId.get(i.responsavel_id);

    const ultimo = i.comprovantes.map((c) => c.enviado_em).sort().at(-1) ?? null;
    const ultimoRecusado =
      i.comprovantes.slice().sort((a, b) => a.enviado_em.localeCompare(b.enviado_em)).at(-1)?.aprovado === false;

    const situacao: SituacaoPagamento = cancelada
      ? "cancelada"
      : falta <= 0
        ? "quitado"
        : pendentes > 0
          ? "em_analise"
          : ultimoRecusado
            ? "recusado"
            : pago > 0
              ? "parcial"
              : "sem_comprovante";

    if (cancelada) {
      resumo.aDevolver += pago;
    } else {
      resumo.esperado += i.valor_centavos;
      resumo.recebido += pago;
      resumo.emAnalise += Math.min(falta, pendentes * valorParcela);
    }

    resumo.inscricoes.push({
      codigo: i.codigo,
      status: i.status,
      responsavel: responsavel?.nome || responsavel?.email || "—",
      email: responsavel?.email ?? "",
      pessoas: i.inscritos[0]?.count ?? 0,
      valor: i.valor_centavos,
      parcelas: i.parcelas,
      pago,
      falta: cancelada ? 0 : falta,
      enviados: i.comprovantes.length,
      aprovados: aprovadas.size,
      pendentes,
      recusados,
      ultimoEnvio: ultimo,
      criadaEm: i.criado_em,
      situacao,
    });

    for (const c of i.comprovantes) {
      resumo.comprovantes.push({
        id: c.id,
        codigo: i.codigo,
        statusInscricao: i.status,
        responsavel: responsavel?.nome || responsavel?.email || "—",
        parcela: c.parcela,
        parcelas: i.parcelas,
        valorParcela,
        enviadoEm: c.enviado_em,
        situacao: c.aprovado === null ? "pendente" : c.aprovado ? "aprovado" : "recusado",
        avaliadoPor: nomeDe(c.avaliado_por),
        avaliadoEm: c.avaliado_em,
        motivo: c.motivo,
        caminho: c.caminho,
      });
    }
  }

  resumo.falta = resumo.esperado - resumo.recebido;
  resumo.comprovantes.sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
  return resumo;
}
