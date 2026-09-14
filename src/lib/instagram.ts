import "server-only";
import { after } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/*
 * Últimas postagens do Instagram pela API oficial da Meta (Instagram API com
 * login do Instagram). Gratuita; exige conta Comercial ou Criador de conteúdo.
 *
 * Como funciona:
 *   - o admin cola a chave de acesso em Diretoria > Site; ela vai para a
 *     tabela `segredos`, que só o servidor lê
 *   - a home mostra o que está guardado em `instagram_cache` e, se tiver mais
 *     de 1 hora, busca de novo depois de responder (a visita não espera)
 *   - a chave vale 60 dias; é renovada sozinha a cada 7, na mesma busca e no
 *     cron diário — sem ninguém lembrar de nada
 */

export type PostagemInstagram = {
  id: string;
  legenda: string | null;
  imagem: string;
  link: string;
  tipo: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  data: string;
};

export type EstadoInstagram = {
  conectado: boolean;
  usuario: string | null;
  postagens: PostagemInstagram[];
  atualizadoEm: string | null;
  tokenExpiraEm: string | null;
  erro: string | null;
};

const API = "https://graph.instagram.com";
const QUANTAS = 6;
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

type Midia = {
  id: string;
  caption?: string;
  media_type: PostagemInstagram["tipo"];
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

async function chamar<T>(caminho: string): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try {
    const r = await fetch(`${API}${caminho}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) return { ok: false, erro: j.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, dados: j as T };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

const VAZIO: EstadoInstagram = {
  conectado: false,
  usuario: null,
  postagens: [],
  atualizadoEm: null,
  tokenExpiraEm: null,
  erro: null,
};

export async function estadoInstagram(): Promise<EstadoInstagram> {
  try {
    const admin = criarClienteAdmin();
    const [{ data: cache }, { data: token }] = await Promise.all([
      admin.from("instagram_cache").select("*").eq("id", 1).maybeSingle(),
      admin.from("segredos").select("chave").eq("chave", "instagram_token").maybeSingle(),
    ]);
    if (!cache) return VAZIO;
    return {
      conectado: Boolean(token),
      usuario: cache.usuario,
      postagens: (cache.postagens ?? []) as PostagemInstagram[],
      atualizadoEm: cache.atualizado_em,
      tokenExpiraEm: cache.token_expira_em,
      erro: cache.erro,
    };
  } catch {
    // Tabela ainda não existe (schema novo não aplicado): a home só não mostra a seção.
    return VAZIO;
  }
}

/** Para a home: o que está guardado, e atualização em segundo plano se estiver velho. */
export async function postagensInstagram() {
  const estado = await estadoInstagram();
  const velho = !estado.atualizadoEm || Date.now() - Date.parse(estado.atualizadoEm) > HORA;
  if (estado.conectado && velho) {
    after(() => atualizarInstagram().catch((e) => console.error("[instagram] atualizar falhou", e)));
  }
  return { usuario: estado.usuario, postagens: estado.postagens };
}

/** Renova a chave se já passou uma semana e busca as postagens. */
export async function atualizarInstagram(): Promise<{ ok: boolean; erro?: string }> {
  const admin = criarClienteAdmin();
  const [{ data: segredo }, { data: cache }] = await Promise.all([
    admin.from("segredos").select("valor").eq("chave", "instagram_token").maybeSingle(),
    admin.from("instagram_cache").select("token_renovado_em").eq("id", 1).maybeSingle(),
  ]);
  if (!segredo) return { ok: false, erro: "nao_conectado" };

  let token = segredo.valor as string;
  const agora = new Date();
  const mudancas: Record<string, unknown> = {};

  const renovadoEm = cache?.token_renovado_em ? Date.parse(cache.token_renovado_em) : 0;
  if (Date.now() - renovadoEm > 7 * DIA) {
    const r = await chamar<{ access_token: string; expires_in: number }>(
      `/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
    );
    if (r.ok) {
      token = r.dados.access_token;
      await admin
        .from("segredos")
        .update({ valor: token, atualizado_em: agora.toISOString() })
        .eq("chave", "instagram_token");
      mudancas.token_renovado_em = agora.toISOString();
      mudancas.token_expira_em = new Date(Date.now() + r.dados.expires_in * 1000).toISOString();
    } else {
      // Segue com a chave atual: ainda pode estar valendo. O erro fica registrado.
      console.error("[instagram] renovar chave falhou", r.erro);
    }
  }

  const campos = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const m = await chamar<{ data: Midia[] }>(
    `/me/media?fields=${campos}&limit=${QUANTAS}&access_token=${encodeURIComponent(token)}`
  );

  if (!m.ok) {
    // atualizado_em avança mesmo no erro: sem isso, cada visita tentaria de novo.
    await admin
      .from("instagram_cache")
      .update({ ...mudancas, erro: m.erro, atualizado_em: agora.toISOString() })
      .eq("id", 1);
    return { ok: false, erro: m.erro };
  }

  const postagens: PostagemInstagram[] = m.dados.data
    .map((p) => ({
      id: p.id,
      legenda: p.caption ?? null,
      // Vídeo não tem imagem própria: usa a capa.
      imagem: (p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url) ?? "",
      link: p.permalink,
      tipo: p.media_type,
      data: p.timestamp,
    }))
    .filter((p) => p.imagem);

  await admin
    .from("instagram_cache")
    .update({ ...mudancas, postagens, erro: null, atualizado_em: agora.toISOString() })
    .eq("id", 1);
  return { ok: true };
}

/** Confere a chave na própria Meta antes de guardar — chave errada não entra. */
export async function conectarInstagram(
  token: string
): Promise<{ ok: true; usuario: string } | { ok: false; erro: string }> {
  const eu = await chamar<{ username: string }>(
    `/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`
  );
  if (!eu.ok) return { ok: false, erro: eu.erro };

  const admin = criarClienteAdmin();
  const agora = Date.now();
  await admin
    .from("segredos")
    .upsert({ chave: "instagram_token", valor: token, atualizado_em: new Date(agora).toISOString() });
  await admin.from("instagram_cache").upsert({
    id: 1,
    usuario: eu.dados.username,
    postagens: [],
    erro: null,
    atualizado_em: null,
    // A Meta só renova chave com mais de 24h: primeira renovação amanhã.
    token_renovado_em: new Date(agora - 6 * DIA).toISOString(),
    token_expira_em: new Date(agora + 60 * DIA).toISOString(),
  });

  await atualizarInstagram();
  return { ok: true, usuario: eu.dados.username };
}

export async function desconectarInstagram() {
  const admin = criarClienteAdmin();
  await admin.from("segredos").delete().eq("chave", "instagram_token");
  await admin
    .from("instagram_cache")
    .upsert({ id: 1, usuario: null, postagens: [], erro: null, atualizado_em: null, token_renovado_em: null, token_expira_em: null });
}
