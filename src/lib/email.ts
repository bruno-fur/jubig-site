import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import {
  emailConfirmacaoEndereco,
  emailInscricaoRecebida,
  emailComprovanteRecebido,
  emailInscricaoAprovada,
  emailComprovanteRecusado,
  emailRedefinirSenha,
  emailAviso,
  emailLembrete,
  type DadosInscricao,
  type DadosAviso,
  type DadosLembrete,
} from "@/emails/templates";

/*
 * Envio pelo SMTP do Gmail, com senha de app.
 *
 * Por que não Resend: ele só envia de domínio verificado por SPF e DKIM, e
 * ninguém publica DNS no gmail.com. Enquanto a JUBIG não tiver domínio
 * próprio, o Gmail é o caminho que funciona — e ainda dá 500 envios por dia
 * contra os 100 do Resend gratuito.
 *
 * Trocar de provedor depois é mexer só neste arquivo: o resto do código
 * conhece apenas o objeto `Emails` lá embaixo.
 */

const NOME = process.env.EMAIL_NOME_REMETENTE ?? "JUBIG";

let transporte: Transporter | null = null;

function conexao() {
  const usuario = process.env.GMAIL_USUARIO?.trim();
  const senha = process.env.GMAIL_SENHA_APP?.replace(/\s/g, "");
  if (!usuario || !senha) return null;

  transporte ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: usuario, pass: senha },
    // Sem isso, cada envio abre e fecha conexão TLS — caro em serverless.
    pool: true,
    maxConnections: 2,
  });
  return { transporte, usuario };
}

async function enviar(para: string, msg: { subject: string; html: string }) {
  const conn = conexao();
  if (!conn) {
    console.error("[email] GMAIL_USUARIO/GMAIL_SENHA_APP não configurados — não enviei", para, msg.subject);
    return { ok: false as const, erro: "sem_credencial" };
  }

  try {
    /*
     * O endereço do remetente é SEMPRE a conta autenticada. O Gmail reescreve
     * (ou recusa) qualquer From diferente dela, então deixar isso configurável
     * só geraria e-mail saindo com remetente que ninguém esperava.
     */
    const info = await conn.transporte.sendMail({
      from: { name: NOME, address: conn.usuario },
      to: para,
      subject: msg.subject,
      html: msg.html,
    });
    return { ok: true as const, id: info.messageId };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[email] falhou", para, msg.subject, erro);
    // 550 5.4.5 é o limite diário do Gmail estourado: some tudo de uma vez.
    if (/5\.4\.5|Daily user sending (limit|quota) exceeded/i.test(erro)) {
      console.error("[email] LIMITE DIÁRIO DO GMAIL ESTOURADO — nenhum e-mail sai até amanhã");
    }
    return { ok: false as const, erro };
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

  redefinirSenha: (para: string, nome: string, url: string) =>
    enviar(para, emailRedefinirSenha(nome, url)),

  aviso: (para: string, nome: string, a: DadosAviso) => enviar(para, emailAviso(nome, a)),

  lembrete: (para: string, nome: string, tipo: "semana" | "vespera", d: DadosLembrete) =>
    enviar(para, emailLembrete(nome, tipo, d)),
};
