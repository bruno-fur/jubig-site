import Link from "next/link";

export type OpcaoEvento = {
  slug: string;
  nome: string;
  /** Texto miúdo depois do nome: data, tipo, "não publicado". */
  detalhe?: string;
  /** Número em destaque, ex.: comprovantes esperando. */
  selo?: number;
};

/**
 * Escolha do evento nas telas da diretoria, por link (`?evento=slug`).
 *
 * Link e não estado: o endereço guarda a escolha, então recarregar, voltar ou
 * mandar o link para outra pessoa da diretoria abre no mesmo evento.
 */
export function SeletorEvento({
  eventos,
  atual,
  base,
}: {
  eventos: OpcaoEvento[];
  atual: string;
  base: string;
}) {
  if (eventos.length <= 1) return null;
  return (
    <nav aria-label="Evento" className="mb-6 flex flex-wrap gap-2">
      {eventos.map((e) => {
        const ativo = e.slug === atual;
        return (
          <Link
            key={e.slug}
            href={`${base}?evento=${e.slug}`}
            aria-current={ativo ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition ${
              ativo ? "border-laranja bg-laranja text-white" : "border-linha bg-white text-tinta hover:bg-areia"
            }`}
          >
            <span>
              {e.nome}
              {e.detalhe && <span className="font-normal opacity-75"> · {e.detalhe}</span>}
            </span>
            {!!e.selo && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  ativo ? "bg-white text-laranja-escuro" : "bg-laranja text-white"
                }`}
                title="Comprovantes esperando conferência"
              >
                {e.selo}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Evento padrão: o próximo que ainda não terminou; senão o mais recente. */
export function escolherEvento<T extends { slug: string; data_evento: string; data_fim?: string | null }>(
  eventos: T[],
  slug: string | undefined,
  preferir: (e: T) => boolean = () => true
): T | undefined {
  const hoje = new Date().toISOString().slice(0, 10);
  const futuros = eventos.filter((e) => (e.data_fim ?? e.data_evento) >= hoje);
  return (
    eventos.find((e) => e.slug === slug) ??
    futuros.find(preferir) ??
    futuros[0] ??
    eventos[eventos.length - 1]
  );
}
