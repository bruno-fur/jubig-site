import type { Metadata } from "next";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { GerenciarIgrejas } from "./GerenciarIgrejas";
import type { Igreja } from "@/tipos/db";

export const metadata: Metadata = { title: "Igrejas" };

export default async function Igrejas() {
  await exigirAdmin();
  const supabase = await createClient();

  // Inclui as desativadas: a política deixa a diretoria ver todas.
  const { data } = await supabase.from("igrejas").select("*").order("ordem").order("cidade");

  return <GerenciarIgrejas igrejas={(data ?? []) as Igreja[]} />;
}
