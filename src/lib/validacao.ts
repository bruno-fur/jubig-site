import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function validarCPF(valor: string): boolean {
  const v = (valor ?? "").replace(/\D/g, "");
  if (v.length !== 11 || /^(\d)\1{10}$/.test(v)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +v[i] * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== +v[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +v[i] * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === +v[10];
}

/**
 * Quebra "2010-05-17" nos três números.
 *
 * De propósito não usa `new Date(iso)`: isso interpreta a data como meia-noite
 * UTC e, lido com getDate() no fuso do Brasil, volta um dia. Quem nasceu
 * exatamente na data de corte era barrado sem motivo.
 */
function partesDaData(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return { ano, mes, dia };
}

/** Idade que a pessoa terá NA DATA DO EVENTO, não hoje. */
export function idadeNaData(nascimento: string, dataEvento: string): number {
  const n = partesDaData(nascimento);
  const e = partesDaData(dataEvento);
  let idade = e.ano - n.ano;
  if (e.mes < n.mes || (e.mes === n.mes && e.dia < n.dia)) idade--;
  return idade;
}

/** Data existe mesmo (não aceita 31/02) e não está no futuro. */
export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { ano, mes, dia } = partesDaData(iso);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia > ultimoDia) return false;
  if (ano < 1900) return false;
  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;
  return iso <= hojeIso;
}

/** Nome precisa ter sobrenome: duas palavras de verdade, não "Ana A". */
export function nomeCompleto(nome: string): boolean {
  const partes = (nome ?? "").trim().split(/\s+/).filter((p) => p.length > 1);
  return partes.length >= 2;
}

/**
 * Telefone sempre em E.164 (+5545999990000).
 * Brasil é o padrão; a tríplice fronteira usa PY, AR e UY.
 */
export function paraE164(valor: string, pais: CountryCode = "BR"): string | null {
  const tel = parsePhoneNumberFromString(valor ?? "", pais);
  if (!tel || !tel.isValid()) return null;
  return tel.number;
}

export function formatarTelefone(e164: string): string {
  const tel = parsePhoneNumberFromString(e164 ?? "");
  return tel ? tel.formatInternational() : e164;
}

export const formatarReais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatarData = (iso: string) =>
  new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatarDataCurta = (iso: string) =>
  new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR");

export const formatarCPF = (cpf: string) => {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

/** Esconde o meio do CPF em tela de listagem. */
export const cpfMascarado = (cpf: string) => {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};
