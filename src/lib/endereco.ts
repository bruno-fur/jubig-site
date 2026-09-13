/**
 * Serviços públicos de endereço, todos gratuitos e sem chave:
 *
 *   IBGE      — lista oficial de estados e municípios
 *   ViaCEP    — CEP para rua, bairro, cidade e estado
 *   Nominatim — endereço para latitude e longitude (OpenStreetMap)
 *
 * Chamados do navegador do admin, não do servidor. O Nominatim bloqueia com
 * facilidade IP compartilhado de nuvem — que é o que a Vercel usa — e o uso
 * aqui é baixíssimo: uma busca por igreja salva.
 */

export type Estado = { sigla: string; nome: string };

export async function listarEstados(): Promise<Estado[]> {
  const r = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
  if (!r.ok) throw new Error("ibge");
  const dados = (await r.json()) as { sigla: string; nome: string }[];
  return dados.map((e) => ({ sigla: e.sigla, nome: e.nome }));
}

export async function listarCidades(uf: string): Promise<string[]> {
  const r = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
  );
  if (!r.ok) throw new Error("ibge");
  const dados = (await r.json()) as { nome: string }[];
  return dados.map((c) => c.nome);
}

export type EnderecoDoCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
};

/** `null` quando o CEP não existe — o ViaCEP responde 200 com `erro: true`. */
export async function buscarCep(cep: string): Promise<EnderecoDoCep | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.erro) return null;
  return { logradouro: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade, estado: j.uf };
}

export type Coordenada = { latitude: number; longitude: number; precisao: "numero" | "rua" };

/**
 * Tenta o endereço com número; se não achar, sem o número.
 *
 * NÃO cai para o centro da cidade. Em cidade pequena do interior o número
 * costuma faltar no OpenStreetMap, e a rua basta para achar a igreja. Mas o
 * centro da cidade poria o pino num lugar que não é a igreja — e no mapa isso
 * parece informação conferida. Melhor sem pino do que pino errado.
 */
export async function geocodificar(e: {
  logradouro: string;
  numero?: string;
  cidade: string;
  estado: string;
  cep?: string;
}): Promise<Coordenada | null> {
  const tentar = async (rua: string) => {
    const q = new URLSearchParams({
      format: "json",
      limit: "1",
      countrycodes: "br",
      street: rua,
      city: e.cidade,
      state: e.estado,
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "accept-language": "pt-BR" },
    });
    if (!r.ok) return null;
    const [achado] = (await r.json()) as { lat: string; lon: string }[];
    return achado ? { latitude: Number(achado.lat), longitude: Number(achado.lon) } : null;
  };

  if (!e.logradouro.trim()) return null;

  if (e.numero?.trim()) {
    const comNumero = await tentar(`${e.numero.trim()} ${e.logradouro.trim()}`);
    if (comNumero) return { ...comNumero, precisao: "numero" };
  }

  const soRua = await tentar(e.logradouro.trim());
  return soRua ? { ...soRua, precisao: "rua" } : null;
}

export const mascaraCep = (v: string) => {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
