/**
 * Mostra e ajusta a configuração de um evento sem passar por SQL na mão.
 *
 *   npm run evento                          -- mostra o checklist do JubigDay
 *   npm run evento -- --slug congresso-...  -- outro evento
 *   npm run evento -- --pix +5545998112434 --recebedor "JUVENTUDE BATISTA" --cidade "ASSIS CHATEAUBRIAND"
 *   npm run evento -- --publicar
 *   npm run evento -- --despublicar
 *
 * Existe porque abrir inscrição é um update de três campos que, errados,
 * quebram de formas silenciosas: chave PIX sem o +55 faz o app do banco não
 * achar a chave, e nome ou cidade acima do limite do BR Code cortam no meio.
 * Aqui as regras são conferidas antes de gravar.
 *
 * Usa a chave secret — roda só na sua máquina, nunca no site.
 */
import { createClient } from "@supabase/supabase-js";
import { gerarBRCode } from "../src/lib/pix.ts";
import { formatarData, formatarReais } from "../src/lib/validacao.ts";

const args = process.argv.slice(2);
const opcao = (nome: string) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const tem = (nome: string) => args.includes(`--${nome}`);

const slug = opcao("slug") ?? "jubigday-2026";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- monta o update a partir dos argumentos ---
const mudancas: Record<string, unknown> = {};

const pix = opcao("pix");
if (pix) {
  if (/^\d{10,11}$/.test(pix)) {
    console.error(
      `A chave "${pix}" é um celular sem o +55.\n` +
        "No DICT, chave de telefone é +55DDNNNNNNNNN — sem isso o app do banco\n" +
        "não encontra a chave e o pagamento não sai."
    );
    process.exit(1);
  }
  mudancas.pix_chave = pix;
}

const recebedor = opcao("recebedor");
if (recebedor) {
  if (recebedor.length > 25) {
    console.error(`"${recebedor}" tem ${recebedor.length} caracteres; o BR Code corta em 25.`);
    process.exit(1);
  }
  mudancas.pix_nome = recebedor;
}

const cidade = opcao("cidade");
if (cidade) {
  if (cidade.length > 15) {
    console.error(
      `"${cidade}" tem ${cidade.length} caracteres; o BR Code corta em 15 ` +
        `(ficaria "${cidade.slice(0, 15)}").`
    );
    process.exit(1);
  }
  mudancas.pix_cidade = cidade;
}

if (tem("publicar")) mudancas.publicado = true;
if (tem("despublicar")) mudancas.publicado = false;

if (Object.keys(mudancas).length > 0) {
  const { error } = await admin.from("eventos").update(mudancas).eq("slug", slug);
  if (error) {
    console.error("falhou:", error.message);
    process.exit(1);
  }
  console.log(`Atualizado: ${Object.keys(mudancas).join(", ")}\n`);
}

// --- mostra o estado atual ---
const { data: evento, error } = await admin
  .from("eventos")
  .select("*")
  .eq("slug", slug)
  .maybeSingle();

if (error || !evento) {
  console.error(`Evento "${slug}" não encontrado.`);
  process.exit(1);
}

const { count: modalidades } = await admin
  .from("esportes")
  .select("id", { count: "exact", head: true })
  .eq("evento_id", evento.id);

const { count: inscritos } = await admin
  .from("inscritos")
  .select("id", { count: "exact", head: true })
  .eq("evento_id", evento.id);

console.log(`${evento.nome}  (${evento.slug})`);
console.log(`${formatarData(evento.data_evento)} · ${evento.cidade} · ${formatarReais(evento.valor_centavos)} por pessoa`);
console.log(`Inscrições até ${evento.inscricoes_ate ? formatarData(evento.inscricoes_ate) : "a data do evento"}`);
console.log(`${modalidades ?? 0} modalidades · ${inscritos ?? 0} inscritos até agora\n`);

const podeCobrar = Boolean(evento.pix_chave && evento.pix_nome && evento.pix_cidade);

const item = (feito: boolean, texto: string) => `${feito ? "ok    " : "FALTA "} ${texto}`;
console.log("Para abrir as inscrições:");
console.log(item(Boolean(evento.pix_chave), `chave PIX${evento.pix_chave ? ` (${evento.pix_chave})` : ""}`));
console.log(item(Boolean(evento.pix_nome), `recebedor${evento.pix_nome ? ` (${evento.pix_nome})` : ""}`));
console.log(item(Boolean(evento.pix_cidade), `cidade${evento.pix_cidade ? ` (${evento.pix_cidade})` : ""}`));
console.log(item((modalidades ?? 0) > 0, "modalidades cadastradas"));
console.log(item(evento.publicado, "publicado"));

if (podeCobrar) {
  const br = gerarBRCode({
    chave: evento.pix_chave!,
    nome: evento.pix_nome!,
    cidade: evento.pix_cidade!,
    valorCentavos: evento.valor_centavos,
    identificador: `${evento.prefixo}0001`,
  });
  console.log(`\nBR Code de uma inscrição de ${formatarReais(evento.valor_centavos)}:`);
  console.log(br);
  console.log("\nCole no app do banco antes de publicar. Se der 'chave não encontrada',");
  console.log("a chave não está registrada nesse formato.");
}

if (!evento.publicado) {
  console.log("\nO evento não aparece no site enquanto estiver despublicado.");
  console.log("Quando o PIX estiver testado:  npm run evento -- --publicar");
}
