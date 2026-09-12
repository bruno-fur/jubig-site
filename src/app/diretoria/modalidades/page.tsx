import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { GerenciarModalidades } from "./GerenciarModalidades";
import type { Esporte, Evento } from "@/tipos/db";

export const metadata: Metadata = { title: "Modalidades" };

export default async function Modalidades() {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ data: eventos }, { data: esportes }, { data: ocupacao }] = await Promise.all([
    supabase.from("eventos").select("*").order("data_evento"),
    supabase.from("esportes").select("*").order("turno").order("ordem"),
    supabase.from("vagas_por_esporte").select("esporte_id, ocupadas"),
  ]);

  // Quantos já escolheram cada modalidade — o que decide se dá para apagar.
  const inscritos = new Map(
    (ocupacao ?? []).map((o) => [o.esporte_id as string, o.ocupadas as number])
  );

  return (
    <GerenciarModalidades
      eventos={(eventos ?? []) as Evento[]}
      esportes={(esportes ?? []) as Esporte[]}
      ocupacao={Object.fromEntries(inscritos)}
    />
  );
}
