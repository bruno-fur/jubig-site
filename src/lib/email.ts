import { Resend } from "resend";
import {
  emailConfirmacaoEndereco,
  emailInscricaoRecebida,
  emailComprovanteRecebido,
  emailInscricaoAprovada,
  emailComprovanteRecusado,
  type DadosInscricao,
} from "@/emails/templates";

const DE = process.env.EMAIL_REMETENTE ?? "JUBIG <contato@jubig.org.br>";

/*
 * Criado só na hora de enviar. O construtor do Resend estoura quando a chave
 * está vazia; se ele rodasse no topo do arquivo, `npm run build` quebraria em
 * qualquer máquina sem RESEND_API_KEY — incluindo o build da Vercel antes de
 * alguém cadastrar a variável.
 */
let resend: Resend | null = null;
function cliente() {
  if (!process.env.RESEND_API_KEY) return null;
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

async function enviar(para: string, msg: { subject: string; html: string }) {
  const api = cliente();
  if (!api) {
    console.error("[email] RESEND_API_KEY não configurada — não enviei", para, msg.subject);
    return { ok: false as const, erro: "sem_chave" };
  }

  try {
    const { data, error } = await api.emails.send({ from: DE, to: para, ...msg });
    if (error) {
      console.error("[email] falhou", para, msg.subject, error);
      return { ok: false as const, erro: error.message };
    }
    return { ok: true as const, id: data?.id };
  } catch (e) {
    console.error("[email] exceção", e);
    return { ok: false as const, erro: "falha de rede" };
  }
}

export const Emails = {
  confirmarEndereco: (para: string, nome: string, url: string) =>
    enviar(para, emailConfirmacaoEndereco(nome, url)),

  inscricaoRecebida: (para: string, d: DadosInscricao) =>
    enviar(para, emailInscricaoRecebida(d)),

  comprovanteRecebido: (para: string, d: DadosInscricao) =>
    enviar(para, emailComprovanteRecebido(d)),

  inscricaoAprovada: (para: string, d: DadosInscricao) =>
    enviar(para, emailInscricaoAprovada(d)),

  comprovanteRecusado: (para: string, d: DadosInscricao, motivo: string) =>
    enviar(para, emailComprovanteRecusado(d, motivo)),
};
