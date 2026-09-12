/**
 * Gera `supabase/email-confirmacao.html` para colar no painel do Supabase em
 * Authentication > Emails > Confirm signup.
 *
 * Por que passar por aqui: o e-mail de confirmação quem dispara é o Supabase,
 * não o nosso código — então ele não usa `src/lib/email.ts`. Sem colar este
 * HTML lá, a pessoa recebe o template cru do Supabase, sem o Juca e sem o tom
 * do resto do site.
 *
 * `{{ .ConfirmationURL }}` e `{{.Email}}` são os placeholders que o Supabase
 * troca na hora do envio. O `{{.Email}}` vai sem espaços de propósito: o
 * template corta o primeiro nome com split(" ") e um placeholder espaçado
 * viraria "{{" no assunto.
 *
 * Uso:
 *   npm run email:confirmacao -- https://jubig-site.vercel.app
 *
 * A URL entra no `src` da figurinha do Juca dentro do e-mail. Se sair como
 * localhost, o e-mail chega com a imagem quebrada na caixa de entrada de todo
 * mundo — e e-mail enviado não tem conserto.
 */
import { writeFileSync } from "node:fs";

const url = process.argv[2]?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();

if (!url || !/^https?:\/\//.test(url)) {
  console.error(
    "Falta a URL do site.\n" +
      "  npm run email:confirmacao -- https://seu-projeto.vercel.app\n" +
      "(ou preencha NEXT_PUBLIC_SITE_URL no .env.local)"
  );
  process.exit(1);
}

// Este HTML só tem um destino: o painel do Supabase, que manda e-mail de
// verdade. Localhost ali significa imagem quebrada na caixa de entrada.
if (/localhost|127\.0\.0\.1/.test(url)) {
  console.error(
    `A URL é ${url}.\n` +
      "Este template vai para o painel do Supabase e dispara e-mail real —\n" +
      "com localhost, a figurinha do Juca não carrega para ninguém.\n" +
      "  npm run email:confirmacao -- https://seu-projeto.vercel.app"
  );
  process.exit(1);
}

// Antes do import: o layout do e-mail lê essa variável para montar o src da imagem.
process.env.NEXT_PUBLIC_SITE_URL = url;

const { emailConfirmacaoEndereco } = await import("../src/emails/templates.ts");
const { subject, html } = emailConfirmacaoEndereco("{{.Email}}", "{{ .ConfirmationURL }}");

writeFileSync("supabase/email-confirmacao.html", html, "utf8");

console.log(`Gerado: supabase/email-confirmacao.html (imagens em ${url})`);
console.log(`Assunto para colar no Supabase: ${subject}`);
