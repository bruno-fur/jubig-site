import { AsYouType, type CountryCode } from "libphonenumber-js";

/**
 * Máscaras por TAMANHO, nunca por regex encadeado.
 *
 * O jeito antigo (`.replace(/(\d{3})(\d)/, "$1.$2").replace(...)`) parecia
 * funcionar até alguém apagar um dígito no meio ou colar um número com DDI:
 * cada replace via o resultado do anterior e o telefone virava outra coisa.
 * Aqui a regra é sempre a mesma: joga fora o que não é dígito, corta no
 * tamanho máximo e monta o texto a partir das posições.
 */

function digitos(valor: string, max: number) {
  return (valor ?? "").replace(/\D/g, "").slice(0, max);
}

/** 000.000.000-00 */
export function mascaraCPF(valor: string): string {
  const d = digitos(valor, 11);
  let saida = d.slice(0, 3);
  if (d.length > 3) saida += "." + d.slice(3, 6);
  if (d.length > 6) saida += "." + d.slice(6, 9);
  if (d.length > 9) saida += "-" + d.slice(9, 11);
  return saida;
}

/** 00/00/0000 */
export function mascaraData(valor: string): string {
  const d = digitos(valor, 8);
  let saida = d.slice(0, 2);
  if (d.length > 2) saida += "/" + d.slice(2, 4);
  if (d.length > 4) saida += "/" + d.slice(4, 8);
  return saida;
}

/** "17/10/2026" -> "2026-10-17". Devolve "" enquanto estiver incompleta. */
export function dataParaISO(valor: string): string {
  const d = digitos(valor, 8);
  if (d.length !== 8) return "";
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

/** "2026-10-17" -> "17/10/2026" */
export function isoParaData(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso ?? "")) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Telefone: quem formata é a libphonenumber, que conhece o plano de numeração
 * de cada país. AsYouType é reiniciado a cada tecla, então apagar no meio não
 * embaralha o que já estava escrito.
 */
export function mascaraTelefone(valor: string, pais: CountryCode = "BR"): string {
  const bruto = (valor ?? "").replace(/[^\d+]/g, "");
  if (!bruto) return "";
  return new AsYouType(pais).input(bruto);
}

/** Países no topo da lista: tríplice fronteira. */
export const PAISES: { codigo: CountryCode; nome: string; ddi: string; bandeira: string }[] = [
  { codigo: "BR", nome: "Brasil", ddi: "+55", bandeira: "🇧🇷" },
  { codigo: "PY", nome: "Paraguai", ddi: "+595", bandeira: "🇵🇾" },
  { codigo: "AR", nome: "Argentina", ddi: "+54", bandeira: "🇦🇷" },
  { codigo: "UY", nome: "Uruguai", ddi: "+598", bandeira: "🇺🇾" },
  { codigo: "PT", nome: "Portugal", ddi: "+351", bandeira: "🇵🇹" },
  { codigo: "US", nome: "Estados Unidos", ddi: "+1", bandeira: "🇺🇸" },
];
