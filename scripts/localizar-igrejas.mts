/**
 * Preenche a localização das igrejas que estão sem ponto no mapa.
 *
 *   npm run localizar:igrejas
 *
 * O Nominatim quase não conhece essas igrejas pelo nome — buscar
 * "Congregação Batista Jardim Clarito" não devolve nada. Então tenta em
 * cascata, do mais preciso para o mais grosseiro:
 *
 *   1. o nome da igreja no bairro e na cidade
 *   2. "igreja batista" no bairro (acha o templo, mesmo com outro nome)
 *   3. o bairro
 *   4. a cidade
 *
 * O que vem dos passos 3 e 4 é aproximado: serve para o mapa mostrar em que
 * cidade a JUBIG tem igreja, não para guiar ninguém até a porta. Por isso o
 * `endereco` só é gravado quando o passo 1 ou 2 acerta um templo — e é o
 * endereço que faz aparecer o botão "Como chegar" no site. Sem ele, ninguém
 * é mandado para o lugar errado.
 *
 * Roda quantas vezes quiser: só mexe em quem está sem coordenada.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

type Resposta = {
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  display_name?: string;
  address?: Record<string, string>;
};

type Achado = {
  latitude: number;
  longitude: number;
  precisao: "igreja" | "bairro" | "cidade";
  cidade: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(termo: string): Promise<Resposta[]> {
  const q = new URLSearchParams({
    q: termo,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "br",
  });

  const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
    headers: {
      "accept-language": "pt-BR",
      "user-agent": "jubig-site/1.0 (cadastro de igrejas; jubig.ofc@gmail.com)",
    },
  });
  // Uma consulta por segundo é o limite de uso da API pública.
  await esperar(1100);
  if (!r.ok) {
    console.error(`      nominatim respondeu ${r.status}`);
    return [];
  }
  return (await r.json()) as Resposta[];
}

function montar(a: Resposta, precisao: Achado["precisao"]): Achado {
  const e = a.address ?? {};
  return {
    latitude: Number(a.lat),
    longitude: Number(a.lon),
    precisao,
    cidade: e.city ?? e.town ?? e.village ?? e.municipality ?? null,
    logradouro: e.road ?? null,
    numero: e.house_number ?? null,
    bairro: e.suburb ?? e.neighbourhood ?? e.city_district ?? null,
    cep: (e.postcode ?? "").replace(/\D/g, "") || null,
  };
}

const ehTemplo = (a: Resposta) =>
  a.type === "place_of_worship" || /igreja|batista|congrega|capela|templo/i.test(a.display_name ?? "");

async function localizar(nome: string, cidade: string, bairro: string | null): Promise<Achado | null> {
  // 1. nome da igreja
  const porNome = await nominatim([nome, bairro, cidade, "Paraná"].filter(Boolean).join(", "));
  const templo = porNome.find(ehTemplo);
  if (templo) return montar(templo, "igreja");

  // 2. qualquer igreja batista no bairro/cidade
  const porTipo = await nominatim(
    ["igreja batista", bairro, cidade, "Paraná"].filter(Boolean).join(", ")
  );
  const outro = porTipo.find((a) => a.type === "place_of_worship");
  if (outro) return montar(outro, "igreja");

  // 3. o bairro
  if (bairro) {
    const [doBairro] = await nominatim(`${bairro}, ${cidade}, Paraná`);
    if (doBairro) return montar(doBairro, "bairro");
  }

  // 4. a cidade
  const [daCidade] = await nominatim(`${cidade}, Paraná, Brasil`);
  return daCidade ? montar(daCidade, "cidade") : null;
}

/** "Rua X, 123 - Centro · CEP 85900-000" — só para ponto de igreja mesmo. */
function enderecoDe(a: Achado) {
  if (a.precisao !== "igreja" || !a.logradouro) return null;
  const rua = [a.logradouro, a.numero].filter(Boolean).join(", ");
  const partes = [rua, a.bairro].filter(Boolean).join(" - ");
  return a.cep ? `${partes} · CEP ${a.cep.slice(0, 5)}-${a.cep.slice(5)}` : partes;
}

// ------------------------------------------------------------

const { data: pendentes, error } = await db
  .from("igrejas")
  .select("id, nome, cidade, bairro")
  .is("latitude", null)
  .order("ordem");

if (error) {
  console.error("Não deu para ler as igrejas:", error.message);
  process.exit(1);
}

if (!pendentes?.length) {
  console.log("Todas as igrejas já têm localização.");
  process.exit(0);
}

console.log(`${pendentes.length} sem localização. Buscando (leva uns minutos)...\n`);

const contagem = { igreja: 0, bairro: 0, cidade: 0, nada: 0 };
const aproximadas: string[] = [];

for (const i of pendentes) {
  const achado = await localizar(i.nome, i.cidade, i.bairro);

  if (!achado) {
    console.log(`nada       ${i.nome} — ${i.cidade}`);
    contagem.nada++;
    continue;
  }

  const endereco = enderecoDe(achado);
  const { error: erroUpdate } = await db
    .from("igrejas")
    .update({
      latitude: achado.latitude,
      longitude: achado.longitude,
      ...(achado.precisao === "igreja" && {
        logradouro: achado.logradouro,
        numero: achado.numero,
        bairro: achado.bairro ?? i.bairro,
        cep: achado.cep,
        endereco,
      }),
    })
    .eq("id", i.id);

  if (erroUpdate) {
    console.error(`FALHOU ${i.nome}: ${erroUpdate.message}`);
    continue;
  }

  contagem[achado.precisao]++;
  console.log(`${achado.precisao.padEnd(10)} ${i.nome} — ${i.cidade}`);
  if (achado.precisao !== "igreja") aproximadas.push(`${i.nome} (${i.cidade})`);
}

console.log(
  `\n${contagem.igreja} no ponto da igreja, ${contagem.bairro} no bairro, ` +
    `${contagem.cidade} no centro da cidade, ${contagem.nada} sem nada.`
);

if (aproximadas.length > 0) {
  console.log(
    "\nEstas ficaram com ponto APROXIMADO — o pino cai no bairro ou no centro da" +
      "\ncidade, e elas não mostram 'Como chegar' no site. Para acertar, abra" +
      "\nDiretoria > Igrejas e preencha o CEP de cada uma:"
  );
  for (const n of aproximadas) console.log(`  - ${n}`);
}
