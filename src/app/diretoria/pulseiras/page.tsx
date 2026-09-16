import type { Metadata } from "next";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { ROTULO_TIPO, type Equipe, type Evento, type LinhaPlacar, type PontoEquipe } from "@/tipos/db";
import { Pulseiras, type PessoaEquipe } from "./Pulseiras";
import { SeletorEvento, escolherEvento } from "@/components/SeletorEvento";

export const metadata: Metadata = { title: "Pulseiras", robots: { index: false } };

/**
 * Equipes por cor: o JubigDay sorteia na chegada, o Congresso usa na gincana.
 *
 * Só eventos com inscrição — no tour não há lista de gente para dividir.
 */
export default async function PaginaPulseiras({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  await exigirDiretoria();
  const { evento: slug } = await searchParams;
  const supabase = await createClient();

  const { data: lista } = await supabase
    .from("eventos")
    .select("*")
    .eq("tem_inscricao", true)
    .order("data_evento");
  const eventos = (lista ?? []) as Evento[];

  // Sem escolha: o próximo JubigDay que ainda não passou.
  const evento = escolherEvento(eventos, slug, (e) => e.tipo === "jubigday");

  if (!evento) {
    return <p className="text-apagado">Nenhum evento com inscrição cadastrado ainda.</p>;
  }

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

  const seletor = (
    <SeletorEvento
      base="/diretoria/pulseiras"
      atual={evento.slug}
      eventos={eventos.map((e) => ({ slug: e.slug, nome: e.nome, detalhe: ROTULO_TIPO[e.tipo] }))}
    />
  );

  // Tabela nova: até o schema rodar, a tela explica em vez de quebrar.
  if (equipes.error) {
    return (
      <>
        {seletor}
        <p className="cartao p-5 text-apagado">
          As pulseiras precisam do <code>supabase/schema.sql</code> mais recente. Rode o arquivo no SQL Editor do
          Supabase e recarregue esta página.
        </p>
      </>
    );
  }

  return (
    <>
      {seletor}
      <Pulseiras
        key={evento.id}
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
