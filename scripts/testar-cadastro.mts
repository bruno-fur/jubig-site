/**
 * Testa o cadastro e a confirmação contra o banco de PRODUÇÃO, de ponta a
 * ponta, e apaga o usuário de teste no fim.
 *
 *   npm run testar:cadastro
 *
 * Cobre o que nenhum teste local alcança: se o "Confirm email" do painel do
 * Supabase ficou ligado, o cadastro não devolve sessão — a pessoa se cadastra
 * e não entra, e a faixa de aviso nunca aparece. Isso só dá para descobrir
 * falando com o projeto de verdade.
 *
 * Não manda e-mail nenhum: o token é criado direto no banco.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !publishable || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

let falhas = 0;
const ok = (t: string) => console.log(`ok     ${t}`);
const falha = (t: string, d: string) => {
  console.log(`FALHA  ${t} — ${d}`);
  falhas++;
};

const email = `teste-jubig-${crypto.randomUUID().slice(0, 8)}@example.com`;
const senha = crypto.randomUUID();
let userId: string | null = null;

try {
  // --- cadastro ---
  const { data: cadastro, error: erroCadastro } = await anon.auth.signUp({
    email,
    password: senha,
    options: { data: { nome: "Fulano De Teste", igreja: "IB Teste", telefone: "+5545999990000" } },
  });

  if (erroCadastro) {
    falha("cadastro", erroCadastro.message);
    throw new Error("sem usuário, não dá para seguir");
  }
  userId = cadastro.user?.id ?? null;
  ok("cadastro aceito");

  if (!cadastro.session) {
    falha(
      "sessão no cadastro",
      'veio vazia — o "Confirm email" do Supabase está LIGADO. Desligue em ' +
        "Authentication > Sign In / Providers > Email, senão a pessoa se cadastra e não entra."
    );
  } else {
    ok('cadastro devolve sessão (Confirm email está desligado, como deve)');
  }

  // --- o trigger criou o perfil? ---
  const { data: perfil } = await admin
    .from("perfis")
    .select("nome, igreja, telefone, email_confirmado_em")
    .eq("id", userId!)
    .maybeSingle();

  if (!perfil) falha("perfil", "o trigger ao_criar_usuario não criou a linha em perfis");
  else {
    ok(`perfil criado pelo trigger (nome: ${perfil.nome})`);
    if (perfil.email_confirmado_em) falha("estado inicial", "já nasceu confirmado");
    else ok("nasce sem confirmação, como deve");
  }

  /*
   * Camada 4, testada na própria política.
   *
   * Passar por `criar_inscricao` não serve: com o evento despublicado ela
   * para antes, em 'evento_nao_encontrado', e o teste passaria verde sem
   * nunca ter encostado na RLS. O insert direto em `inscricoes` bate na
   * política "criar inscricao com email confirmado" e em mais nada.
   */
  const comoUsuario = cadastro.session
    ? createClient(url, publishable, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${cadastro.session.access_token}` } },
      })
    : null;

  const { data: evento } = await admin
    .from("eventos")
    .select("id, valor_centavos")
    .eq("slug", "jubigday-2026")
    .maybeSingle();

  const tentarInscrever = async (codigo: string) =>
    comoUsuario!.from("inscricoes").insert({
      codigo,
      evento_id: evento!.id,
      responsavel_id: userId,
      valor_centavos: evento!.valor_centavos,
    });

  if (comoUsuario && evento) {
    const { error } = await tentarInscrever(`TS-${Date.now()}`);
    if (error?.code === "42501") ok("camada 4: a RLS recusou o insert sem confirmação");
    else if (error) falha("camada 4", `recusou, mas por outro motivo: ${error.code} ${error.message}`);
    else falha("camada 4", "gravou inscrição SEM e-mail confirmado");
  }

  // --- confirmação ---
  const { data: token, error: erroToken } = await admin
    .from("confirmacoes_email")
    .insert({ user_id: userId })
    .select("token")
    .single();

  if (erroToken || !token) falha("token", erroToken?.message ?? "não gravou");
  else {
    ok("token de confirmação gravado");

    const { data: r } = await admin.rpc("confirmar_email", { p_token: token.token });
    if (r === "ok") ok("confirmar_email devolveu ok");
    else falha("confirmar_email", `devolveu ${r}`);

    const { data: depois } = await admin
      .from("perfis")
      .select("email_confirmado_em")
      .eq("id", userId!)
      .maybeSingle();
    if (depois?.email_confirmado_em) ok("perfis.email_confirmado_em preenchido");
    else falha("confirmação", "rodou mas não gravou em perfis");

    const { data: repetido } = await admin.rpc("confirmar_email", { p_token: token.token });
    if (repetido === "ja_usado") ok("token não serve duas vezes");
    else falha("reuso de token", `devolveu ${repetido}`);

    // A mesma política, agora com o e-mail confirmado, precisa deixar passar —
    // senão a camada 4 estaria barrando todo mundo, e ninguém se inscreveria.
    if (comoUsuario && evento) {
      const codigo = `TS-${Date.now()}`;
      const { error } = await tentarInscrever(codigo);
      if (error) falha("camada 4 depois de confirmar", `${error.code} ${error.message}`);
      else {
        ok("camada 4: confirmado passa a conseguir gravar inscrição");
        await admin.from("inscricoes").delete().eq("codigo", codigo);
      }
    }
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    console.log(error ? `\nNÃO apaguei o usuário de teste ${email}: ${error.message}` : `\nusuário de teste apagado (${email})`);
  }
}

console.log(falhas === 0 ? "\nCadastro e confirmação funcionam em produção." : `\n${falhas} problema(s).`);
// exitCode em vez de exit(): com exit() o Node aborta com as conexões do
// Supabase ainda abertas e imprime um assert do libuv por cima do resultado.
process.exitCode = falhas === 0 ? 0 : 1;
