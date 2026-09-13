"use client";

import { useEffect, useState } from "react";

/**
 * Faixa de retorno de uma ação: deu certo ou deu errado.
 *
 * Erro não some sozinho — quem errou precisa ler com calma. Sucesso some em
 * alguns segundos, porque confirmar duas vezes a mesma coisa vira poluição.
 *
 * `role` muda conforme o tipo: "alert" interrompe o leitor de tela, e isso só
 * se justifica quando algo deu errado.
 */
export function Recado({
  erro,
  sucesso,
  aoFechar,
}: {
  erro?: string | null;
  sucesso?: string | null;
  aoFechar?: () => void;
}) {
  const texto = erro ?? sucesso;

  /*
   * Guarda QUAL texto já sumiu, em vez de um booleano de visibilidade.
   *
   * Com booleano seria preciso reabri-lo num efeito a cada mensagem nova, e
   * setState dentro de efeito dispara render em cascata. Comparando o texto,
   * uma mensagem diferente já nasce visível sem efeito nenhum.
   */
  const [dispensado, setDispensado] = useState<string | null>(null);

  useEffect(() => {
    if (!sucesso || erro) return;
    const t = setTimeout(() => {
      setDispensado(sucesso);
      aoFechar?.();
    }, 4000);
    return () => clearTimeout(t);
  }, [sucesso, erro, aoFechar]);

  if (!texto || texto === dispensado) return null;

  return (
    <p
      role={erro ? "alert" : "status"}
      className={`bolha flex items-start gap-2 rounded-[10px] px-4 py-3 text-sm font-medium ${
        erro ? "bg-ruim/10 text-ruim" : "bg-ok/10 text-ok"
      }`}
    >
      <img
        src={erro ? "/juca/nao.webp" : "/juca/joia.webp"}
        alt=""
        className="-my-1 h-8 w-8 shrink-0 object-contain"
      />
      <span className="min-w-0 flex-1 self-center">{texto}</span>
    </p>
  );
}
