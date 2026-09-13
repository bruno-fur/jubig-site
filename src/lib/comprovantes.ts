import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Comprovante } from "@/tipos/db";

export type ComprovanteComLink = Comprovante & {
  url: string | null;
  avaliadoPorNome: string | null;
  ehPdf: boolean;
};

/**
 * Comprovantes de uma inscrição com link temporário para abrir, em qualquer
 * situação — pendente, aprovado ou recusado.
 *
 * O link vale 10 minutos e é gerado com o cliente de quem está vendo: a
 * política do storage só libera para o dono da inscrição ou para a diretoria.
 * Um link que vaze no histórico do navegador expira sozinho.
 */
export async function comprovantesComLink(
  supabase: SupabaseClient,
  comprovantes: Comprovante[]
): Promise<ComprovanteComLink[]> {
  const ids = [...new Set(comprovantes.map((c) => c.avaliado_por).filter(Boolean))] as string[];
  const { data: perfis } = ids.length
    ? await supabase.from("perfis").select("id, nome").in("id", ids)
    : { data: [] as { id: string; nome: string }[] };

  return Promise.all(
    comprovantes
      .slice()
      .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em))
      .map(async (c) => {
        const { data } = await supabase.storage.from("comprovantes").createSignedUrl(c.caminho, 60 * 10);
        return {
          ...c,
          url: data?.signedUrl ?? null,
          avaliadoPorNome: perfis?.find((p) => p.id === c.avaliado_por)?.nome || null,
          ehPdf: c.caminho.toLowerCase().endsWith(".pdf"),
        };
      })
  );
}
