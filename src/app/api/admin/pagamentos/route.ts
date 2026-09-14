import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { pagamentosDoEvento, type SituacaoPagamento } from "@/lib/pagamentos";
import { ROTULO_STATUS } from "@/tipos/db";

const ROTULO_SITUACAO: Record<SituacaoPagamento, string> = {
  quitado: "Quitado",
  parcial: "Pago em parte",
  em_analise: "Comprovante em análise",
  recusado: "Comprovante recusado",
  sem_comprovante: "Sem comprovante",
  cancelada: "Cancelada",
};

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

/** Planilha de pagamentos do evento: uma linha por inscrição. Mesmo formato do CSV de inscritos. */
export async function GET(req: NextRequest) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!(await papelDe(sessao.userId))) return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const slug = req.nextUrl.searchParams.get("evento");
  if (!slug) return NextResponse.json({ erro: "sem_evento" }, { status: 400 });

  const supabase = await createClient();
  const { data: evento } = await supabase.from("eventos").select("id, slug").eq("slug", slug).maybeSingle();
  if (!evento) return NextResponse.json({ erro: "evento_nao_encontrado" }, { status: 404 });

  const resumo = await pagamentosDoEvento(supabase, evento.id);

  const cabecalho = [
    "Código",
    "Status da inscrição",
    "Situação do pagamento",
    "Responsável",
    "E-mail",
    "Pessoas",
    "Valor (R$)",
    "Parcelas",
    "Pago (R$)",
    "Falta (R$)",
    "Comprovantes enviados",
    "Aprovados",
    "Em análise",
    "Recusados",
    "Último envio",
    "Inscrita em",
  ];

  const celula = (v: string | number) => {
    const t = String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  const linhas = resumo.inscricoes.map((i) =>
    [
      i.codigo,
      ROTULO_STATUS[i.status],
      ROTULO_SITUACAO[i.situacao],
      i.responsavel,
      i.email,
      i.pessoas,
      reais(i.valor),
      i.parcelas,
      reais(i.pago),
      reais(i.falta),
      i.enviados,
      i.aprovados,
      i.pendentes,
      i.recusados,
      quando(i.ultimoEnvio),
      quando(i.criadaEm),
    ]
      .map(celula)
      .join(";")
  );

  const csv = "﻿" + [cabecalho.join(";"), ...linhas].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pagamentos-${evento.slug}.csv"`,
      "cache-control": "no-store",
    },
  });
}
