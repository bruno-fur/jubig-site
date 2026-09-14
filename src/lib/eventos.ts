import { createClient } from "@/lib/supabase/server";
import {
  ORDEM_TURNO,
  type Evento,
  type Igreja,
  type OpcaoIgreja,
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

export type SituacaoInscricoes = "sem_inscricao" | "em_breve" | "agendada" | "abertas" | "encerradas";

type CamposDeInscricao = Pick<
  Evento,
  "tem_inscricao" | "data_evento" | "inscricoes_ate" | "inscricoes_de" | "inscricoes_em_breve"
>;

/**
 * Onde as inscrições do evento estão agora.
 *
 * O banco confere a mesma coisa em `criar_inscricao` — aqui é só para a tela
 * saber o que mostrar. Campos opcionais porque, antes do schema novo rodar,
 * `inscricoes_de` e `inscricoes_em_breve` ainda não vêm do banco.
 */
export function situacaoInscricoes(evento: CamposDeInscricao, agora = new Date()): SituacaoInscricoes {
  if (!evento.tem_inscricao) return "sem_inscricao";
  if (hojeISO() > (evento.inscricoes_ate ?? evento.data_evento)) return "encerradas";
  if (evento.inscricoes_em_breve) return "em_breve";
  if (evento.inscricoes_de && new Date(evento.inscricoes_de) > agora) return "agendada";
  return "abertas";
}

export function inscricoesAbertas(evento: Evento): boolean {
  return evento.publicado && situacaoInscricoes({ ...evento, tem_inscricao: true }) === "abertas";
}

/** Já passou da hora de início? Fora do componente para o render continuar puro. */
export function eventoJaComecou(evento: Pick<Evento, "data_evento" | "hora_inicio">, agora = new Date()): boolean {
  return Date.parse(inicioDoEvento(evento)) <= agora.getTime();
}

/**
 * Início do evento com fuso de Brasília, para a contagem regressiva.
 *
 * -03:00 fixo: o Brasil não tem horário de verão desde 2019. Sem hora
 * cadastrada, conta até a meia-noite do dia.
 */
export function inicioDoEvento(evento: Pick<Evento, "data_evento" | "hora_inicio">): string {
  const hora = (evento.hora_inicio ?? "00:00").slice(0, 5);
  return `${evento.data_evento}T${hora}:00-03:00`;
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

/**
 * Igrejas para escolher no cadastro e na inscrição.
 *
 * Filtra `ativa` aqui mesmo: a RLS devolve as desativadas para a diretoria,
 * e o banco recusaria a inscrição de quem escolhesse uma delas.
 */
export async function igrejasParaEscolha(): Promise<OpcaoIgreja[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("igrejas")
    .select("id, nome, cidade")
    .eq("ativa", true)
    .order("cidade")
    .order("nome");
  return (data ?? []) as OpcaoIgreja[];
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
