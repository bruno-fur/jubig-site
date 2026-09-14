import type { Metadata } from "next";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/eventos";
import { pagamentosDoEvento } from "@/lib/pagamentos";
import { ListaPagamentos } from "./ListaPagamentos";

export const metadata: Metadata = { title: "Pagamentos", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Tudo que entrou e o que falta entrar, por evento.
 *
 * Diretoria inteira vê (membro também valida comprovante). Os links dos
 * comprovantes são gerados de uma vez só e valem 10 minutos.
 */
export default async function Pagamentos({ searchParams }: { searchParams: Promise<{ evento?: string }> }) {
  await exigirDiretoria();
  const { evento: pedido } = await searchParams;
  const supabase = await createClient();

  const { data: eventos } = await supabase
    .from("eventos")
    .select("id, slug, nome, data_evento")
    .eq("tem_inscricao", true)
    .order("data_evento", { ascending: true });

  const lista = eventos ?? [];
  // Sem escolha: o próximo evento que ainda vai acontecer; se não houver, o último.
  const atual =
    lista.find((e) => e.slug === pedido) ?? lista.find((e) => e.data_evento >= hojeISO()) ?? lista.at(-1);

  if (!atual) {
    return (
      <div className="cartao flex items-center gap-4 p-6">
        <img src="/juca/heh.webp" alt="" className="w-16" />
        <p className="text-apagado">Nenhum evento com inscrição ainda.</p>
      </div>
    );
  }

  const resumo = await pagamentosDoEvento(supabase, atual.id);

  const caminhos = resumo.comprovantes.map((c) => c.caminho);
  const { data: links } = caminhos.length
    ? await supabase.storage.from("comprovantes").createSignedUrls(caminhos, 60 * 10)
    : { data: [] };
  const urlDe = new Map((links ?? []).map((l) => [l.path, l.signedUrl]));

  return (
    <ListaPagamentos
      eventos={lista.map((e) => ({ slug: e.slug, nome: e.nome }))}
      eventoAtual={atual.slug}
      resumo={{
        ...resumo,
        comprovantes: resumo.comprovantes.map(({ caminho, ...c }) => ({
          ...c,
          url: urlDe.get(caminho) ?? null,
          ehPdf: caminho.toLowerCase().endsWith(".pdf"),
        })),
      }}
    />
  );
}
