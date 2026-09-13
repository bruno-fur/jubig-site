/**
 * Rodinha de espera. `currentColor` para herdar a cor do botão onde estiver.
 *
 * `aria-hidden` de propósito: quem anuncia a espera é o `aria-busy` do botão
 * ou o `role="status"` em volta. Leitor de tela lendo "carregando" duas vezes
 * atrapalha mais do que ajuda.
 */
export function Girando({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 animate-spin ${className}`}
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
