"use client";

import { useState } from "react";
import { Girando } from "./Girando";
import { Recado } from "./Recado";
import { useAcao } from "@/lib/useAcao";

type Pessoa = { nome: string; cpf: string; igreja: string };

const MENSAGEM: Record<string, string> = {
  motivo_obrigatorio: "Escreva o motivo da recusa.",
  nada_pendente: "Esse comprovante já foi avaliado por outra pessoa.",
  nao_encontrada: "Inscrição não encontrada.",
  sem_permissao: "Você não tem acesso para validar.",
};

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
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoCurto, setMotivoCurto] = useState(false);
  const acao = useAcao({ mensagens: MENSAGEM });

  async function decidir(aprovado: boolean) {
    setMotivoCurto(false);
    if (!aprovado && motivo.trim().length < 5) {
      setMotivoCurto(true);
      return;
    }
    await acao.json("/api/admin/validar", "POST", { codigo, aprovado, motivo: motivo.trim() });
  }

  return (
    <article className="cartao overflow-hidden" aria-busy={acao.ocupado}>
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
                loading="lazy"
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
              onChange={(e) => {
                setMotivo(e.target.value);
                setMotivoCurto(false);
              }}
              rows={2}
              autoFocus
              placeholder="Ex.: o valor do PIX está menor que o da inscrição."
              className={`campo-texto ${motivoCurto ? "border-ruim" : ""}`}
            />
            <p className={`mt-1 text-xs ${motivoCurto ? "text-ruim" : "text-apagado"}`}>
              {motivoCurto
                ? "Escreva o motivo — ele vai inteiro no e-mail para a pessoa."
                : "Este texto vai inteiro no e-mail para a pessoa."}
            </p>
          </div>
        )}

        {acao.erro && (
          <div className="mb-3">
            <Recado erro={acao.erro} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => decidir(true)}
            disabled={acao.ocupado || recusando}
            className="botao-primario flex-1 bg-ok hover:bg-ok/85"
          >
            {acao.ocupado && !recusando ? (
              <>
                <Girando />
                {acao.atualizando ? "Atualizando..." : "Salvando..."}
              </>
            ) : (
              "Aprovar"
            )}
          </button>

          {recusando ? (
            <>
              <button
                type="button"
                onClick={() => decidir(false)}
                disabled={acao.ocupado}
                className="botao-primario flex-1 bg-ruim hover:bg-ruim/85"
              >
                {acao.ocupado ? (
                  <>
                    <Girando />
                    Salvando...
                  </>
                ) : (
                  "Confirmar recusa"
                )}
              </button>
              <button
                type="button"
                disabled={acao.ocupado}
                onClick={() => {
                  setRecusando(false);
                  setMotivoCurto(false);
                  acao.limpar();
                }}
                className="botao-secundario"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={acao.ocupado}
              onClick={() => setRecusando(true)}
              className="botao-secundario"
            >
              Recusar
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
