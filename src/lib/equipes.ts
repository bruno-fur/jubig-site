import type { LinhaPlacar } from "@/tipos/db";

/**
 * As quatro equipes de sempre. A diretoria troca nome e cor na tela se as
 * pulseiras do ano vierem diferentes.
 */
export const EQUIPES_PADRAO = [
  { nome: "Azul", cor: "#1E63C6" },
  { nome: "Vermelha", cor: "#C62828" },
  { nome: "Verde", cor: "#2E7D32" },
  { nome: "Amarela", cor: "#F2B705" },
] as const;

/** Cores oferecidas no seletor — as de pulseira que se acha para comprar. */
export const CORES_PULSEIRA = [
  "#1E63C6",
  "#C62828",
  "#2E7D32",
  "#F2B705",
  "#7B1FA2",
  "#EF6C00",
  "#EC407A",
  "#212121",
  "#00897B",
  "#FFFFFF",
];

/**
 * Texto claro ou escuro sobre a cor da equipe. Amarelo e branco com letra
 * branca somem — na fila, ninguém lê.
 */
export function textoSobre(cor: string): string {
  const h = cor.replace("#", "");
  if (h.length !== 6) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const luz = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luz > 0.6 ? "#2A1710" : "#FFFFFF";
}

/**
 * Placar em ordem, com empate tratado: duas equipes com os mesmos pontos
 * dividem a posição, e "campeã" só existe quando alguém pontuou sozinho no
 * topo.
 */
export function ordenarPlacar(linhas: LinhaPlacar[]) {
  const ordem = [...linhas].sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem);
  const topo = ordem[0]?.pontos ?? 0;
  const naFrente = ordem.filter((l) => l.pontos === topo);
  return {
    ordem: ordem.map((l) => ({ ...l, posicao: ordem.findIndex((x) => x.pontos === l.pontos) + 1 })),
    lider: topo > 0 && naFrente.length === 1 ? naFrente[0] : null,
    empate: topo > 0 && naFrente.length > 1,
  };
}

/** Rótulo pronto para a pulseira: "Equipe Azul". */
export const nomeDaEquipe = (nome: string) => (/^equipe\b/i.test(nome) ? nome : `Equipe ${nome}`);
