/**
 * Cadastra as variáveis de ambiente na Vercel a partir do .env.local.
 *
 *   vercel login          (uma vez, abre o navegador)
 *   vercel link           (uma vez, escolhe o projeto)
 *   npm run vercel:env -- --site https://jubig-site.vercel.app
 *
 * Existe porque preencher nove variáveis no formulário é onde o erro acontece:
 * colar um bloco de KEY=valor no campo Key cria os nomes e deixa os valores
 * para trás, e o resultado é um site que sobe e não fala com o banco, sem
 * dizer o porquê.
 *
 * `--dry` mostra o que faria sem mandar nada.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ensaio = args.includes("--dry");

// NEXT_PUBLIC_SITE_URL no .env.local aponta para localhost; em produção, não.
const site = opcao("site");
if (!site && !ensaio) {
  console.error(
    "Falta a URL de produção:\n  npm run vercel:env -- --site https://jubig-site.vercel.app\n" +
      "(o .env.local tem localhost, que não pode ir para a Vercel)"
  );
  process.exit(1);
}
if (site && /localhost|127\.0\.0\.1/.test(site)) {
  console.error(`--site não pode ser ${site}: os links dos e-mails sairiam apontando para lá.`);
  process.exit(1);
}

const NOMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "GMAIL_USUARIO",
  "GMAIL_SENHA_APP",
  "EMAIL_NOME_REMETENTE",
  "NEXT_PUBLIC_WHATSAPP_DIRETORIA",
  "NEXT_PUBLIC_INSTAGRAM",
];

// Lê o .env.local na mão: só as linhas NOME=valor, ignorando comentário.
const valores = {};
for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  valores[m[1]] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
}
if (site) valores.NEXT_PUBLIC_SITE_URL = site;

const faltando = NOMES.filter((n) => !valores[n]);
if (faltando.length) {
  console.error(`Sem valor no .env.local: ${faltando.join(", ")}`);
  process.exit(1);
}

/*
 * Duas formas de autenticar, porque `vercel login` abre o navegador e nem todo
 * terminal consegue fazer isso:
 *   - sessão do CLI, de um `vercel login` feito antes
 *   - VERCEL_TOKEN no ambiente (vercel.com/account/tokens)
 *
 * Com token não é preciso `vercel link`: `--project` resolve o destino.
 */
const token = process.env.VERCEL_TOKEN?.trim() || opcao("token");
const projeto = opcao("projeto") ?? "jubig-site";
const escopo = opcao("escopo");

const autenticacao = [
  ...(token ? ["--token", token] : []),
  ...(escopo ? ["--scope", escopo] : []),
];

if (!ensaio) {
  const quem = spawnSync("npx", ["vercel", "whoami", ...autenticacao], {
    encoding: "utf8",
    shell: true,
  });
  if (quem.status !== 0) {
    console.error(
      "O CLI da Vercel não está autenticado. Escolha um:\n" +
        "  vercel login                       (num terminal normal, abre o navegador)\n" +
        "  VERCEL_TOKEN=... npm run vercel:env -- --site https://...\n" +
        "    (token em vercel.com/account/tokens)"
    );
    process.exit(1);
  }
  console.log(`Autenticado como ${quem.stdout.trim().split("\n").pop()}\n`);
}

/*
 * Tudo como Config, nunca Secret. Variável marcada como Sensitive na Vercel
 * fica indisponível durante o build — e NEXT_PUBLIC_ precisa existir lá,
 * porque é no build que o valor é embutido no JavaScript do navegador. Manter
 * o mesmo tipo para todas evita ter que lembrar de qual é qual.
 */
for (const nome of NOMES) {
  for (const alvo of ["production", "preview"]) {
    const comando = [
      "vercel", "env", "add", nome, alvo,
      "--value", valores[nome],
      "--no-sensitive", "--force", "--yes",
      "--project", projeto,
      ...autenticacao,
    ];

    if (ensaio) {
      const visivel = nome.includes("KEY") || nome.includes("SENHA");
      console.log(`[dry] ${nome} (${alvo}) = ${visivel ? "•".repeat(12) : valores[nome]}`);
      continue;
    }

    const r = spawnSync("npx", comando, { encoding: "utf8", shell: true });
    if (r.status !== 0) {
      console.error(`falhou ${nome} (${alvo}): ${(r.stderr || r.stdout).trim().split("\n").pop()}`);
      process.exit(1);
    }
    console.log(`ok  ${nome} (${alvo})`);
  }
}

if (!ensaio) {
  console.log("\nVariáveis cadastradas. Falta o deploy para elas valerem:");
  console.log("  npx vercel --prod");
}
