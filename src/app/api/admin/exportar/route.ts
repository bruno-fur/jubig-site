import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pegarSessao } from "@/lib/sessao";
import { formatarCPF, formatarDataCurta, idadeNaData } from "@/lib/validacao";
import { ROTULO_STATUS, type StatusInscricao } from "@/tipos/db";

/**
 * CSV para a diretoria montar as chaves e conferir a caravana.
 *
 * Separador ";" e BOM no começo: é o que faz o Excel em português abrir o
 * arquivo já com as colunas separadas e os acentos certos.
 */
export async function GET(req: NextRequest) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  const supabase = await createClient();
  const { data: membro } = await supabase
    .from("diretoria")
    .select("user_id")
    .eq("user_id", sessao.userId)
    .maybeSingle();
  if (!membro) return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const slug = req.nextUrl.searchParams.get("evento");
  const modalidade = req.nextUrl.searchParams.get("modalidade");
  if (!slug) return NextResponse.json({ erro: "sem_evento" }, { status: 400 });

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nome, data_evento, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) return NextResponse.json({ erro: "evento_nao_encontrado" }, { status: 404 });

  const { data: inscritos } = await supabase
    .from("inscritos")
    .select(
      "nome, cpf, nascimento, telefone, igreja, de_boa, inscricoes(codigo, status, parcelas, valor_centavos, criado_em), inscritos_esportes(esportes(id, nome, horario))"
    )
    .eq("evento_id", evento.id)
    .order("nome", { ascending: true });

  type Linha = {
    nome: string;
    cpf: string;
    nascimento: string;
    telefone: string | null;
    igreja: string;
    de_boa: boolean;
    inscricoes: {
      codigo: string;
      status: StatusInscricao;
      parcelas: number;
      valor_centavos: number;
      criado_em: string;
    };
    inscritos_esportes: { esportes: { id: string; nome: string; horario: string } }[];
  };

  let linhas = (inscritos ?? []) as unknown as Linha[];
  if (modalidade)
    linhas = linhas.filter((l) => l.inscritos_esportes.some((e) => e.esportes?.id === modalidade));

  const cabecalho = [
    "Codigo",
    "Status",
    "Nome",
    "CPF",
    "Nascimento",
    "Idade no evento",
    "Igreja",
    "Telefone",
    "Modalidades",
    "So de boa",
    "Parcelas",
    "Valor da inscricao",
    "Inscrito em",
  ];

  const corpo = linhas.map((l) =>
    [
      l.inscricoes.codigo,
      ROTULO_STATUS[l.inscricoes.status],
      l.nome,
      formatarCPF(l.cpf),
      formatarDataCurta(l.nascimento),
      String(idadeNaData(l.nascimento, evento.data_evento)),
      l.igreja,
      l.telefone ?? "",
      l.inscritos_esportes
        .map((e) => (e.esportes ? `${e.esportes.nome} (${e.esportes.horario})` : ""))
        .filter(Boolean)
        .join(" | "),
      l.de_boa ? "sim" : "nao",
      String(l.inscricoes.parcelas),
      (l.inscricoes.valor_centavos / 100).toFixed(2).replace(".", ","),
      formatarDataCurta(l.inscricoes.criado_em),
    ].map(csv)
  );

  const texto = "﻿" + [cabecalho.map(csv), ...corpo].map((l) => l.join(";")).join("\r\n");
  const sufixo = modalidade ? "-modalidade" : "";

  return new NextResponse(texto, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="jubig-${evento.slug}${sufixo}.csv"`,
      "cache-control": "no-store",
    },
  });
}

/** Aspas dobradas e campo entre aspas: nome com ; ou quebra de linha não estraga a coluna. */
function csv(valor: string) {
  return `"${(valor ?? "").replace(/"/g, '""')}"`;
}
