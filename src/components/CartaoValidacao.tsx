"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pessoa = { nome: string; cpf: string; igreja: string };

export function CartaoValidacao({
  codigo,
  evento,
  data,
  valor,
  parcela,
  parcelas,
  url,
  pessoas,
}: {
  codigo: string;
  evento: string;
  data: string;
  valor: string;
  parcela: number;
  parcelas: number;
  url: string | null;
  pessoas: Pessoa[];
}) {
  const router = useRouter();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function decidir(aprovado: boolean) {
    setErro(null);
    if (!aprovado && motivo.trim().length < 5) {
      setErro("Escreva o motivo — ele vai no e-mail para a pessoa.");
      return;
    }

    setEnviando(true);
    const r = await fetch("/api/admin/validar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codigo, aprovado, motivo: motivo.trim() }),
    });
    setEnviando(false);

    if (!r.ok) {
      setErro("Não deu para salvar. Tente de novo.");
      return;
    }
    router.refresh();
  }

  return (
    <article className="cartao overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-linha p-4">
        <div>
          <p className="titulo text-lg">{codigo}</p>
          <p className="text-sm text-apagado">
            {evento} · enviado em {data}
          </p>
        </div>
        <p className="text-right">
          <span className="titulo block text-lg">{valor}</span>
          {parcelas > 1 && (
            <span className="text-sm text-apagado">
              parcela {parcela} de {parcelas}
            </span>
          )}
        </p>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-apagado">
            {pessoas.length} {pessoas.length === 1 ? "pessoa" : "pessoas"}
          </p>
          <ul className="space-y-2 text-sm">
            {pessoas.map((p) => (
              <li key={p.cpf}>
                <span className="block font-semibold text-tinta">{p.nome}</span>
                <span className="block text-apagado">
                  {p.cpf} · {p.igreja}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-apagado">Comprovante</p>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="block">
              {/* PDF não renderiza em <img>; o link abre nos dois casos. */}
              <img
                src={url}
                alt={`Comprovante da inscrição ${codigo}`}
                className="max-h-56 w-full rounded-[10px] border border-linha bg-areia object-contain"
              />
              <span className="mt-1 block text-sm font-semibold text-laranja-escuro">
                Abrir em tamanho real
              </span>
            </a>
          ) : (
            <p className="rounded-[10px] bg-areia px-3 py-2 text-sm text-apagado">
              Não deu para gerar o link do arquivo.
            </p>
          )}
        </div>
      </div>

      <footer className="border-t border-linha bg-areia/40 p-4">
        {recusando && (
          <div className="mb-3">
            <label className="mb-1.5 block text-sm font-semibold text-tinta">
              Motivo da recusa <span className="text-laranja">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ex.: o valor do PIX está menor que o da inscrição."
              className="campo-texto"
            />
            <p className="mt-1 text-xs text-apagado">
              Este texto vai inteiro no e-mail para a pessoa.
            </p>
          </div>
        )}

        {erro && (
          <p role="alert" className="mb-3 text-sm font-medium text-ruim">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => decidir(true)}
            disabled={enviando || recusando}
            className="botao-primario flex-1 bg-ok hover:bg-ok/85"
          >
            {enviando ? "Salvando..." : "Aprovar"}
          </button>

          {recusando ? (
            <>
              <button
                type="button"
                onClick={() => decidir(false)}
                disabled={enviando}
                className="botao-primario flex-1 bg-ruim hover:bg-ruim/85"
              >
                Confirmar recusa
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecusando(false);
                  setErro(null);
                }}
                className="botao-secundario"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setRecusando(true)} className="botao-secundario">
              Recusar
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
