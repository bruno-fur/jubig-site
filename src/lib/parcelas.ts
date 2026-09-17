/**
 * Quantas parcelas ainda cabem antes do evento.
 *
 * Uma parcela por mês, contando o mês atual: em setembro, para um evento em
 * outubro, sobram dois meses e dá para dividir em 2x; no mês do evento, só à
 * vista. É por isso que o limite não é fixo — dividir em 4x a uma semana do
 * congresso seria cobrar quatro vezes na mesma semana.
 *
 * `max_parcelas` do evento continua sendo o teto: o mês só reduz, nunca
 * aumenta.
 */
export type EventoParcelavel = { max_parcelas: number; data_evento: string };

/** Ano e mês em Brasília — o servidor da Vercel roda em UTC e vira o mês antes. */
function mesBrasilia(quando: Date): number {
  const [ano, mes] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(quando)
    .split("-")
    .map(Number);
  return ano * 12 + mes;
}

const mesDoEvento = (data: string) => {
  const [ano, mes] = data.split("-").map(Number);
  return ano * 12 + mes;
};

export function parcelasDisponiveis(evento: EventoParcelavel, agora = new Date()): number {
  const mesesContandoOAtual = mesDoEvento(evento.data_evento) - mesBrasilia(agora) + 1;
  return Math.max(1, Math.min(evento.max_parcelas || 1, mesesContandoOAtual));
}

/** "30/09" — último dia do mês atual, quando o limite cai. */
function fimDoMes(agora: Date): string {
  const [ano, mes] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(agora)
    .split("-")
    .map(Number);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${String(ultimo).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/**
 * Aviso para quem está escolhendo como pagar, quando o limite cai no mês que
 * vem. Nulo quando nada muda.
 */
export function avisoParcelas(evento: EventoParcelavel, agora = new Date()): string | null {
  const agora_ = parcelasDisponiveis(evento, agora);
  const depois = Math.max(
    1,
    Math.min(evento.max_parcelas || 1, mesDoEvento(evento.data_evento) - mesBrasilia(agora))
  );
  if (agora_ <= 1 || depois >= agora_) return null;
  return `Dividir em ${agora_}x vale até ${fimDoMes(agora)}. Depois dessa data o máximo passa a ser ${
    depois === 1 ? "à vista" : `${depois}x`
  }, porque cada parcela é paga num mês.`;
}
