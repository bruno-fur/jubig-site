"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function MenuConta({ email, nome }: { email: string; nome: string | null }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const iniciais = (nome ?? email)
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-tinta text-xs font-bold text-creme"
      >
        {iniciais || "?"}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-[16px] border border-linha bg-white shadow-lg"
        >
          <div className="border-b border-linha px-4 py-3">
            <p className="truncate text-sm font-semibold text-tinta">{nome ?? "Minha conta"}</p>
            <p className="truncate text-xs text-apagado">{email}</p>
          </div>
          <Link
            href="/meu-perfil"
            role="menuitem"
            onClick={() => setAberto(false)}
            className="block px-4 py-3 text-sm font-medium text-tinta hover:bg-areia"
          >
            Meu perfil
          </Link>
          <Link
            href="/minhas-inscricoes"
            role="menuitem"
            onClick={() => setAberto(false)}
            className="block border-b border-linha px-4 py-3 text-sm font-medium text-tinta hover:bg-areia"
          >
            Minhas inscrições
          </Link>
          <form action="/sair" method="post">
            <button
              type="submit"
              className="w-full px-4 py-3 text-left text-sm font-medium text-ruim hover:bg-areia"
            >
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
