/**
 * Confere o banco de produção usando só a chave publishable — ou seja,
 * exatamente o que um visitante anônimo consegue fazer.
 *
 *   npm run testar:supabase
 *
 * `npm run testar:schema` valida o SQL num Postgres de mentira. Este aqui
 * pergunta outra coisa: o que está no ar agora, no projeto de verdade, deixa
 * vazar alguma coisa? É a diferença entre "o script está certo" e "o script
 * foi aplicado".
 *
 * Nunca use a chave secret aqui. Ela ignora a RLS, e o teste inteiro é
 * justamente saber se a RLS está segurando.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.");
  process.exit(1);
}
if (/sb_secret_|service_role/.test(chave)) {
  console.error("Essa é a chave SECRET. Ela ignora a RLS e invalida o teste. Use a publishable.");
  process.exit(1);
}

const supabase = createClient(url, chave);

let falhas = 0;
const ok = (nome: string) => console.log(`ok     ${nome}`);
const falha = (nome: string, detalhe: string) => {
  console.log(`FALHA  ${nome} — ${detalhe}`);
  falhas++;
};

/** Tabela que o anônimo NÃO pode ler: tem que voltar vazia ou negada. */
async function naoVaza(tabela: string) {
  const { data, error } = await supabase.from(tabela).select("*").limit(1);
  if (error) return ok(`${tabela} negada para anônimo (${error.code ?? "erro"})`);
  if (!data || data.length === 0) return ok(`${tabela} volta vazia para anônimo`);
  falha(tabela, `${data.length} linha(s) visível(is) sem login`);
}

/** Tabela ou view de leitura pública. */
async function leituraPublica(tabela: string, esperado?: number) {
  const { data, error } = await supabase.from(tabela).select("*");
  if (error) return falha(tabela, error.message);
  const n = data?.length ?? 0;
  if (esperado !== undefined && n !== esperado)
    return falha(tabela, `esperava ${esperado} linha(s), veio ${n}`);
  ok(`${tabela} legível para anônimo (${n} linha${n === 1 ? "" : "s"})`);
}

console.log(`Banco: ${url}\nChave: publishable (papel anônimo)\n`);

// --- o que o visitante pode ver ---
await leituraPublica("eventos");
await leituraPublica("esportes");
await leituraPublica("vagas_por_esporte");
await leituraPublica("duvidas");

// --- o que ele nunca pode ver ---
for (const t of ["inscricoes", "inscritos", "comprovantes", "perfis", "inscritos_esportes"]) {
  await naoVaza(t);
}

// `diretoria` sem login não pode listar quem valida comprovante.
await naoVaza("diretoria");

// --- escrita anônima tem que ser recusada ---
{
  const { error } = await supabase
    .from("inscricoes")
    .insert({ codigo: "XX-9999", evento_id: crypto.randomUUID(), responsavel_id: crypto.randomUUID(), valor_centavos: 1 });
  error ? ok("insert anônimo em inscricoes recusado") : falha("inscricoes", "anônimo conseguiu inserir");
}

// --- o bucket dos comprovantes não pode ser público ---
{
  const { data, error } = await supabase.storage.from("comprovantes").list();
  if (error) ok(`bucket comprovantes fechado para anônimo (${error.message})`);
  else if (!data?.length) ok("bucket comprovantes não lista nada para anônimo");
  else falha("storage", `${data.length} arquivo(s) listado(s) sem login`);
}

// --- a função de criar inscrição não pode rodar sem login ---
{
  const { error } = await supabase.rpc("criar_inscricao", {
    p_slug: "jubigday-2026",
    p_parcelas: 1,
    p_inscritos: [],
  });
  error ? ok(`criar_inscricao negada para anônimo (${error.code ?? "erro"})`) : falha("criar_inscricao", "rodou sem login");
}

/*
 * Segunda parte, só se a chave secret estiver no ambiente: confere o que a
 * diretoria precisa e que o papel anônimo nunca alcança. São as três coisas
 * que só falhariam em produção, na frente de alguém esperando aprovação.
 */
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!secret) {
  console.log("\n(sem SUPABASE_SERVICE_ROLE_KEY: pulei as checagens da diretoria)");
} else {
  console.log("\n--- caminho da diretoria (chave secret) ---");
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  {
    const { error } = await admin.from("inscricoes").select("id").limit(1);
    error ? falha("secret lê inscricoes", error.message) : ok("secret lê inscricoes ignorando a RLS");
  }

  {
    // É como a diretoria abre o comprovante sem tornar o bucket público.
    const { data, error } = await admin.storage
      .from("comprovantes")
      .createSignedUrl("teste/inexistente.jpg", 60);
    if (data?.signedUrl) ok("signed URL gerada");
    else if (/not.*found|Object not found/i.test(error?.message ?? ""))
      ok("signed URL funciona (arquivo de teste não existe, como esperado)");
    else falha("signed URL", error?.message ?? "sem url e sem erro");
  }

  {
    // Usado em api/admin/validar para achar o e-mail de quem se inscreveu.
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    error ? falha("auth.admin", error.message) : ok("auth.admin responde (e-mail do responsável)");
  }
}

console.log(
  falhas === 0
    ? "\nNenhum vazamento. A RLS está no ar."
    : `\n${falhas} problema(s). Rode supabase/schema.sql de novo no SQL Editor.`
);
process.exit(falhas === 0 ? 0 : 1);
