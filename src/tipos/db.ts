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
  /** Abertura agendada (timestamptz). Nula = abre assim que publicar. */
  inscricoes_de: string | null;
  /** "Em breve", sem data: ninguém se inscreve até desligar. */
  inscricoes_em_breve: boolean;
  /** "08:00:00" — para a contagem regressiva chegar no minuto certo. */
  hora_inicio: string | null;
  troca_esporte_ate_dias: number;
  tipo: TipoEvento;
  /** Congresso tem inscrição e não tem modalidade; tour não tem nenhuma das duas. */
  tem_inscricao: boolean;
  tem_modalidades: boolean;
  igreja_id: string | null;
  /** 0 = sem limite de modalidades por turno. */
  max_esportes_por_turno: number;
  pix_chave: string | null;
  pix_nome: string | null;
  pix_cidade: string | null;
  publicado: boolean;
};

/** Esporte no JubigDay; oficina ou estudo no Congresso. */
export type CategoriaModalidade = "esporte" | "oficina";

/** O que a pessoa informa ao escolher: nada, parceiros ou nota de habilidade. */
export type FormatoModalidade = "individual" | "dupla" | "trio" | "time_sorteado";

export const ROTULO_FORMATO: Record<FormatoModalidade, string> = {
  individual: "Individual",
  dupla: "Dupla",
  trio: "Trio",
  time_sorteado: "Time sorteado",
};

/** Detalhe de uma escolha: nota (time sorteado) ou parceiros (dupla, trio). */
export type DetalheEscolha = { nota?: number | null; parceiros?: string[] | null };

export type Esporte = {
  id: string;
  evento_id: string;
  nome: string;
  turno: Turno;
  vagas: number;
  por_equipe: boolean;
  /** Opcionais só até o schema novo rodar em produção. */
  categoria?: CategoriaModalidade;
  formato?: FormatoModalidade;
  descricao?: string | null;
  /** Quem conduz a oficina. */
  responsavel?: string | null;
  ordem: number;
};

export type VagaEsporte = {
  esporte_id: string;
  evento_id: string;
  nome: string;
  turno: Turno;
  por_equipe: boolean;
  /** Opcionais só até o schema novo rodar em produção. */
  categoria?: CategoriaModalidade;
  formato?: FormatoModalidade;
  descricao?: string | null;
  /** Quem conduz a oficina. */
  responsavel?: string | null;
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
  cancelada_em: string | null;
  cancelada_por: string | null;
  motivo_cancelamento: string | null;
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

export type TipoEvento = "jubigday" | "congresso" | "tour";

export const ROTULO_TIPO: Record<TipoEvento, string> = {
  jubigday: "JubigDay",
  congresso: "Congresso",
  tour: "JubigTour",
};

/** Uma frase por tipo, para a agenda não repetir o nome do evento. */
export const RESUMO_TIPO: Record<TipoEvento, string> = {
  jubigday: "Um dia de esporte, música e comunhão",
  congresso: "Vários dias de congresso",
  tour: "Visita a uma igreja da união",
};

/** O que o seletor de igreja do cadastro e da inscrição precisa. */
export type OpcaoIgreja = { id: string; nome: string; cidade: string };

export type Igreja = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  /** Texto pronto para exibir, montado a partir das partes abaixo. */
  endereco: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  responsavel: string | null;
  telefone: string | null;
  instagram: string | null;
  ativa: boolean;
  ordem: number;
};

/** Linha da view `agenda`: evento publicado, com a contagem de gente. */
export type ItemAgenda = {
  id: string;
  slug: string;
  tipo: TipoEvento;
  nome: string;
  descricao: string | null;
  data_evento: string;
  data_fim: string | null;
  cidade: string;
  local_nome: string | null;
  valor_centavos: number;
  tem_inscricao: boolean;
  tem_modalidades: boolean;
  inscricoes_ate: string | null;
  inscricoes_de: string | null;
  inscricoes_em_breve: boolean;
  hora_inicio: string | null;
  igreja_nome: string | null;
  pessoas: number;
};
