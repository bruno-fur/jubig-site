import "server-only";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { urlDoSite } from "@/lib/site";
import { formatarData, idadeNaData } from "@/lib/validacao";
import { ROTULO_TURNO, type StatusInscricao, type Turno } from "@/tipos/db";

/**
 * O QR aponta para uma página da diretoria, não carrega dado nenhum.
 *
 * Quem fotografar o ingresso de outra pessoa e abrir o link cai no login — e
 * sem ser da diretoria, volta para a home. Nome, CPF e telefone só aparecem
 * para quem está na portaria.
 */
export const urlDoIngresso = (ingresso: string) => `${urlDoSite()}/diretoria/ingresso/${ingresso}`;

export type Ingresso = {
  ingresso: string;
  nome: string;
  igreja: string;
  modalidades: string[];
  deBoa: boolean;
  checkinEm: string | null;
  qr: string;
};

export type IngressosDaInscricao = {
  codigo: string;
  status: StatusInscricao;
  evento: { nome: string; data: string; local: string; slug: string };
  pessoas: Ingresso[];
};

type Linha = {
  codigo: string;
  status: StatusInscricao;
  eventos: {
    nome: string;
    slug: string;
    data_evento: string;
    data_fim: string | null;
    cidade: string;
    local_nome: string | null;
  };
  inscritos: {
    ingresso: string;
    nome: string;
    igreja: string;
    de_boa: boolean;
    checkin_em: string | null;
    inscritos_esportes: { esportes: { nome: string; turno: Turno } | null }[];
  }[];
};

/**
 * Ingressos de uma inscrição. `null` quando não existe ou não é de quem pediu
 * — a RLS decide, e para a tela os dois casos são o mesmo "não encontrado".
 */
export async function ingressosDaInscricao(codigo: string): Promise<IngressosDaInscricao | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inscricoes")
    .select(
      "codigo, status, eventos(nome, slug, data_evento, data_fim, cidade, local_nome), inscritos(ingresso, nome, igreja, de_boa, checkin_em, inscritos_esportes(esportes(nome, turno)))"
    )
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  const linha = data as unknown as Linha | null;
  if (!linha) return null;

  const e = linha.eventos;
  const pessoas = await Promise.all(
    linha.inscritos
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(async (p) => ({
        ingresso: p.ingresso,
        nome: p.nome,
        igreja: p.igreja,
        deBoa: p.de_boa,
        checkinEm: p.checkin_em,
        modalidades: p.inscritos_esportes
          .map((x) => (x.esportes ? `${x.esportes.nome} (${ROTULO_TURNO[x.esportes.turno]})` : ""))
          .filter(Boolean),
        // Margem 2 e correção M: lê bem impresso em papel comum e em tela com
        // brilho baixo, que é como a maioria mostra na fila.
        qr: await QRCode.toDataURL(urlDoIngresso(p.ingresso), {
          margin: 2,
          width: 320,
          errorCorrectionLevel: "M",
        }),
      }))
  );

  return {
    codigo: linha.codigo,
    status: linha.status,
    evento: {
      nome: e.nome,
      slug: e.slug,
      data:
        e.data_fim && e.data_fim !== e.data_evento
          ? `${formatarData(e.data_evento)} a ${formatarData(e.data_fim)}`
          : formatarData(e.data_evento),
      local: e.local_nome ? `${e.local_nome} · ${e.cidade}` : e.cidade,
    },
    pessoas,
  };
}

/** Tudo que a portaria precisa ver ao ler o QR. */
export type DadosPortaria = {
  ingresso: string;
  nome: string;
  cpf: string;
  nascimento: string;
  idade: number;
  telefone: string | null;
  igreja: string;
  deBoa: boolean;
  modalidades: string[];
  codigo: string;
  status: StatusInscricao;
  evento: string;
  eventoData: string;
  responsavel: string | null;
  checkinEm: string | null;
  checkinPor: string | null;
  /** Cor da pulseira no JubigDay. Nula até o check-in sortear. */
  equipe: { nome: string; cor: string } | null;
};

type LinhaPortaria = {
  ingresso: string;
  nome: string;
  cpf: string;
  nascimento: string;
  telefone: string | null;
  igreja: string;
  de_boa: boolean;
  checkin_em: string | null;
  checkin_por: string | null;
  inscricoes: {
    codigo: string;
    status: StatusInscricao;
    responsavel_id: string;
    eventos: { nome: string; data_evento: string };
  };
  inscritos_esportes: { esportes: { nome: string; turno: Turno } | null }[];
};

/**
 * Busca pelo uuid do QR. Chamado só depois de `exigirDiretoria` — mesmo assim
 * passa pela RLS, que só entrega inscrito alheio a quem é da diretoria.
 */
export async function dadosDoIngresso(ingresso: string): Promise<DadosPortaria | null> {
  if (!/^[0-9a-f-]{36}$/i.test(ingresso)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("inscritos")
    .select(
      "ingresso, nome, cpf, nascimento, telefone, igreja, de_boa, checkin_em, checkin_por, inscricoes(codigo, status, responsavel_id, eventos(nome, data_evento)), inscritos_esportes(esportes(nome, turno))"
    )
    .eq("ingresso", ingresso)
    .maybeSingle();

  const p = data as unknown as LinhaPortaria | null;
  if (!p) return null;

  const ids = [p.inscricoes.responsavel_id, p.checkin_por].filter(Boolean) as string[];
  const [{ data: perfis }, equipe] = await Promise.all([
    supabase.from("perfis").select("id, nome").in("id", ids),
    equipeDoIngresso(ingresso),
  ]);
  const nome = (id: string | null) => perfis?.find((x) => x.id === id)?.nome || null;

  return {
    ingresso: p.ingresso,
    nome: p.nome,
    cpf: p.cpf,
    nascimento: p.nascimento,
    idade: idadeNaData(p.nascimento, p.inscricoes.eventos.data_evento),
    telefone: p.telefone,
    igreja: p.igreja,
    deBoa: p.de_boa,
    modalidades: p.inscritos_esportes
      .map((x) => (x.esportes ? `${x.esportes.nome} (${ROTULO_TURNO[x.esportes.turno]})` : ""))
      .filter(Boolean),
    codigo: p.inscricoes.codigo,
    status: p.inscricoes.status,
    evento: p.inscricoes.eventos.nome,
    eventoData: p.inscricoes.eventos.data_evento,
    responsavel: nome(p.inscricoes.responsavel_id),
    checkinEm: p.checkin_em,
    checkinPor: nome(p.checkin_por),
    equipe,
  };
}

/**
 * Consulta separada de propósito: enquanto o schema das equipes não roda em
 * produção, ela falha sozinha e a portaria segue funcionando sem a cor.
 */
async function equipeDoIngresso(ingresso: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inscritos")
    .select("equipes(nome, cor)")
    .eq("ingresso", ingresso)
    .maybeSingle();
  if (error) return null;
  const e = (data as unknown as { equipes: { nome: string; cor: string } | null } | null)?.equipes;
  return e ?? null;
}
