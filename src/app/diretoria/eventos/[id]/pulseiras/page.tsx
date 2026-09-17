import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import type { Equipe, Evento, LinhaPlacar, PontoEquipe } from "@/tipos/db";
import { CabecalhoEvento } from "../../CabecalhoEvento";
import { Pulseiras, type PessoaEquipe } from "./Pulseiras";

export const metadata: Metadata = { title: "Pulseiras", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Pulseiras de um evento: equipes por cor, sorteio e placar.
 *
 * Diretoria toda, não só admin — no dia, quem está na quadra lança ponto e
 * remaneja gente.
 */
export default async function PaginaPulseiras({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirDiretoria();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("eventos").select("*").eq("id", id).maybeSingle();
  const evento = data as Evento | null;
  if (!evento || !evento.tem_inscricao) notFound();

  const [equipes, placar, pontos, pessoas] = await Promise.all([
    supabase.from("equipes").select("*").eq("evento_id", evento.id).order("ordem"),
    supabase.from("placar").select("*").eq("evento_id", evento.id),
    supabase
      .from("pontos_equipe")
      .select("id, equipe_id, valor, motivo, criado_em, equipes!inner(evento_id)")
      .eq("equipes.evento_id", evento.id)
      .order("criado_em", { ascending: false })
      .limit(200),
    supabase
      .from("inscritos")
      .select("id, nome, igreja, equipe_id, checkin_em, inscricoes!inner(status)")
      .eq("evento_id", evento.id)
      .eq("ativo", true)
      .eq("inscricoes.status", "confirmada")
      .order("nome"),
  ]);

  const cabecalho = <CabecalhoEvento evento={evento} atual="pulseiras" admin={sessao.papel === "admin"} />;

  // Tabela nova: até o schema rodar, a tela explica em vez de quebrar.
  if (equipes.error) {
    return (
      <>
        {cabecalho}
        <p className="cartao p-5 text-apagado">
          As pulseiras precisam do <code>supabase/schema.sql</code> mais recente. Rode o arquivo no SQL Editor do
          Supabase e recarregue esta página.
        </p>
      </>
    );
  }

  return (
    <>
      {cabecalho}
      <Pulseiras
        evento={{ id: evento.id, nome: evento.nome, tipo: evento.tipo }}
        equipes={(equipes.data ?? []) as Equipe[]}
        placar={(placar.data ?? []) as LinhaPlacar[]}
        pontos={(pontos.data ?? []) as unknown as PontoEquipe[]}
        pessoas={((pessoas.data ?? []) as unknown as PessoaEquipe[]).map((p) => ({
          id: p.id,
          nome: p.nome,
          igreja: p.igreja,
          equipe_id: p.equipe_id,
          checkin_em: p.checkin_em,
        }))}
      />
    </>
  );
}
