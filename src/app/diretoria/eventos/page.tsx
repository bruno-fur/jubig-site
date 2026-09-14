import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { situacaoInscricoes, type SituacaoInscricoes } from "@/lib/eventos";
import { dataHoraBrasilia } from "@/components/ChamadaEvento";
import { formatarData, formatarReais } from "@/lib/validacao";
import { ROTULO_TIPO, type Evento } from "@/tipos/db";

export const metadata: Metadata = { title: "Eventos", robots: { index: false } };
export const dynamic = "force-dynamic";

const COR: Record<SituacaoInscricoes, string> = {
  sem_inscricao: "bg-ok/10 text-ok",
  em_breve: "bg-laranja/10 text-laranja-escuro",
  agendada: "bg-laranja/10 text-laranja-escuro",
  abertas: "bg-ok/10 text-ok",
  encerradas: "bg-tinta/10 text-apagado",
};

function rotulo(e: Evento, s: SituacaoInscricoes) {
  switch (s) {
    case "sem_inscricao":
      return "Entrada franca";
    case "em_breve":
      return "Inscrições em breve";
    case "agendada":
      return `Abrem ${dataHoraBrasilia(e.inscricoes_de!)}`;
    case "abertas":
      return "Inscrições abertas";
    default:
      return "Inscrições encerradas";
  }
}

/** Todos os eventos, publicados ou não. Criar e editar sem abrir o SQL Editor. */
export default async function Eventos() {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ data: eventos }, { data: painel }] = await Promise.all([
    supabase.from("eventos").select("*").order("data_evento", { ascending: false }),
    supabase.from("painel_evento").select("evento_id, pessoas"),
  ]);

  const pessoas = new Map((painel ?? []).map((p) => [p.evento_id as string, p.pessoas as number]));
  const lista = (eventos ?? []) as Evento[];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-apagado">
          Crie o evento como rascunho, confira tudo e publique quando o PIX estiver testado.
        </p>
        <Link href="/diretoria/eventos/novo" className="botao-primario">
          + Novo evento
        </Link>
      </div>

      <ul className="space-y-3">
        {lista.map((e) => {
          const s = situacaoInscricoes(e);
          return (
            <li key={e.id} className="cartao flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="titulo text-lg">{e.nome}</span>
                  <span className="rounded-full bg-areia px-2 py-0.5 text-[11px] font-semibold text-apagado">
                    {ROTULO_TIPO[e.tipo]}
                  </span>
                </p>
                <p className="text-sm text-apagado">
                  {formatarData(e.data_evento)}
                  {e.data_fim && e.data_fim !== e.data_evento && ` a ${formatarData(e.data_fim)}`} · {e.cidade}
                  {e.tem_inscricao && e.valor_centavos > 0 && ` · ${formatarReais(e.valor_centavos)}`}
                </p>
                <p className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <span
                    className={`rounded-full px-2 py-0.5 ${e.publicado ? "bg-ok/10 text-ok" : "bg-ruim/10 text-ruim"}`}
                  >
                    {e.publicado ? "Publicado" : "Rascunho — não aparece no site"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${COR[s]}`}>{rotulo(e, s)}</span>
                  {e.tem_inscricao && (
                    <span className="rounded-full bg-areia px-2 py-0.5 text-apagado">
                      {pessoas.get(e.id) ?? 0} inscritos
                    </span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 gap-3 text-sm">
                {e.publicado && (
                  <Link href={`/${e.slug}`} className="font-semibold text-apagado hover:underline">
                    Ver no site
                  </Link>
                )}
                <Link href={`/diretoria/eventos/${e.id}`} className="font-semibold text-laranja-escuro hover:underline">
                  Editar
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {lista.length === 0 && (
        <div className="cartao flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nenhum evento ainda. Comece pelo botão acima.</p>
        </div>
      )}
    </>
  );
}
