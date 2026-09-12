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
 */
import { writeFileSync } from "node:fs";
import { emailConfirmacaoEndereco } from "../src/emails/templates.ts";

const { subject, html } = emailConfirmacaoEndereco("{{.Email}}", "{{ .ConfirmationURL }}");

writeFileSync("supabase/email-confirmacao.html", html, "utf8");

console.log("Gerado: supabase/email-confirmacao.html");
console.log(`Assunto para colar no Supabase: ${subject}`);
