import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { igrejasParaEscolha, situacaoInscricoes } from "@/lib/eventos";
import { FormularioEvento, ApagarEvento } from "../FormularioEvento";
import { ConteudoEvento, type ItemProgramacao, type ItemDuvida } from "../ConteudoEvento";
import type { Evento } from "@/tipos/db";

export const metadata: Metadata = { title: "Editar evento", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditarEvento({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: evento }, igrejas, { count: modalidades }, { count: inscricoes }, { data: programacao }, { data: duvidas }] =
    await Promise.all([
      supabase.from("eventos").select("*").eq("id", id).maybeSingle(),
      igrejasParaEscolha(),
      supabase.from("esportes").select("id", { count: "exact", head: true }).eq("evento_id", id),
      supabase.from("inscricoes").select("id", { count: "exact", head: true }).eq("evento_id", id),
      supabase
        .from("programacao")
        .select("*")
        .eq("evento_id", id)
        .order("dia", { nullsFirst: true })
        .order("hora", { nullsFirst: false })
        .order("ordem"),
      supabase.from("duvidas").select("*").eq("evento_id", id).order("ordem"),
    ]);

  if (!evento) notFound();
  const e = evento as Evento;
  const situacao = situacaoInscricoes(e);

  /*
   * O que falta para o evento funcionar de ponta a ponta. Cada item é algo que
   * já deu problema: PIX sem +55, evento pago sem chave, JubigDay sem modalidade.
   */
  const pendencias = [
    e.tem_inscricao && e.valor_centavos > 0 && !(e.pix_chave && e.pix_nome && e.pix_cidade)
      ? "Falta completar o PIX (chave, recebedor e cidade)."
      : null,
    e.tem_modalidades && (modalidades ?? 0) === 0 ? "Nenhuma modalidade cadastrada." : null,
    !e.publicado ? "Rascunho: o evento não aparece no site." : null,
    e.tem_inscricao && situacao === "em_breve" ? "Inscrições marcadas como \"em breve\": ninguém consegue se inscrever." : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <Link href="/diretoria/eventos" className="text-sm font-semibold text-apagado hover:underline">
        ← Eventos
      </Link>
      <div className="mt-2 mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="titulo text-2xl">{e.nome}</h2>
        <p className="flex gap-4 text-sm">
          {e.tem_modalidades && (
            <Link href="/diretoria/modalidades" className="font-semibold text-laranja-escuro hover:underline">
              Modalidades ({modalidades ?? 0})
            </Link>
          )}
          {e.publicado && (
            <Link href={`/${e.slug}`} className="font-semibold text-apagado hover:underline">
              Ver no site
            </Link>
          )}
        </p>
      </div>

      {pendencias.length > 0 ? (
        <section className="cartao mb-6 border-laranja/50 bg-laranja/5 p-5">
          <p className="titulo text-lg">Antes de abrir as inscrições</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-tinta">
            {pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="cartao mb-6 flex items-center gap-3 border-ok/40 bg-ok/5 p-4">
          <img src="/juca/joia.webp" alt="" className="h-10 w-10 object-contain" />
          <p className="text-sm font-semibold text-ok">Tudo pronto: evento publicado e configurado.</p>
        </section>
      )}

      <FormularioEvento evento={e} igrejas={igrejas} inscricoes={inscricoes ?? 0} />

      <ConteudoEvento
        eventoId={e.id}
        dataEvento={e.data_evento}
        dataFim={e.data_fim}
        programacao={(programacao ?? []) as ItemProgramacao[]}
        duvidas={(duvidas ?? []) as ItemDuvida[]}
      />

      <ApagarEvento id={e.id} inscricoes={inscricoes ?? 0} />
    </>
  );
}
