export type TipoItem =
  | "abertura"
  | "devocional"
  | "louvor"
  | "palestra"
  | "atividade"
  | "esporte"
  | "refeicao"
  | "intervalo"
  | "encerramento";

export type ItemProgramacao = {
  id: string;
  titulo: string;
  descricao: string | null;
  /** "08:30:00" no banco. */
  hora: string | null;
  /** Nulo em evento de um dia só. */
  dia: string | null;
  tipo: TipoItem | null;
  /** Texto antigo, de antes da coluna `hora`. */
  horario?: string | null;
  ordem: number;
};

/** Rótulo e cor de cada tipo. Cor só para separar o olho, não é semáforo. */
export const TIPOS: Record<TipoItem, { rotulo: string; cor: string }> = {
  abertura: { rotulo: "Abertura", cor: "bg-laranja/10 text-laranja-escuro" },
  devocional: { rotulo: "Devocional", cor: "bg-ok/10 text-ok" },
  louvor: { rotulo: "Louvor", cor: "bg-ok/10 text-ok" },
  palestra: { rotulo: "Mensagem", cor: "bg-ok/10 text-ok" },
  atividade: { rotulo: "Atividade", cor: "bg-laranja/10 text-laranja-escuro" },
  esporte: { rotulo: "Esporte", cor: "bg-laranja/10 text-laranja-escuro" },
  refeicao: { rotulo: "Refeição", cor: "bg-areia text-apagado" },
  intervalo: { rotulo: "Intervalo", cor: "bg-areia text-apagado" },
  encerramento: { rotulo: "Encerramento", cor: "bg-tinta/10 text-apagado" },
};

export type Modelo = { titulo: string; tipo: TipoItem; hora: string; descricao?: string };

/**
 * Itens que se repetem em quase todo evento da JUBIG.
 *
 * Existem para a diretoria montar a programação clicando, não digitando: com
 * campo livre, cada evento saía com um nome diferente para a mesma coisa
 * ("Café", "Café da manhã", "Desjejum") e horário escrito de três jeitos.
 */
export const MODELOS: Modelo[] = [
  { titulo: "Chegada e credenciamento", tipo: "abertura", hora: "08:00" },
  { titulo: "Café da manhã", tipo: "refeicao", hora: "07:30" },
  { titulo: "Devocional", tipo: "devocional", hora: "08:30" },
  { titulo: "Abertura", tipo: "abertura", hora: "09:00" },
  { titulo: "Início das atividades", tipo: "atividade", hora: "09:30" },
  { titulo: "Modalidades esportivas", tipo: "esporte", hora: "10:00" },
  { titulo: "Oficinas", tipo: "atividade", hora: "10:00" },
  { titulo: "Almoço", tipo: "refeicao", hora: "12:00" },
  { titulo: "Atividades da tarde", tipo: "atividade", hora: "14:00" },
  { titulo: "Lanche", tipo: "intervalo", hora: "16:00" },
  { titulo: "Jantar", tipo: "refeicao", hora: "19:00" },
  { titulo: "Louvor", tipo: "louvor", hora: "20:00" },
  { titulo: "Mensagem", tipo: "palestra", hora: "20:30" },
  { titulo: "Encerramento", tipo: "encerramento", hora: "22:00" },
];

/** Um dia inteiro de uma vez. A diretoria ajusta o horário depois. */
export const DIA_PADRAO: Modelo[] = [
  { titulo: "Chegada e credenciamento", tipo: "abertura", hora: "08:00" },
  { titulo: "Devocional", tipo: "devocional", hora: "08:30" },
  { titulo: "Abertura", tipo: "abertura", hora: "09:00" },
  { titulo: "Início das atividades", tipo: "atividade", hora: "09:30" },
  { titulo: "Almoço", tipo: "refeicao", hora: "12:00" },
  { titulo: "Atividades da tarde", tipo: "atividade", hora: "14:00" },
  { titulo: "Lanche", tipo: "intervalo", hora: "16:00" },
  { titulo: "Jantar", tipo: "refeicao", hora: "19:00" },
  { titulo: "Louvor", tipo: "louvor", hora: "20:00" },
  { titulo: "Mensagem", tipo: "palestra", hora: "20:30" },
  { titulo: "Encerramento", tipo: "encerramento", hora: "22:00" },
];

/** Perguntas que a diretoria responde toda edição — um clique preenche. */
export const DUVIDAS_MODELO = [
  { pergunta: "Que horas começa e que horas termina?", resposta: "" },
  { pergunta: "O que preciso levar?", resposta: "" },
  { pergunta: "A alimentação está inclusa?", resposta: "" },
  { pergunta: "Como funciona o transporte da caravana?", resposta: "" },
  { pergunta: "Posso levar alguém que não é da igreja?", resposta: "" },
];

/** "08:30:00" → "08h30". O texto antigo passa direto. */
export function horaLegivel(item: { hora: string | null; horario?: string | null }): string {
  if (item.hora) return `${item.hora.slice(0, 2)}h${item.hora.slice(3, 5)}`;
  return item.horario ?? "";
}

/** Dias do evento, para o seletor: um dia só devolve lista vazia. */
export function diasDoEvento(dataEvento: string, dataFim: string | null): string[] {
  if (!dataFim || dataFim === dataEvento) return [];

  const dias: string[] = [];
  for (let d = new Date(`${dataEvento}T12:00:00`); dias.length < 30; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    dias.push(iso);
    if (iso >= dataFim) break;
  }
  return dias;
}

/** "Sexta, 6 de fevereiro" — o cabeçalho de cada dia na programação. */
export function diaLegivel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const texto = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Ordena por dia e hora — texto ordenava "9h00" depois de "14h00". */
export function emOrdem(itens: ItemProgramacao[]): ItemProgramacao[] {
  return [...itens].sort(
    (a, b) =>
      (a.dia ?? "").localeCompare(b.dia ?? "") ||
      (a.hora ?? "99").localeCompare(b.hora ?? "99") ||
      a.ordem - b.ordem
  );
}
