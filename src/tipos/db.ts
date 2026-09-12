export type StatusInscricao =
  | "aguardando_pagamento"
  | "em_analise"
  | "confirmada"
  | "recusada"
  | "cancelada";

export type Turno = 'manha' | 'tarde' | 'noite';

export const ROTULO_TURNO: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

/** Ordem em que os turnos aparecem na tela. */
export const ORDEM_TURNO: Turno[] = ['manha', 'tarde', 'noite'];

export type Papel = 'admin' | 'membro';

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  membro: 'Diretoria',
};

export type Evento = {
  id: string;
  slug: string;
  prefixo: string;
  nome: string;
  descricao: string | null;
  data_evento: string;
  data_fim: string | null;
  cidade: string;
  local_nome: string | null;
  local_endereco: string | null;
  local_mapa_url: string | null;
  valor_centavos: number;
  idade_minima: number;
  max_parcelas: number;
  vagas: number | null;
  inscricoes_ate: string | null;
  troca_esporte_ate_dias: number;
  /** 0 = sem limite de modalidades por turno. */
  max_esportes_por_turno: number;
  pix_chave: string | null;
  pix_nome: string | null;
  pix_cidade: string | null;
  publicado: boolean;
};

export type Esporte = {
  id: string;
  evento_id: string;
  nome: string;
  turno: Turno;
  vagas: number;
  por_equipe: boolean;
  ordem: number;
};

export type VagaEsporte = {
  esporte_id: string;
  evento_id: string;
  nome: string;
  turno: Turno;
  por_equipe: boolean;
  ordem: number;
  vagas: number;
  ocupadas: number;
  restantes: number;
};

export type Inscricao = {
  id: string;
  codigo: string;
  evento_id: string;
  responsavel_id: string;
  status: StatusInscricao;
  parcelas: number;
  valor_centavos: number;
  motivo_recusa: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Inscrito = {
  id: string;
  inscricao_id: string;
  evento_id: string;
  nome: string;
  cpf: string;
  nascimento: string;
  telefone: string | null;
  igreja: string;
  de_boa: boolean;
};

export type Comprovante = {
  id: string;
  inscricao_id: string;
  parcela: number;
  caminho: string;
  enviado_em: string;
  avaliado_por: string | null;
  avaliado_em: string | null;
  aprovado: boolean | null;
  motivo: string | null;
};

/** O que o formulário manda para POST /api/inscricoes */
export type PedidoInscricao = {
  evento: string;
  parcelas: number;
  inscritos: {
    nome: string;
    cpf: string;
    nascimento: string;
    telefone: string;
    igreja: string;
    deBoa: boolean;
    esportes: string[];
  }[];
};

export const ROTULO_STATUS: Record<StatusInscricao, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  em_analise: "Em análise",
  confirmada: "Confirmada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

/** Números do evento, vindos da view `painel_evento`. */
export type PainelEvento = {
  evento_id: string;
  slug: string;
  nome: string;
  data_evento: string;
  publicado: boolean;
  valor_centavos: number;
  inscricoes: number;
  confirmadas: number;
  em_analise: number;
  aguardando: number;
  recusadas: number;
  pessoas: number;
  pessoas_confirmadas: number;
  igrejas: number;
  recebido_centavos: number;
  a_receber_centavos: number;
};

export type PainelIgreja = {
  evento_id: string;
  igreja: string;
  pessoas: number;
};

export type MembroDiretoria = {
  user_id: string;
  papel: Papel;
  nome: string;
  email: string;
};
