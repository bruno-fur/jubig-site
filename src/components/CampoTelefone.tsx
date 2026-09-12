"use client";

import { useId } from "react";
import type { CountryCode } from "libphonenumber-js";
import { AncoraJuca } from "./juca/Ancora";
import { useJuca } from "./juca/contexto";
import { mascaraTelefone, PAISES } from "@/lib/mascaras";
import { paraE164 } from "@/lib/validacao";

type Props = {
  rotulo?: string;
  /** texto digitado, já com a máscara do país escolhido */
  valor: string;
  pais: CountryCode;
  aoMudar: (valor: string, pais: CountryCode, e164: string | null) => void;
  erro?: string | null;
  obrigatorio?: boolean;
};

/**
 * Telefone internacional. Brasil é o padrão; Paraguai, Argentina e Uruguai vêm
 * logo depois porque a JUBIG pega a tríplice fronteira.
 *
 * O que vai para a API é sempre E.164 (+5545999990000) — a máscara é só tela.
 */
export function CampoTelefone({
  rotulo = "Telefone / WhatsApp",
  valor,
  pais,
  aoMudar,
  erro,
  obrigatorio,
}: Props) {
  const id = useId();
  const { focar, desfocar } = useJuca();

  function mudar(texto: string, novoPais: CountryCode) {
    const formatado = mascaraTelefone(texto, novoPais);
    aoMudar(formatado, novoPais, paraE164(formatado, novoPais));
  }

  const preenchido = valor.replace(/\D/g, "").length;
  const estado = erro ? "invalido" : preenchido === 0 ? "digitando" : paraE164(valor, pais) ? "valido" : "incompleto";

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-tinta">
        {rotulo}
        {obrigatorio && <span className="ml-1 text-laranja">*</span>}
      </label>

      <AncoraJuca
        campoId={id}
        estado={estado}
        fala={estado === "valido" ? "Número certinho!" : "Com DDD, sem o zero na frente."}
        erro={erro}
      />

      <div
        className={`flex overflow-hidden rounded-[10px] border-2 bg-white ${
          erro ? "border-ruim" : "border-linha focus-within:border-laranja"
        }`}
      >
        <select
          aria-label="País"
          value={pais}
          onChange={(e) => mudar(valor, e.target.value as CountryCode)}
          className="border-r border-linha bg-areia px-2 py-3 text-sm font-medium text-tinta focus:outline-none"
        >
          {PAISES.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.bandeira} {p.ddi}
            </option>
          ))}
        </select>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={valor}
          aria-invalid={Boolean(erro)}
          onFocus={() => focar(id)}
          onBlur={() => desfocar(id)}
          onChange={(e) => mudar(e.target.value, pais)}
          placeholder={pais === "BR" ? "(45) 99999-0000" : ""}
          className="min-w-0 flex-1 px-3 py-3 text-tinta placeholder:text-apagado/60 focus:outline-none"
        />
      </div>

      {erro && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-ruim">
          {erro}
        </p>
      )}
    </div>
  );
}
