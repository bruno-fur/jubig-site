/**
 * Aplica os dados do `supabase/seed.sql` pela API, sem SQL Editor.
 *
 *   npm run semear
 *
 * O `schema.sql` precisa do SQL Editor porque cria tabela e função — DDL não
 * passa pelo PostgREST. O seed é só INSERT e UPDATE, então roda daqui.
 *
 * É idempotente do mesmo jeito que o arquivo: não duplica o que já existe e
 * não sobrescreve o que a diretoria tenha ajustado à mão. Só corrige o que o
 * seed considera estrutural — tipo do evento e capacidades.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

let mexeu = 0;
const ok = (t) => {
  console.log(`ok    ${t}`);
  mexeu++;
};
const igual = (t) => console.log(`      ${t} (já estava assim)`);

// ------------------------------------------------------------
// Congresso: tem inscrição, NÃO tem modalidades
// ------------------------------------------------------------
{
  const { data: atual } = await db
    .from("eventos")
    .select("id, tipo, tem_modalidades")
    .eq("slug", "congresso-carnaval-2027")
    .maybeSingle();

  if (!atual) console.log("      congresso não existe; rode supabase/seed.sql uma vez");
  else if (atual.tipo === "congresso" && !atual.tem_modalidades) igual("congresso");
  else {
    const { error } = await db
      .from("eventos")
      .update({ tipo: "congresso", tem_inscricao: true, tem_modalidades: false })
      .eq("id", atual.id);
    if (error) throw new Error(`congresso: ${error.message}`);
    ok("congresso marcado como congresso, sem modalidades");
  }
}

// ------------------------------------------------------------
// Igrejas de exemplo. Sem coordenada de propósito: inventar latitude
// e longitude colocaria o pino na rua errada, e no mapa isso parece
// informação conferida. Cadastre em Diretoria > Igrejas.
// ------------------------------------------------------------
const IGREJAS = [
  { nome: "Primeira Igreja Batista", cidade: "Assis Chateaubriand", ordem: 1 },
  { nome: "Primeira Igreja Batista", cidade: "Medianeira", ordem: 2 },
  { nome: "Primeira Igreja Batista", cidade: "Toledo", ordem: 3 },
];

for (const i of IGREJAS) {
  const { data: existe } = await db
    .from("igrejas")
    .select("id")
    .eq("nome", i.nome)
    .eq("cidade", i.cidade)
    .maybeSingle();

  if (existe) {
    igual(`igreja ${i.cidade}`);
    continue;
  }
  const { error } = await db.from("igrejas").insert({ ...i, estado: "PR" });
  if (error) throw new Error(`igreja ${i.cidade}: ${error.message}`);
  ok(`igreja cadastrada: ${i.nome} · ${i.cidade}`);
}

// ------------------------------------------------------------
// JubigTour: sem inscrição, ligado à igreja anfitriã
// ------------------------------------------------------------
{
  const { data: toledo } = await db
    .from("igrejas")
    .select("id")
    .eq("cidade", "Toledo")
    .limit(1)
    .maybeSingle();

  const tour = {
    slug: "jubigtour-toledo-2026",
    prefixo: "JT",
    nome: "JubigTour · Toledo",
    descricao:
      "Uma noite de louvor e comunhão na igreja anfitriã. Entrada franca, é só chegar.",
    data_evento: "2026-11-21",
    cidade: "Toledo",
    valor_centavos: 0,
    idade_minima: 12,
    max_parcelas: 1,
    publicado: false,
    tipo: "tour",
    tem_inscricao: false,
    tem_modalidades: false,
    igreja_id: toledo?.id ?? null,
  };

  const { data: existe } = await db
    .from("eventos")
    .select("id")
    .eq("slug", tour.slug)
    .maybeSingle();

  if (existe) {
    // Só o que é estrutural; nome e descrição podem ter sido editados.
    const { error } = await db
      .from("eventos")
      .update({
        tipo: "tour",
        tem_inscricao: false,
        tem_modalidades: false,
        igreja_id: tour.igreja_id,
      })
      .eq("id", existe.id);
    if (error) throw new Error(`tour: ${error.message}`);
    igual("JubigTour");
  } else {
    const { error } = await db.from("eventos").insert(tour);
    if (error) throw new Error(`tour: ${error.message}`);
    ok("JubigTour de Toledo criado (despublicado)");
  }
}

console.log(
  mexeu === 0
    ? "\nNada a fazer: o banco já estava com os dados do seed."
    : `\n${mexeu} mudança(s). Confira em Diretoria > Igrejas e publique o que quiser:\n  npm run evento -- --slug jubigtour-toledo-2026 --publicar`
);
