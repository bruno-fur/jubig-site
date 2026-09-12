/**
 * Manda um e-mail de verdade, com o template real, para conferir o SMTP.
 *
 *   npm run testar:email -- voce@exemplo.com
 *
 * Vale rodar antes de abrir as inscrições. Descobrir que a senha de app está
 * errada no dia em que trinta pessoas se inscreveram significa trinta pessoas
 * sem o código da inscrição e sem saber se a vaga saiu.
 *
 * Mande para Gmail, Outlook e Hotmail e veja em qual caixa caiu: remetente
 * @gmail.com vai para spam com mais facilidade que um domínio próprio.
 */
import { createTransport } from "nodemailer";

const destino = process.argv[2]?.trim();
if (!destino || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
  console.error("Uso: npm run testar:email -- voce@exemplo.com");
  process.exit(1);
}

const usuario = process.env.GMAIL_USUARIO?.trim();
const senha = process.env.GMAIL_SENHA_APP?.replace(/\s/g, "");
if (!usuario || !senha) {
  console.error("Faltam GMAIL_USUARIO e GMAIL_SENHA_APP no .env.local.");
  process.exit(1);
}

const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
if (!site || /localhost/.test(site)) {
  console.error(
    `NEXT_PUBLIC_SITE_URL está como "${site ?? "vazio"}".\n` +
      "As figurinhas do Juca no e-mail saem desse endereço — com localhost,\n" +
      "chega tudo com imagem quebrada e o teste não prova nada.\n" +
      "Aponte para https://jubig-site.vercel.app antes de rodar."
  );
  process.exit(1);
}

const { emailInscricaoRecebida } = await import("../src/emails/templates.ts");

const { subject, html } = emailInscricaoRecebida({
  nome: "Fulano de Teste",
  codigo: "JD-9999",
  evento: "JubigDay 2026",
  data: "17 de outubro de 2026",
  local: "Assis Chateaubriand",
  valor: "R$ 100,00",
  esportes: ["Futsal masculino (14h00)", "Queimada (16h00)"],
});

const transporte = createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: usuario, pass: senha },
});

try {
  await transporte.verify();
  console.log(`Conexão com o SMTP do Gmail: ok (${usuario})`);

  const info = await transporte.sendMail({
    from: { name: process.env.EMAIL_NOME_REMETENTE ?? "JUBIG", address: usuario },
    to: destino,
    subject: `[TESTE] ${subject}`,
    html,
  });

  console.log(`Enviado para ${destino} (${info.messageId})`);
  console.log("\nConfira na caixa de entrada:");
  console.log("  - caiu em spam?");
  console.log("  - a figurinha do Juca carregou?");
  console.log("  - o botão leva para o site certo?");
} catch (e) {
  const erro = e instanceof Error ? e.message : String(e);
  console.error(`\nFalhou: ${erro}`);
  if (/Invalid login|Username and Password not accepted|BadCredentials/i.test(erro)) {
    console.error(
      "\nCredencial recusada. Quase sempre é um destes:\n" +
        "  - a senha usada é a do Gmail, não uma senha de app\n" +
        "  - a verificação em duas etapas não está ligada na conta\n" +
        "  - a senha de app foi revogada"
    );
  }
  process.exit(1);
} finally {
  transporte.close();
}
