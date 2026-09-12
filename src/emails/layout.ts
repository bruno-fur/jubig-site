import { urlDoSite } from "../lib/site.ts";

type Estado = "feliz" | "joia" | "nao" | "nervoso" | "choro" | "choque" | "heh" | "susto";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_DIRETORIA ?? "5545999999999";

export const CORES = {
  laranja: "#D94C1A",
  laranjaEscuro: "#A83A12",
  tinta: "#2A1710",
  creme: "#F8F1E0",
  areia: "#EFE4CE",
  linha: "#E0D3BC",
  apagado: "#7A6350",
  ok: "#2E7D32",
  ruim: "#C0392B",
};

export function linkWhatsApp(texto: string) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

type LayoutProps = {
  preheader: string;
  estado: Estado;
  titulo: string;
  corpo: string;
  botao?: { texto: string; url: string };
  rodapeWhatsApp?: string;
};

/** Layout base em tabela: é o único jeito que funciona bem no Gmail, Outlook e Apple Mail. */
export function layout({ preheader, estado, titulo, corpo, botao, rodapeWhatsApp }: LayoutProps) {
  // Resolvido aqui, não no topo do arquivo: o script que gera o template do
  // Supabase precisa apontar para produção, e a env dele só existe em runtime.
  const ASSETS = urlDoSite();
  const wa = linkWhatsApp(rodapeWhatsApp ?? "Olá! Tenho uma dúvida sobre minha inscrição na JUBIG.");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${CORES.creme};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;font-size:1px;color:${CORES.creme};max-height:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.creme};padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${CORES.linha};">

    <tr><td style="background:${CORES.tinta};padding:22px 24px;border-bottom:4px solid ${CORES.laranja};">
      <table role="presentation" width="100%"><tr>
        <td>
          <!--
            Logo com largura fixa em atributo, não só em CSS: o Outlook ignora
            largura declarada em style e estoura a imagem no tamanho original.
            O alt segura o texto para quem bloqueia imagem.
          -->
          <img src="${ASSETS}/logo-jubig-branco.png" width="150" height="75" alt="JUBIG"
               style="display:block;width:150px;height:auto;border:0;">
        </td>
        <td align="right" style="color:#CBB8A4;font-size:13px;">Juventude Batista do Iguaçu</td>
      </tr></table>
    </td></tr>

    <tr><td align="center" style="padding:26px 24px 0;">
      <img src="${ASSETS}/juca/${estado}.webp" width="110" alt="" style="display:block;width:110px;height:auto;">
    </td></tr>

    <tr><td style="padding:16px 28px 0;">
      <h1 style="margin:0 0 12px;font-size:23px;line-height:1.2;color:${CORES.tinta};font-weight:800;">${titulo}</h1>
      <div style="font-size:16px;line-height:1.65;color:#3E2A1E;">${corpo}</div>
    </td></tr>

    ${botao ? `<tr><td align="center" style="padding:26px 28px 0;">
      <a href="${botao.url}" style="display:inline-block;background:${CORES.laranja};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:15px 30px;border-radius:10px;">${botao.texto}</a>
    </td></tr>` : ""}

    <tr><td style="padding:28px 28px 0;">
      <table role="presentation" width="100%" style="background:${CORES.areia};border-radius:12px;">
        <tr><td style="padding:16px 18px;font-size:14.5px;line-height:1.6;color:${CORES.laranjaEscuro};">
          Ficou com dúvida? Fala com a diretoria no WhatsApp:
          <a href="${wa}" style="color:${CORES.laranjaEscuro};font-weight:600;">abrir conversa</a>.
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 28px 28px;">
      <p style="margin:0;font-size:12.5px;line-height:1.6;color:${CORES.apagado};border-top:1px solid ${CORES.linha};padding-top:16px;">
        Você recebeu este e-mail porque se inscreveu em um evento da JUBIG.<br>
        <a href="${ASSETS}" style="color:${CORES.apagado};">jubig.org.br</a>
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}

export function texto(...linhas: string[]) {
  return linhas.map((l) => `<p style="margin:0 0 12px;">${l}</p>`).join("");
}

export function caixaDados(itens: [string, string][]) {
  const linhas = itens
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:9px 0;font-size:14.5px;color:${CORES.apagado};${i ? `border-top:1px solid ${CORES.linha};` : ""}">${k}</td>
         <td align="right" style="padding:9px 0;font-size:14.5px;font-weight:600;color:${CORES.tinta};${i ? `border-top:1px solid ${CORES.linha};` : ""}">${v}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" style="margin:18px 0;border:1px solid ${CORES.linha};border-radius:12px;padding:6px 16px;">${linhas}</table>`;
}

export function selo(texto: string, cor: string, fundo: string) {
  return `<span style="display:inline-block;background:${fundo};color:${cor};font-size:13px;font-weight:600;padding:5px 13px;border-radius:99px;">${texto}</span>`;
}
