import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { ROTULO_FORMATO, ROTULO_TURNO, type Esporte, type StatusInscricao } from "@/tipos/db";
import { Participantes, type Participante } from "./Participantes";

export const metadata: Metadata = { title: "Inscritos na modalidade", robots: { index: false } };
export const dynamic = "force-dynamic";

type Linha = {
  nota: number | null;
  parceiros: string[] | null;
  inscritos: {
    nome: string;
    igreja: string;
    ativo: boolean;
    inscricoes: { codigo: string; status: StatusInscricao };
  } | null;
};

/**
 * Quem escolheu esta modalidade — e, no time sorteado, o sorteio.
 *
 * Diretoria inteira: é quem monta chave e time no dia. Inscrição cancelada
 * fica de fora.
 */
export default async function InscritosDaModalidade({ params }: { params: Promise<{ id: string }> }) {
  await exigirDiretoria();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: esporte }, { data: linhas }] = await Promise.all([
    supabase.from("esportes").select("*, eventos(nome, slug)").eq("id", id).maybeSingle(),
    supabase
      .from("inscritos_esportes")
      .select("*, inscritos(nome, igreja, ativo, inscricoes(codigo, status))")
      .eq("esporte_id", id),
  ]);

  if (!esporte) notFound();
  const e = esporte as Esporte & { eventos: { nome: string; slug: string } };
  const oficina = e.categoria === "oficina";

  const participantes: Participante[] = ((linhas ?? []) as unknown as Linha[])
    .filter((l) => l.inscritos?.ativo)
    .map((l) => ({
      nome: l.inscritos!.nome,
      igreja: l.inscritos!.igreja,
      codigo: l.inscritos!.inscricoes.codigo,
      status: l.inscritos!.inscricoes.status,
      nota: l.nota ?? null,
      parceiros: l.parceiros ?? [],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <>
      <Link href="/diretoria/modalidades" className="text-sm font-semibold text-apagado hover:underline print:hidden">
        ← Modalidades
      </Link>
      <div className="mt-2 mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="titulo text-2xl">{e.nome}</h2>
          <p className="text-sm text-apagado">
            {e.eventos.nome} · {ROTULO_TURNO[e.turno]} ·{" "}
            {oficina ? `Oficina${e.responsavel ? ` com ${e.responsavel}` : ""}` : ROTULO_FORMATO[e.formato ?? "individual"]} ·{" "}
            {participantes.length}/{e.vagas} vagas
          </p>
        </div>
        <a
          href={`/api/admin/exportar?evento=${e.eventos.slug}&modalidade=${e.id}`}
          className="botao-secundario print:hidden"
        >
          Baixar lista (CSV)
        </a>
      </div>

      <Participantes formato={oficina ? "individual" : (e.formato ?? "individual")} participantes={participantes} />
    </>
  );
}
