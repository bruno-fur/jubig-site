import Link from "next/link";
import { formatarData, formatarReais } from "@/lib/validacao";
import { ROTULO_TIPO, RESUMO_TIPO, type ItemAgenda } from "@/tipos/db";

/**
 * Agenda do ano, agrupada por mês.
 *
 * Lista, não grade de calendário: a maioria abre isso no celular, onde uma
 * grade de 7 colunas vira um amontoado ilegível — e a JUBIG faz alguns
 * eventos por ano, não alguns por semana. Agrupar por mês dá a mesma noção de
 * "o que vem" sem espremer nada.
 */
export function Calendario({ itens, hoje }: { itens: ItemAgenda[]; hoje: string }) {
  if (itens.length === 0) return null;

  const meses = agruparPorMes(itens);

  return (
    <ol className="mt-4 space-y-8">
      {meses.map(([mes, doMes]) => (
        <li key={mes}>
          <h3 className="titulo text-sm tracking-wide text-apagado uppercase">{mes}</h3>

          <ul className="mt-2 space-y-3">
            {doMes.map((e) => (
              <li key={e.id}>
                <ItemDaAgenda item={e} passou={fim(e) < hoje} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function ItemDaAgenda({ item, passou }: { item: ItemAgenda; passou: boolean }) {
  const [, mes, dia] = item.data_evento.split("-");

  return (
    <article className={`cartao flex gap-4 p-4 ${passou ? "opacity-60" : ""}`}>
      <div
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[10px] ${
          passou ? "bg-areia text-apagado" : "bg-laranja/10 text-laranja-escuro"
        }`}
        aria-hidden="true"
      >
        <span className="titulo text-xl leading-none">{dia}</span>
        <span className="text-[10px] tracking-wide uppercase">{MES_CURTO[Number(mes) - 1]}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/${item.slug}`} className="titulo text-lg hover:text-laranja-escuro">
            {item.nome}
          </Link>
          <span className="rounded-full bg-areia px-2 py-0.5 text-[11px] font-semibold text-apagado">
            {ROTULO_TIPO[item.tipo]}
          </span>
        </p>

        <p className="mt-0.5 text-sm text-apagado">
          {item.data_fim && item.data_fim !== item.data_evento
            ? `${formatarData(item.data_evento)} a ${formatarData(item.data_fim)}`
            : formatarData(item.data_evento)}
          {" · "}
          {item.igreja_nome ?? item.local_nome ?? item.cidade}
        </p>

        <p className="mt-1 text-sm text-tinta/80">
          {item.descricao ?? RESUMO_TIPO[item.tipo]}
        </p>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {passou ? (
            <span className="text-apagado">
              {item.pessoas > 0 ? `${item.pessoas} participantes` : "Já aconteceu"}
            </span>
          ) : item.tem_inscricao ? (
            <>
              <Link
                href={`/${item.slug}/inscricao`}
                className="font-semibold text-laranja-escuro hover:underline"
              >
                Inscrever
              </Link>
              {item.valor_centavos > 0 && (
                <span className="text-apagado">{formatarReais(item.valor_centavos)} por pessoa</span>
              )}
              {item.inscricoes_ate && (
                <span className="text-apagado">
                  até {formatarData(item.inscricoes_ate)}
                </span>
              )}
            </>
          ) : (
            // Tour não tem inscrição: a chamada é aparecer.
            <span className="font-semibold text-ok">Entrada franca, é só chegar</span>
          )}

          <Link href={`/${item.slug}`} className="text-apagado hover:text-tinta hover:underline">
            detalhes
          </Link>
        </p>
      </div>
    </article>
  );
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const MES_LONGO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** O último dia que o evento ocupa — é o que decide se já passou. */
const fim = (e: ItemAgenda) => e.data_fim ?? e.data_evento;

function agruparPorMes(itens: ItemAgenda[]): [string, ItemAgenda[]][] {
  const mapa = new Map<string, ItemAgenda[]>();

  for (const e of itens) {
    const [ano, mes] = e.data_evento.split("-");
    const chave = `${MES_LONGO[Number(mes) - 1]} de ${ano}`;
    mapa.set(chave, [...(mapa.get(chave) ?? []), e]);
  }
  return [...mapa.entries()];
}
