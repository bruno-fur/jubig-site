import type { CategoriaModalidade, DetalheEscolha, FormatoModalidade } from "@/tipos/db";

type Modalidade = {
  nome: string;
  categoria?: CategoriaModalidade;
  formato?: FormatoModalidade;
};

/** Escala da nota de habilidade, com palavras: "3" sozinho cada um entende de um jeito. */
export const NOTAS: [number, string][] = [
  [1, "Nunca joguei"],
  [2, "Jogo pouco"],
  [3, "Me viro"],
  [4, "Jogo bem"],
  [5, "Jogo muito"],
];

const categoria = (m: Modalidade) => m.categoria ?? "esporte";
const formato = (m: Modalidade) => m.formato ?? "individual";

export const ehOficina = (m: Modalidade) => categoria(m) === "oficina";

export const precisaNota = (m: Modalidade) => !ehOficina(m) && formato(m) === "time_sorteado";

/** Quantos nomes a pessoa escreve além do dela: 1 na dupla, 2 no trio. */
export function parceirosNecessarios(m: Modalidade) {
  if (ehOficina(m)) return 0;
  return formato(m) === "dupla" ? 1 : formato(m) === "trio" ? 2 : 0;
}

/**
 * Falta algo nesta escolha? Mesma regra do trigger `conferir_esporte` — aqui
 * só para a tela avisar antes de enviar, no lugar certo.
 */
export function problemaDaEscolha(m: Modalidade, d?: DetalheEscolha): string | null {
  if (precisaNota(m) && !d?.nota)
    return `Dê uma nota para a sua habilidade em ${m.nome} — é ela que equilibra os times.`;

  const precisa = parceirosNecessarios(m);
  const preenchidos = (d?.parceiros ?? []).filter((p) => p.trim()).length;
  if (precisa > 0 && preenchidos < precisa)
    return precisa === 1
      ? `Escreva o nome da sua dupla em ${m.nome}.`
      : `Escreva o nome dos dois parceiros do trio em ${m.nome}.`;

  return null;
}

/** Formato que a API e o banco esperam. Manda só o que vale para o formato. */
export function escolhaParaEnvio(id: string, m: Modalidade, d?: DetalheEscolha) {
  const precisa = parceirosNecessarios(m);
  return {
    id,
    nota: precisaNota(m) ? (d?.nota ?? null) : null,
    parceiros:
      precisa > 0
        ? (d?.parceiros ?? [])
            .map((p) => p.trim())
            .filter(Boolean)
            .slice(0, precisa)
        : null,
  };
}

/** "nota 4 · Jogo bem" ou "com Ana Lima e João" — para conferência, CSV e painel. */
export function descreverEscolha(d: DetalheEscolha | undefined | null) {
  if (!d) return "";
  if (d.nota) return `nota ${d.nota}`;
  if (d.parceiros?.length) return `com ${d.parceiros.join(" e ")}`;
  return "";
}

/**
 * Como chamar as modalidades de um evento. Só oficinas: "Oficinas". Só
 * esporte: "Esportes". Misturado: "Modalidades".
 */
export function rotuloModalidades(lista: Modalidade[]) {
  const tipos = new Set(lista.map(categoria));
  if (tipos.size === 1 && tipos.has("oficina"))
    return { plural: "Oficinas", singular: "oficina", deBoa: "Não vou participar de oficina" };
  if (tipos.size <= 1)
    return { plural: "Esportes", singular: "modalidade", deBoa: "Vou só de boa — não quero competir" };
  return { plural: "Modalidades", singular: "modalidade", deBoa: "Não vou participar de nenhuma" };
}
