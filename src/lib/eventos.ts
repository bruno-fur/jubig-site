import { createClient } from "@/lib/supabase/server";
import {
  ORDEM_TURNO,
  type Evento,
  type Igreja,
  type ItemAgenda,
  type Turno,
  type VagaEsporte,
} from "@/tipos/db";

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

/**
 * "14h00" do schema antigo vira turno. Some quando `schema.sql` for aplicado
 * em produção — até lá, é o que mantém o site de pé com a coluna velha.
 */
function turnoDe(linha: Record<string, unknown>): Turno {
  if (typeof linha.turno === "string") return linha.turno as Turno;

  const horario = String(linha.horario ?? "");
  const hora = Number(horario.match(/^\d{1,2}/)?.[0]);
  if (Number.isFinite(hora) && hora < 12) return "manha";
  if (Number.isFinite(hora) && hora >= 18) return "noite";
  return "tarde";
}

/**
 * Vaga restante vem da view: conta sem expor quem já está inscrito.
 *
 * Ordena em memória, não no banco: `order("turno")` quebraria enquanto a
 * coluna ainda se chamar `horario`, e derrubar o formulário de inscrição por
 * causa de ordenação seria troca ruim.
 */
export async function esportesDoEvento(eventoId: string): Promise<VagaEsporte[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("vagas_por_esporte").select("*").eq("evento_id", eventoId);

  return ((data ?? []) as Record<string, unknown>[])
    .map((linha) => ({ ...linha, turno: turnoDe(linha) }) as unknown as VagaEsporte)
    .sort(
      (a, b) =>
        ORDEM_TURNO.indexOf(a.turno) - ORDEM_TURNO.indexOf(b.turno) ||
        a.ordem - b.ordem ||
        a.nome.localeCompare(b.nome, "pt-BR")
    );
}

/**
 * Agrupa por turno: é assim que o formulário mostra as modalidades.
 *
 * A ordem vem de ORDEM_TURNO, não de ordem alfabética — alfabética colocaria
 * a manhã depois da noite.
 */
export function agruparPorTurno(esportes: VagaEsporte[]): [Turno, VagaEsporte[]][] {
  const mapa = new Map<Turno, VagaEsporte[]>();
  for (const e of esportes) {
    const lista = mapa.get(e.turno) ?? [];
    lista.push(e);
    mapa.set(e.turno, lista);
  }
  return ORDEM_TURNO.filter((t) => mapa.has(t)).map((t) => [t, mapa.get(t)!]);
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

/**
 * Agenda pública: todo evento publicado, passado e futuro.
 *
 * Vem da view `agenda` porque a home precisa da contagem de participantes, e
 * essa não pode sair de `inscritos` — tabela privada pela RLS.
 */
export async function agendaCompleta(): Promise<ItemAgenda[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("agenda").select("*").order("data_evento");
  return (data ?? []) as ItemAgenda[];
}

/** Só o que ainda vai acontecer, em ordem. */
export function daquiPraFrente(itens: ItemAgenda[], hoje = hojeISO()): ItemAgenda[] {
  return itens.filter((e) => (e.data_fim ?? e.data_evento) >= hoje);
}

export async function igrejasAtivas(): Promise<Igreja[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("igrejas")
    .select("*")
    .order("ordem")
    .order("cidade");
  return (data ?? []) as Igreja[];
}
