"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Girando } from "./Girando";

/**
 * Precisa ser um componente à parte: `useLinkStatus` só funciona dentro de um
 * `<Link>`, lendo a navegação daquele link específico.
 */
function Rodinha() {
  const { pending } = useLinkStatus();
  return pending ? <Girando className="h-3.5 w-3.5" /> : null;
}

/**
 * Link de navegação que mostra que está indo.
 *
 * O `loading.tsx` da rota de destino só aparece depois que a navegação começa
 * a valer; entre o toque e esse instante há um vão em que nada muda na tela.
 * No celular, esse vão é onde a pessoa toca de novo.
 */
export function LinkNav({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
      <Rodinha />
    </Link>
  );
}
