import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * O Gmail gratuito corta em ~500 destinatários por dia, somando TUDO: aviso,
 * lembrete, confirmação de conta, comprovante. Um aviso para a lista inteira
 * no dia de pico de inscrições derrubaria os e-mails transacionais — e aí a
 * pessoa que acabou de se inscrever não recebe o código.
 *
 * Por isso disparo em massa para em 350 e deixa folga para o dia a dia.
 */
export const LIMITE_DISPARO = 350;

export type Destinatario = { userId: string; email: string; nome: string };

/**
 * Responsáveis de inscrição ativa num evento — um e-mail por pessoa, mesmo que
 * ela tenha feito duas inscrições. Numa caravana de 20, avisa-se quem inscreveu,
 * não os 20: é essa pessoa que tem o e-mail e repassa no grupo.
 */
export async function responsaveisDoEvento(
  eventoId: string,
  status: string[] = ["aguardando_pagamento", "em_analise", "confirmada"]
): Promise<(Destinatario & { codigo: string; confirmada: boolean })[]> {
  const admin = criarClienteAdmin();

  const { data: inscricoes } = await admin
    .from("inscricoes")
    .select("responsavel_id, codigo, status")
    .eq("evento_id", eventoId)
    .in("status", status)
    .order("criado_em");

  const porPessoa = new Map<string, { codigo: string; confirmada: boolean }>();
  for (const i of inscricoes ?? []) {
    const id = i.responsavel_id as string;
    const atual = porPessoa.get(id);
    // Se tem uma confirmada, é ela que o lembrete cita.
    if (!atual || (!atual.confirmada && i.status === "confirmada"))
      porPessoa.set(id, { codigo: i.codigo as string, confirmada: i.status === "confirmada" });
  }

  const ids = [...porPessoa.keys()];
  if (ids.length === 0) return [];

  const { data: perfis } = await admin.from("perfis").select("id, nome").in("id", ids);
  const nomes = new Map((perfis ?? []).map((p) => [p.id as string, (p.nome as string) ?? ""]));

  const resultado = await Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      const email = data?.user?.email;
      if (!email) return null;
      return { userId: id, email, nome: nomes.get(id) ?? "", ...porPessoa.get(id)! };
    })
  );

  return resultado.filter((r): r is NonNullable<typeof r> => r !== null);
}

/** Envia em fila, poucos por vez, para não abrir 300 conexões SMTP de uma vez. */
export async function enviarEmFila<T>(
  itens: T[],
  enviar: (item: T) => Promise<{ ok: boolean }>,
  simultaneos = 4
) {
  let enviados = 0;
  let falhas = 0;
  for (let i = 0; i < itens.length; i += simultaneos) {
    const lote = await Promise.all(itens.slice(i, i + simultaneos).map(enviar));
    for (const r of lote) {
      if (r.ok) enviados++;
      else falhas++;
    }
  }
  return { enviados, falhas };
}
