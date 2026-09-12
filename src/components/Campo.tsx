"use client";

import { useId } from "react";
import type { EstadoJuca } from "./juca/Juca";
import { AncoraJuca } from "./juca/Ancora";
import { useJuca } from "./juca/contexto";
import { mascaraCPF, mascaraData } from "@/lib/mascaras";

type Tipo = "texto" | "cpf" | "data" | "email" | "senha";

type Props = {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  tipo?: Tipo;
  erro?: string | null;
  dica?: string;
  /** Estado do Juca enquanto este campo está em uso. */
  estado?: EstadoJuca;
  fala?: string;
  placeholder?: string;
  autoComplete?: string;
  obrigatorio?: boolean;
  nome?: string;
};

const MASCARA: Partial<Record<Tipo, (v: string) => string>> = {
  cpf: mascaraCPF,
  data: mascaraData,
};

const TECLADO: Partial<Record<Tipo, "numeric" | "email">> = {
  cpf: "numeric",
  data: "numeric",
  email: "email",
};

export function Campo({
  rotulo,
  valor,
  aoMudar,
  tipo = "texto",
  erro,
  dica,
  estado = "digitando",
  fala,
  placeholder,
  autoComplete,
  obrigatorio,
  nome,
}: Props) {
  const id = useId();
  const { focar, desfocar } = useJuca();
  const mascara = MASCARA[tipo];

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-tinta">
        {rotulo}
        {obrigatorio && <span className="ml-1 text-laranja">*</span>}
      </label>

      <AncoraJuca campoId={id} estado={estado} fala={fala} erro={erro} />

      <input
        id={id}
        name={nome}
        type={tipo === "senha" ? "password" : tipo === "email" ? "email" : "text"}
        inputMode={TECLADO[tipo]}
        value={valor}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
        onFocus={() => focar(id)}
        onBlur={() => desfocar(id)}
        onChange={(e) => aoMudar(mascara ? mascara(e.target.value) : e.target.value)}
        className={`campo-texto ${erro ? "border-ruim focus:border-ruim" : ""}`}
      />

      {erro ? (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-sm font-medium text-ruim">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="mt-1.5 text-sm text-apagado">
          {dica}
        </p>
      ) : null}
    </div>
  );
}
