import { Resend } from "resend";
import {
  emailConfirmacaoEndereco,
  emailInscricaoRecebida,
  emailComprovanteRecebido,
  emailInscricaoAprovada,
  emailComprovanteRecusado,
  type DadosInscricao,
} from "@/emails/templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const DE = process.env.EMAIL_REMETENTE ?? "JUBIG <contato@jubig.org.br>";

async function enviar(para: string, msg: { subject: string; html: string }) {
  try {
    const { data, error } = await resend.emails.send({ from: DE, to: para, ...msg });
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
