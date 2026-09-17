import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { INSTAGRAM } from "@/lib/site";
import { COMUNIDADE_PADRAO } from "@/emails/layout";

export type ConfiguracoesSite = {
  /** Só dígitos, com DDI: 5545999990000 — o formato que o wa.me aceita. */
  whatsapp: string;
  /** Sem @. */
  instagram: string;
  emailContato: string | null;
  /** Nulo = a home usa o texto padrão. */
  quemSomos: string | null;
  /** Convite da comunidade no WhatsApp (chat.whatsapp.com/...). */
  comunidade: string;
};

export const WHATSAPP_PADRAO = process.env.NEXT_PUBLIC_WHATSAPP_DIRETORIA ?? "5545999999999";

/**
 * O que a diretoria muda em Diretoria > Site, sem deploy.
 *
 * Cliente sem cookie de sessão: é dado público, e assim funciona também fora
 * de uma requisição — no cron dos lembretes e na montagem dos e-mails.
 *
 * Se a tabela ainda não existir (schema novo não aplicado) ou o campo estiver
 * vazio, cai nos valores que antes moravam nas variáveis de ambiente: o site
 * nunca fica sem WhatsApp por causa disso.
 */
export const lerConfiguracoes = cache(async (): Promise<ConfiguracoesSite> => {
  let linha: {
    whatsapp: string | null;
    instagram: string | null;
    email_contato: string | null;
    quem_somos: string | null;
    comunidade_whatsapp?: string | null;
  } | null = null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    // "*" e não a lista de colunas: coluna nova que ainda não existe no banco
    // derrubaria a consulta inteira, e o site perderia o WhatsApp junto.
    const { data } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();
    linha = data;
  } catch (e) {
    console.error("[configuracoes] leitura falhou, usando o padrão", e);
  }

  return {
    whatsapp: linha?.whatsapp || WHATSAPP_PADRAO,
    instagram: linha?.instagram || INSTAGRAM,
    emailContato: linha?.email_contato || null,
    quemSomos: linha?.quem_somos || null,
    comunidade: linha?.comunidade_whatsapp || COMUNIDADE_PADRAO,
  };
});
