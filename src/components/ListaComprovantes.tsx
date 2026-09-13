import type { ComprovanteComLink } from "@/lib/comprovantes";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Histórico de comprovantes — continua abrindo depois de aprovado. */
export function ListaComprovantes({
  comprovantes,
  parcelas,
}: {
  comprovantes: ComprovanteComLink[];
  parcelas: number;
}) {
  if (comprovantes.length === 0) {
    return <p className="text-sm text-apagado">Nenhum comprovante enviado ainda.</p>;
  }

  return (
    <ul className="divide-y divide-linha">
      {comprovantes.map((c) => {
        const situacao =
          c.aprovado === true
            ? { texto: "Aprovado", cor: "bg-ok/10 text-ok" }
            : c.aprovado === false
              ? { texto: "Recusado", cor: "bg-ruim/10 text-ruim" }
              : { texto: "Em análise", cor: "bg-areia text-apagado" };

        return (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-tinta">
                {parcelas > 1 ? `Parcela ${c.parcela}` : "Comprovante"}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${situacao.cor}`}>
                  {situacao.texto}
                </span>
              </p>
              <p className="text-xs text-apagado">Enviado em {quando(c.enviado_em)}</p>
              {c.avaliado_em && (
                <p className="text-xs text-apagado">
                  {c.aprovado ? "Aprovado" : "Recusado"} em {quando(c.avaliado_em)}
                  {c.avaliadoPorNome && ` por ${c.avaliadoPorNome}`}
                </p>
              )}
              {c.aprovado === false && c.motivo && (
                <p className="mt-1 text-xs text-ruim">Motivo: {c.motivo}</p>
              )}
            </div>

            {c.url ? (
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="botao-secundario shrink-0 px-3 py-1.5 text-sm"
              >
                {c.ehPdf ? "Abrir PDF" : "Ver imagem"}
              </a>
            ) : (
              <span className="text-xs text-apagado">arquivo indisponível</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
