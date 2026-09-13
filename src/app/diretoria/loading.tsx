import { Bloco, CartaoEsqueleto } from "@/components/Esqueleto";

/**
 * O painel é a tela mais lenta: números, fila de comprovantes e uma signed URL
 * por comprovante, todas geradas no servidor.
 */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-4xl px-4 py-10">
      <span className="sr-only">Carregando o painel</span>
      <Bloco className="h-8 w-40" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="cartao p-4">
            <Bloco className="h-7 w-16" />
            <Bloco className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-5">
        <CartaoEsqueleto linhas={4} />
        <CartaoEsqueleto linhas={4} />
      </div>
    </div>
  );
}
