/**
 * Cadastra as igrejas e congregações da BIG, buscando a localização de cada uma.
 *
 *   npm run semear:igrejas
 *
 * A lista veio da relação oficial da BIG (nomes em caixa alta, sem cidade em
 * várias linhas). Aqui cada uma tem a cidade escrita à mão a partir do nome —
 * "Igreja Batista de Três Lagoas - Foz" é Foz do Iguaçu, "Portão Ocoy" é
 * distrito de São Miguel do Iguaçu — e a coordenada vem do Nominatim, o mesmo
 * serviço que o formulário de igrejas já usa.
 *
 * O que o Nominatim não achar entra sem coordenada: a igreja aparece na lista
 * do site, só não no mapa, e a diretoria completa o endereço em
 * Diretoria > Igrejas (o CEP preenche o resto). Ponto errado no mapa é pior
 * que ponto faltando — manda gente para o lugar errado no dia do evento.
 *
 * Idempotente: roda de novo sem duplicar. Igreja que já existe com o mesmo
 * nome na mesma cidade é pulada; se estiver sem coordenada, tenta de novo.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !secret) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

type Entrada = {
  nome: string;
  cidade: string;
  /** Bairro ou distrito, quando o nome da igreja carrega — ajuda a busca. */
  bairro?: string;
  /** true = congregação; muda só a ordem na lista do site. */
  congregacao?: boolean;
};

/*
 * Cidades conferidas pelo nome. As marcadas com "?" no comentário são as que
 * o nome não diz: o script busca assim mesmo e, se o Nominatim achar em outra
 * cidade, grava a que ele devolveu.
 */
const LISTA: Entrada[] = [
  { nome: "Quarta Igreja Batista de Cascavel", cidade: "Cascavel" },
  { nome: "Igreja Batista Betel", cidade: "Cascavel" },
  { nome: "Igreja Batista Boas Novas", cidade: "Medianeira" },
  { nome: "Igreja Batista Boas Novas", cidade: "São Miguel do Iguaçu" },
  { nome: "Igreja Batista Boas Novas Portão Ocoy", cidade: "São Miguel do Iguaçu", bairro: "Portão Ocoy" },
  { nome: "Igreja Batista Central de Cascavel", cidade: "Cascavel" },
  { nome: "Igreja Batista Central de Toledo", cidade: "Toledo" },
  { nome: "Igreja Batista de Assis Chateaubriand", cidade: "Assis Chateaubriand" },
  { nome: "Igreja Batista de Três Lagoas", cidade: "Foz do Iguaçu", bairro: "Três Lagoas" },
  { nome: "Igreja Batista de Ubiratã", cidade: "Ubiratã" },
  { nome: "Igreja Batista do Santa Cruz", cidade: "Cascavel", bairro: "Santa Cruz" }, // cidade?
  { nome: "Igreja Batista Ebenézer", cidade: "Anahy" },
  { nome: "Igreja Batista em Bragantina", cidade: "Cascavel", bairro: "Bragantina" }, // cidade?
  { nome: "Igreja Batista em Campina da Lagoa", cidade: "Campina da Lagoa" },
  { nome: "Igreja Batista em Jesuítas", cidade: "Jesuítas" },
  { nome: "Igreja Batista Esperança", cidade: "Santa Terezinha de Itaipu" },
  { nome: "Igreja Batista Esperança no Jardim Presidente", cidade: "Foz do Iguaçu", bairro: "Jardim Presidente" }, // cidade?
  { nome: "Igreja Batista Filadélfia", cidade: "Foz do Iguaçu" }, // cidade?
  { nome: "Igreja Batista Itaipu", cidade: "Foz do Iguaçu", bairro: "Vila Portes" },
  { nome: "Igreja Batista Monte Moriá", cidade: "Cascavel" }, // cidade?
  { nome: "Igreja Batista no Jardim São Paulo", cidade: "Foz do Iguaçu", bairro: "Jardim São Paulo" },
  { nome: "Igreja Batista Nova Vida", cidade: "Foz do Iguaçu" },
  { nome: "Igreja Batista Vila C", cidade: "Foz do Iguaçu", bairro: "Vila C" },
  { nome: "Igreja Evangélica Batista Monte Sinai", cidade: "Cascavel" },
  { nome: "Primeira Igreja Batista de Missal", cidade: "Missal" },
  { nome: "Primeira Igreja Batista de Toledo", cidade: "Toledo" },
  { nome: "Primeira Igreja Batista de Cafelândia", cidade: "Cafelândia" },
  { nome: "Primeira Igreja Batista de Cascavel", cidade: "Cascavel" },
  { nome: "Primeira Igreja Batista de Foz do Iguaçu", cidade: "Foz do Iguaçu" },
  { nome: "Primeira Igreja Batista de Matelândia", cidade: "Matelândia" },
  { nome: "Terceira Igreja Batista de Foz do Iguaçu", cidade: "Foz do Iguaçu" },

  { nome: "Comunidade Batista Relevante", cidade: "Foz do Iguaçu", bairro: "Prainha", congregacao: true }, // cidade?
  { nome: "Congregação Batista Agro Cafeeira", cidade: "Cascavel", bairro: "Agro Cafeeira", congregacao: true }, // cidade?
  { nome: "Congregação Batista de Barbosa Ferraz", cidade: "Barbosa Ferraz", congregacao: true },
  { nome: "Congregação Batista Carima", cidade: "Cascavel", bairro: "Carima", congregacao: true }, // cidade?
  { nome: "Congregação Batista Central", cidade: "Santa Tereza do Oeste", congregacao: true },
  { nome: "Congregação Batista em Céu Azul", cidade: "Céu Azul", congregacao: true },
  { nome: "Congregação Batista em Lindoeste", cidade: "Lindoeste", congregacao: true },
  { nome: "Congregação Batista em Ramilândia", cidade: "Ramilândia", congregacao: true },
  { nome: "Congregação Batista em Vera Cruz do Oeste", cidade: "Vera Cruz do Oeste", congregacao: true },
  { nome: "Congregação Batista de Itaipulândia", cidade: "Itaipulândia", congregacao: true },
  { nome: "Congregação Batista Jardim Clarito", cidade: "Cascavel", bairro: "Jardim Clarito", congregacao: true }, // cidade?
  { nome: "Congregação Batista Jardim Santa Cruz", cidade: "Cascavel", bairro: "Jardim Santa Cruz", congregacao: true },
  { nome: "Congregação Batista Jornada", cidade: "Foz do Iguaçu", congregacao: true },
  { nome: "Congregação Batista Porto Belo", cidade: "Foz do Iguaçu", bairro: "Porto Belo", congregacao: true }, // cidade?
  { nome: "Congregação Batista Porto Meira", cidade: "Foz do Iguaçu", bairro: "Porto Meira", congregacao: true },
  { nome: "Congregação Batista Rio Verde", cidade: "Cascavel", bairro: "Rio Verde", congregacao: true }, // cidade?
];

const normal = (t: string) =>
  (t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Achado = {
  latitude: number;
  longitude: number;
  cidade: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
};

type Resposta = {
  lat: string;
  lon: string;
  category?: string;
  type?: string;
  display_name?: string;
  address?: Record<string, string>;
};

/**
 * Busca no Nominatim. Só aceita o que parece igreja: sem isso, "Congregação
 * Batista Rio Verde" cai no município de Rio Verde, em Goiás.
 *
 * Uma consulta por segundo é o limite de uso da API pública.
 */
async function buscar(termo: string): Promise<Achado | null> {
  const q = new URLSearchParams({
    q: termo,
    format: "jsonv2",
    addressdetails: "1",
    limit: "3",
    countrycodes: "br",
  });

  const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
    headers: {
      "accept-language": "pt-BR",
      "user-agent": "jubig-site/1.0 (cadastro de igrejas; jubig.ofc@gmail.com)",
    },
  });
  if (!r.ok) {
    console.error(`      nominatim respondeu ${r.status}`);
    return null;
  }

  const lista = (await r.json()) as Resposta[];
  const bom = lista.find(
    (a) =>
      a.type === "place_of_worship" ||
      a.category === "amenity" ||
      /igreja|batista|congrega/i.test(a.display_name ?? "")
  );
  if (!bom) return null;

  const e = bom.address ?? {};
  return {
    latitude: Number(bom.lat),
    longitude: Number(bom.lon),
    cidade: e.city ?? e.town ?? e.village ?? e.municipality ?? null,
    logradouro: e.road ?? null,
    numero: e.house_number ?? null,
    bairro: e.suburb ?? e.neighbourhood ?? e.city_district ?? null,
    cep: (e.postcode ?? "").replace(/\D/g, "") || null,
  };
}

/** "Rua X, 123 - Centro · CEP 85900-000" — o texto que a home mostra. */
function montarEndereco(a: Achado) {
  if (!a.logradouro) return null;
  const rua = [a.logradouro, a.numero].filter(Boolean).join(", ");
  const partes = [rua, a.bairro].filter(Boolean).join(" - ");
  return a.cep ? `${partes} · CEP ${a.cep.slice(0, 5)}-${a.cep.slice(5)}` : partes;
}

// ------------------------------------------------------------

const { data: existentes, error: erroLista } = await db
  .from("igrejas")
  .select("id, nome, cidade, latitude");
if (erroLista) {
  console.error("Não deu para ler as igrejas:", erroLista.message);
  process.exit(1);
}

const jaTem = new Map(
  (existentes ?? []).map((i) => [`${normal(i.nome)}|${normal(i.cidade)}`, i])
);

let novas = 0;
let semPonto = 0;
let pulou = 0;
const paraConferir: string[] = [];

for (const [i, e] of LISTA.entries()) {
  const chave = `${normal(e.nome)}|${normal(e.cidade)}`;
  const atual = jaTem.get(chave);

  if (atual && atual.latitude !== null) {
    pulou++;
    continue;
  }

  const termo = [e.nome, e.bairro, e.cidade, "Paraná"].filter(Boolean).join(", ");
  const achado = await buscar(termo);
  await esperar(1100);

  const cidadeFinal = achado?.cidade ?? e.cidade;
  const linha = {
    nome: e.nome,
    cidade: cidadeFinal,
    estado: "PR",
    ordem: e.congregacao ? 100 + i : i,
    ativa: true,
    latitude: achado?.latitude ?? null,
    longitude: achado?.longitude ?? null,
    logradouro: achado?.logradouro ?? null,
    numero: achado?.numero ?? null,
    bairro: achado?.bairro ?? e.bairro ?? null,
    cep: achado?.cep ?? null,
    endereco: achado ? montarEndereco(achado) : null,
  };

  const { error } = atual
    ? await db.from("igrejas").update(linha).eq("id", atual.id)
    : await db.from("igrejas").insert(linha);

  if (error) {
    console.error(`FALHOU ${e.nome} (${e.cidade}): ${error.message}`);
    continue;
  }

  if (achado) {
    console.log(`ok    ${e.nome} — ${cidadeFinal}${cidadeFinal !== e.cidade ? " (cidade corrigida)" : ""}`);
    novas++;
  } else {
    console.log(`SEM PONTO  ${e.nome} — ${e.cidade}`);
    paraConferir.push(`${e.nome} (${e.cidade})`);
    semPonto++;
  }
}

console.log(`\n${novas} com localização, ${semPonto} sem, ${pulou} já estavam cadastradas.`);

if (paraConferir.length > 0) {
  console.log("\nComplete o endereço destas em Diretoria > Igrejas (o CEP preenche o resto):");
  for (const n of paraConferir) console.log(`  - ${n}`);
}

console.log(
  "\nConfira os pontos no mapa: em Diretoria > Igrejas, cada uma tem o link" +
    "\n'no mapa — conferir o ponto'. O Nominatim acerta o quarteirão, não a porta."
);
