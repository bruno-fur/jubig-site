/**
 * Blocos cinzas no formato do conteúdo que está chegando.
 *
 * Servem de `loading.tsx`: sem eles, o Next segura a página antiga na tela até
 * o servidor responder, e no celular da caravana — 4G no meio do ginásio —
 * isso são vários segundos em que tocar de novo parece a única saída.
 *
 * O formato imita o que vai aparecer para a página não pular quando os dados
 * chegarem.
 */

export function Bloco({ className = "" }: { className?: string }) {
  return <div className={`esqueleto rounded-[10px] bg-linha/60 ${className}`} aria-hidden="true" />;
}

export function CartaoEsqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="cartao p-5">
      <Bloco className="h-5 w-2/5" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: linhas }).map((_, i) => (
          <Bloco key={i} className={`h-4 ${i === linhas - 1 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Casca de página: título, subtítulo e cartões.
 * `rotulo` vai para leitor de tela — o resto é `aria-hidden`.
 */
export function PaginaEsqueleto({
  rotulo = "Carregando",
  cartoes = 2,
  comTitulo = true,
}: {
  rotulo?: string;
  cartoes?: number;
  comTitulo?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-2xl px-4 py-10">
      <span className="sr-only">{rotulo}</span>

      {comTitulo && (
        <>
          <Bloco className="h-8 w-52" />
          <Bloco className="mt-3 h-4 w-72 max-w-full" />
        </>
      )}

      <div className="mt-6 space-y-5">
        {Array.from({ length: cartoes }).map((_, i) => (
          <CartaoEsqueleto key={i} />
        ))}
      </div>
    </div>
  );
}
