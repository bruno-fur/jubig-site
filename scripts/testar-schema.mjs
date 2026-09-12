/**
 * Roda schema.sql, seed.sql e os testes de regra num Postgres descartável.
 *
 *   npm run testar:schema
 *
 * Serve para não descobrir erro de SQL no banco de produção, com inscrição de
 * gente de verdade dentro. Sobe um container, aplica tudo do zero, confere as
 * regras e derruba o container no fim.
 *
 * O `supabase/testes/stub-supabase.sql` imita só o que o Supabase já traz
 * pronto (auth.users, auth.uid, storage). Não é o Supabase: valida sintaxe,
 * trigger, função, política e RLS — não valida GoTrue nem o Storage de fato.
 */
import { execFileSync, spawnSync } from "node:child_process";

const CONTAINER = "jubig-teste-pg";
const IMAGEM = "postgres:17-alpine";

const docker = (args, opcoes = {}) =>
  spawnSync("docker", args, { encoding: "utf8", ...opcoes });

function exigeDocker() {
  const r = docker(["info"]);
  if (r.status !== 0) {
    console.error(
      "Docker não está respondendo. Abra o Docker Desktop e rode de novo.\n" +
        "Sem ele dá para conferir o SQL só colando no painel do Supabase — " +
        "o que significa achar erro no banco de produção."
    );
    process.exit(1);
  }
}

function derruba() {
  docker(["rm", "-f", CONTAINER], { stdio: "ignore" });
}

function psql(args, arquivos) {
  return docker([
    "exec",
    CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-d",
    "teste",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    ...arquivos.flatMap((f) => ["-f", `/tmp/${f}`]),
    ...args,
  ]);
}

exigeDocker();
derruba();

console.log("subindo postgres...");
execFileSync("docker", ["run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=postgres", IMAGEM], {
  stdio: "ignore",
});

try {
  /*
   * Tenta criar o banco em laço em vez de esperar o pg_isready.
   * Durante o initdb o Postgres aceita conexão, reinicia e derruba tudo —
   * o pg_isready fica verde no meio disso e o primeiro comando falha.
   */
  let pronto = false;
  for (let i = 0; i < 150; i++) {
    const r = docker(["exec", CONTAINER, "psql", "-U", "postgres", "-q", "-c", "create database teste;"]);
    if (r.status === 0) {
      pronto = true;
      break;
    }
  }
  if (!pronto) throw new Error("postgres não subiu a tempo");

  for (const [origem, destino] of [
    ["supabase/testes/stub-supabase.sql", "stub.sql"],
    ["supabase/schema.sql", "schema.sql"],
    ["supabase/seed.sql", "seed.sql"],
    ["supabase/testes/regras.sql", "regras.sql"],
  ]) {
    execFileSync("docker", ["cp", origem, `${CONTAINER}:/tmp/${destino}`], { stdio: "ignore" });
  }

  console.log("aplicando schema.sql e seed.sql...");
  const montagem = psql([], ["stub.sql", "schema.sql", "seed.sql"]);
  if (montagem.status !== 0) {
    console.error(montagem.stderr || montagem.stdout);
    throw new Error("schema.sql ou seed.sql não aplicou");
  }

  console.log("testando as regras...\n");
  const testes = psql([], ["regras.sql"]);
  const saida = (testes.stderr || "") + (testes.stdout || "");

  console.log(
    saida
      .split(/\r?\n/)
      .filter((l) => /NOTICE:|ERROR:|PASSARAM/.test(l))
      .map((l) => l.replace(/^psql:[^ ]* /, "").replace(/^NOTICE:\s*/, "  "))
      .join("\n")
  );

  if (testes.status !== 0) throw new Error("alguma regra não segurou");

  console.log("\nSchema validado. Pode colar no SQL Editor do Supabase.");
} finally {
  derruba();
}
