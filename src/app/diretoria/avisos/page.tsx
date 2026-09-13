import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { PublicarAviso } from "./PublicarAviso";

export const metadata: Metadata = { title: "Avisos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Avisos() {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ data: eventos }, { data: avisos }, { data: painel }] = await Promise.all([
    supabase.from("eventos").select("id, nome, slug, data_evento, tem_inscricao").order("data_evento"),
    supabase
      .from("avisos")
      .select("id, evento_id, titulo, mensagem, criado_em, enviados")
      .order("criado_em", { ascending: false })
      .limit(50),
    supabase.from("painel_evento").select("evento_id, inscricoes"),
  ]);

  return (
    <PublicarAviso
      eventos={(eventos ?? []).map((e) => ({
        id: e.id as string,
        nome: e.nome as string,
        temInscricao: e.tem_inscricao as boolean,
        inscricoes: (painel ?? []).find((p) => p.evento_id === e.id)?.inscricoes ?? 0,
      }))}
      avisos={(avisos ?? []) as {
        id: string;
        evento_id: string;
        titulo: string;
        mensagem: string;
        criado_em: string;
        enviados: number;
      }[]}
    />
  );
}
