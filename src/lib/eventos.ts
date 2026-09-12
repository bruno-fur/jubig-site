import { createClient } from "@/lib/supabase/server";
import type { Evento, VagaEsporte } from "@/tipos/db";

/** "2026-09-12" no fuso local — comparar data de evento com `new Date()` erra o dia. */
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function eventosPublicados(): Promise<Evento[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("eventos")
    .select("*")
    .gte("data_evento", hojeISO())
    .order("data_evento", { ascending: true });
  return (data ?? []) as Evento[];
}

export async function proximoEvento(): Promise<Evento | null> {
  const lista = await eventosPublicados();
  return lista[0] ?? null;
}

export async function eventoPorSlug(slug: string): Promise<Evento | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("eventos").select("*").eq("slug", slug).maybeSingle();
  return (data as Evento) ?? null;
}

/** Vaga restante vem da view: conta sem expor quem já está inscrito. */
export async function esportesDoEvento(eventoId: string): Promise<VagaEsporte[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vagas_por_esporte")
    .select("*")
    .eq("evento_id", eventoId)
    .order("horario", { ascending: true })
    .order("ordem", { ascending: true });
  return (data ?? []) as VagaEsporte[];
}

/** Agrupa por horário: é assim que o formulário mostra e detecta conflito. */
export function agruparPorHorario(esportes: VagaEsporte[]) {
  const mapa = new Map<string, VagaEsporte[]>();
  for (const e of esportes) {
    const lista = mapa.get(e.horario) ?? [];
    lista.push(e);
    mapa.set(e.horario, lista);
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
}

export function inscricoesAbertas(evento: Evento): boolean {
  if (!evento.publicado) return false;
  const limite = evento.inscricoes_ate ?? evento.data_evento;
  return hojeISO() <= limite;
}

/**
 * Vagas restantes do evento inteiro. `null` = evento sem limite.
 *
 * Vem da view `vagas_por_evento`, não de um count em `inscritos`: a RLS só
 * deixa a pessoa enxergar os próprios inscritos, então o count direto voltaria
 * quase sempre zero.
 */
export async function vagasRestantes(evento: Evento): Promise<number | null> {
  if (evento.vagas == null) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vagas_por_evento")
    .select("ocupadas")
    .eq("evento_id", evento.id)
    .maybeSingle();
  return Math.max(evento.vagas - (data?.ocupadas ?? 0), 0);
}
