"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { EstadoJuca } from "./Juca";

type Contexto = {
  /** id do campo com foco — null quando o teclado está fechado */
  focado: string | null;
  focar: (id: string) => void;
  desfocar: (id: string) => void;
  /** estado do Juca do canto, quando nenhum campo está com foco */
  estadoGeral: EstadoJuca;
  falaGeral: string | undefined;
  definirGeral: (estado: EstadoJuca, fala?: string) => void;
};

const JucaContexto = createContext<Contexto | null>(null);

export function ProvedorJuca({ children }: { children: React.ReactNode }) {
  const [focado, setFocado] = useState<string | null>(null);
  const [geral, setGeral] = useState<{ estado: EstadoJuca; fala?: string }>({ estado: "ocioso" });

  const focar = useCallback((id: string) => setFocado(id), []);

  /*
   * Só limpa se o campo que saiu é o mesmo que estava marcado. Ao pular de um
   * campo para o outro, o blur do anterior chega depois do focus do seguinte —
   * sem essa conferência o Juca piscava entre o canto e o campo.
   */
  const desfocar = useCallback((id: string) => {
    setFocado((atual) => (atual === id ? null : atual));
  }, []);

  const definirGeral = useCallback(
    (estado: EstadoJuca, fala?: string) => setGeral({ estado, fala }),
    []
  );

  const valor = useMemo(
    () => ({ focado, focar, desfocar, estadoGeral: geral.estado, falaGeral: geral.fala, definirGeral }),
    [focado, focar, desfocar, geral, definirGeral]
  );

  return <JucaContexto.Provider value={valor}>{children}</JucaContexto.Provider>;
}

export function useJuca() {
  const ctx = useContext(JucaContexto);
  if (!ctx) throw new Error("useJuca precisa estar dentro de <ProvedorJuca>");
  return ctx;
}
