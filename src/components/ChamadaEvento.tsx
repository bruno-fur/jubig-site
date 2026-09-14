import Link from "next/link";
import { Contagem } from "@/components/Contagem";
import { eventoJaComecou, inicioDoEvento, situacaoInscricoes } from "@/lib/eventos";
import { formatarData, formatarReais } from "@/lib/validacao";
import type { Evento } from "@/tipos/db";

/** "20/09 às 19:00", sempre no horário de Brasília — o servidor roda em UTC. */
export function dataHoraBrasilia(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

/**
 * Botão de inscrição + contagens do evento, do jeito que a situação pede.
 *
 * Uma peça só para a home e a página do evento: se cada uma decidisse sozinha,
 * uma mostraria "Inscrever" enquanto a outra ainda dizia "em breve".
 *
 *   em breve   → aviso, sem data
 *   agendada   → contagem até a abertura; ao zerar, o botão aparece sozinho
 *   abertas    → botão, prazo e contagem até o dia do evento
 *   encerradas → aviso
 *   tour       → entrada franca
 */
export function ChamadaEvento({
  evento,
  restantes,
  detalhes = false,
}: {
  evento: Evento;
  restantes: number | null;
  /** Mostra o link "Ver detalhes" — na home, que não é a página do evento. */
  detalhes?: boolean;
}) {
  const situacao = situacaoInscricoes(evento);
  const inicio = inicioDoEvento(evento);
  const eventoNoFuturo = !eventoJaComecou(evento);
  const poucas = situacao === "abertas" && restantes !== null && restantes > 0 && restantes <= 20;
  const esgotado = situacao === "abertas" && restantes === 0;

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {situacao === "abertas" && !esgotado && (
          <Link href={`/${evento.slug}/inscricao`} className="botao-primario">
            Inscrever
            {evento.valor_centavos > 0 && ` — ${formatarReais(evento.valor_centavos)} por pessoa`}
          </Link>
        )}
        {esgotado && <Selo cor="ruim">Vagas esgotadas</Selo>}
        {situacao === "em_breve" && <Selo cor="laranja">Inscrições em breve</Selo>}
        {situacao === "agendada" && evento.inscricoes_de && (
          <Selo cor="laranja">Inscrições abrem {dataHoraBrasilia(evento.inscricoes_de)}</Selo>
        )}
        {situacao === "encerradas" && <Selo cor="apagado">Inscrições encerradas</Selo>}
        {situacao === "sem_inscricao" && <Selo cor="ok">Entrada franca, é só chegar</Selo>}

        {detalhes && (
          <Link href={`/${evento.slug}`} className="botao-secundario">
            Ver detalhes
          </Link>
        )}
      </div>

      {poucas && (
        <p className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-sm font-semibold text-laranja-escuro">
          <img src="/juca/susto.webp" alt="" className="h-7 w-7 object-contain" />
          Restam {restantes} vagas
        </p>
      )}

      {situacao === "abertas" && evento.inscricoes_ate && (
        <p className="text-sm text-apagado">Inscrições até {formatarData(evento.inscricoes_ate)}.</p>
      )}

      {situacao === "agendada" && evento.inscricoes_de ? (
        <Contagem alvo={evento.inscricoes_de} titulo="As inscrições abrem em" recarregarAoZerar />
      ) : (
        eventoNoFuturo && situacao !== "encerradas" && (
          <Contagem alvo={inicio} titulo={`Falta pouco para o ${evento.nome}`} />
        )
      )}
    </div>
  );
}

const CORES = {
  laranja: "bg-laranja/10 text-laranja-escuro",
  ok: "bg-ok/10 text-ok",
  ruim: "bg-ruim/10 text-ruim",
  apagado: "bg-tinta/10 text-apagado",
};

function Selo({ cor, children }: { cor: keyof typeof CORES; children: React.ReactNode }) {
  return <span className={`rounded-[10px] px-5 py-3 font-semibold ${CORES[cor]}`}>{children}</span>;
}
