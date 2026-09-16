import type { Metadata } from "next";
import Link from "next/link";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { eventosPublicados, esportesDoEvento } from "@/lib/eventos";
import { formatarData, formatarReais, formatarCPF } from "@/lib/validacao";
import { CartaoValidacao } from "@/components/CartaoValidacao";
import { Exportar } from "@/components/Exportar";
import { ROTULO_TURNO } from "@/tipos/db";
import { SeletorEvento, escolherEvento } from "@/components/SeletorEvento";
import type {
  Comprovante,
  Evento,
  Inscricao,
  Inscrito,
  PainelEvento,
  PainelIgreja,
} from "@/tipos/db";

export const metadata: Metadata = { title: "Diretoria" };

type Pendente = Comprovante & {
  inscricoes: Inscricao & { eventos: Evento; inscritos: Inscrito[] };
};

/**
 * Visão geral de UM evento por vez, escolhido no topo.
 *
 * Mostrar todos juntos empilhava números de três eventos, e a lista de
 * igrejas misturava gente do JubigDay com a do Congresso sem dizer de qual
 * era. O selo em cada evento conta os comprovantes esperando, para a fila de
 * outro evento não passar despercebida.
 */
export default async function VisaoGeral({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  await exigirDiretoria();
  const { evento: slug } = await searchParams;
  const supabase = await createClient();

  const [{ data: painel }, { data: igrejas }, { data: pendentesCru }, eventos] = await Promise.all([
    supabase.from("painel_evento").select("*").order("data_evento"),
    supabase.from("painel_igrejas").select("*").order("pessoas", { ascending: false }),
    supabase
      .from("comprovantes")
      // !inner para poder filtrar pela inscrição: cancelada sai da fila.
      .select("*, inscricoes!inner(*, eventos(*), inscritos(*))")
      .is("aprovado", null)
      .neq("inscricoes.status", "cancelada")
      .order("enviado_em", { ascending: true }),
    eventosPublicados(),
  ]);

  /*
   * As views do painel só existem depois de `supabase/schema.sql` ser aplicado.
   * Enquanto não estiverem lá, a consulta volta vazia e a tela mostra a fila de
   * comprovantes sem os números — em vez de derrubar o painel inteiro.
   */
  const numeros = (painel ?? []) as PainelEvento[];
  const todosPendentes = (pendentesCru ?? []) as Pendente[];

  const atual = escolherEvento(
    numeros.map((n) => ({ ...n, data_fim: null })),
    slug,
    (n) => n.publicado
  );
  const n = atual ? numeros.find((x) => x.evento_id === atual.evento_id) : undefined;
  const pendentes = todosPendentes.filter((c) => c.inscricoes.evento_id === n?.evento_id);
  const pendentesPorEvento = new Map<string, number>();
  for (const c of todosPendentes)
    pendentesPorEvento.set(c.inscricoes.evento_id, (pendentesPorEvento.get(c.inscricoes.evento_id) ?? 0) + 1);
  const igrejasDoEvento = ((igrejas ?? []) as PainelIgreja[]).filter((i) => i.evento_id === n?.evento_id);

  /*
   * Signed URL curta, gerada agora e só para quem já passou pela RLS.
   * O bucket é privado: comprovante de PIX mostra nome, banco e às vezes CPF.
   */
  const comLink = await Promise.all(
    pendentes.map(async (c) => {
      const { data: assinado } = await supabase.storage
        .from("comprovantes")
        .createSignedUrl(c.caminho, 60 * 10);
      return { ...c, url: assinado?.signedUrl ?? null };
    })
  );

  // Sem `.order("turno")`: `esportesDoEvento` já devolve na ordem certa.
  const modalidades = n ? await esportesDoEvento(n.evento_id) : [];

  return (
    <>
      <SeletorEvento
        base="/diretoria"
        atual={n?.slug ?? ""}
        eventos={numeros.map((x) => ({
          slug: x.slug,
          nome: x.nome,
          detalhe: x.publicado ? formatarData(x.data_evento) : "não publicado",
          selo: pendentesPorEvento.get(x.evento_id),
        }))}
      />

      {n && (
        <section className="mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="titulo text-2xl">{n.nome}</h2>
            <p className="text-sm text-apagado">
              {formatarData(n.data_evento)}
              {!n.publicado && " · não publicado"}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Numero rotulo="Pessoas inscritas" valor={n.pessoas} destaque />
            <Numero rotulo="Confirmadas" valor={n.pessoas_confirmadas} cor="text-ok" />
            <Numero rotulo="Aguardando pagamento" valor={n.aguardando} />
            <Numero rotulo="Em análise" valor={n.em_analise} cor="text-laranja-escuro" />
            <Numero rotulo="Igrejas" valor={n.igrejas} />
            <Numero rotulo="Recusadas" valor={n.recusadas} cor={n.recusadas > 0 ? "text-ruim" : undefined} />
            <Numero rotulo="Recebido" texto={formatarReais(n.recebido_centavos)} cor="text-ok" />
            <Numero rotulo="A receber" texto={formatarReais(n.a_receber_centavos)} />
          </div>
        </section>
      )}

      {igrejasDoEvento.length > 0 && (
        <section className="mb-8">
          <h2 className="titulo text-xl">Pessoas por igreja</h2>
          <ul className="cartao mt-3 divide-y divide-linha">
            {igrejasDoEvento.map((i) => (
              <li key={i.evento_id + i.igreja} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 truncate text-tinta">{i.igreja}</span>
                <span className="shrink-0 font-semibold text-apagado">{i.pessoas}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modalidades.length > 0 && (
        <section className="mb-8">
          <h2 className="titulo text-xl">Ocupação por modalidade</h2>
          <ul className="cartao mt-3 divide-y divide-linha">
            {modalidades.map((m) => {
              const pct = m.vagas > 0 ? Math.round((m.ocupadas / m.vagas) * 100) : 0;
              return (
                <li key={m.esporte_id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/diretoria/modalidades/${m.esporte_id}`} className="font-semibold text-tinta hover:underline">
                      {m.nome}{" "}
                      <span className="font-normal text-apagado">· {ROTULO_TURNO[m.turno]}</span>
                    </Link>
                    <span className={m.restantes === 0 ? "text-ruim" : "text-apagado"}>
                      {m.ocupadas}/{m.vagas}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-linha">
                    <div
                      className={`h-full ${m.restantes === 0 ? "bg-ruim" : "bg-laranja"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Exportar eventos={eventos.map((e) => ({ slug: e.slug, nome: e.nome }))} />

      <section className="mt-8">
        <h2 className="titulo text-xl">
          Comprovantes para conferir
          {comLink.length > 0 && <span className="text-apagado"> · {comLink.length}</span>}
        </h2>

        <div className="mt-3 space-y-5">
          {comLink.length === 0 ? (
            <div className="cartao flex items-center gap-4 p-6">
              <img src="/juca/joia.webp" alt="" className="w-16" />
              <p className="text-apagado">
                {todosPendentes.length > 0
                  ? "Nada para validar neste evento. O número ao lado de cada evento, lá em cima, mostra onde tem fila."
                  : "Fila limpa. Nada para validar agora."}
              </p>
            </div>
          ) : (
            comLink.map((c) => (
              <CartaoValidacao
                key={c.id}
                codigo={c.inscricoes.codigo}
                evento={c.inscricoes.eventos.nome}
                data={formatarData(c.enviado_em.slice(0, 10))}
                valor={formatarReais(c.inscricoes.valor_centavos)}
                parcela={c.parcela}
                parcelas={c.inscricoes.parcelas}
                url={c.url}
                pessoas={c.inscricoes.inscritos.map((p) => ({
                  nome: p.nome,
                  cpf: formatarCPF(p.cpf),
                  igreja: p.igreja,
                }))}
              />
            ))
          )}
        </div>
      </section>
    </>
  );
}

function Numero({
  rotulo,
  valor,
  texto,
  cor,
  destaque,
}: {
  rotulo: string;
  valor?: number;
  texto?: string;
  cor?: string;
  destaque?: boolean;
}) {
  return (
    <div className={`cartao p-4 ${destaque ? "bg-areia/60" : ""}`}>
      <p className={`titulo text-2xl ${cor ?? "text-tinta"}`}>{texto ?? valor ?? 0}</p>
      <p className="mt-0.5 text-xs text-apagado">{rotulo}</p>
    </div>
  );
}
