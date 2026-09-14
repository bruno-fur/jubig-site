"use client";

import { useState } from "react";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";

const MENSAGEM: Record<string, string> = {
  token_invalido:
    "A Meta recusou essa chave. Gere de novo em developers.facebook.com e cole a chave inteira, sem espaço.",
  falha_instagram: "O Instagram não respondeu agora. Tente de novo em alguns minutos.",
  pedido_invalido: "Cole a chave de acesso inteira.",
  sem_permissao: "Só administrador conecta o Instagram.",
};

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "ainda não";

/**
 * Conexão com o Instagram, pela tela.
 *
 * A chave colada vai direto para o servidor e nunca volta: nem esta tela a
 * mostra de novo. Para trocar, cola outra por cima.
 */
export function ConexaoInstagram({
  conectado,
  usuario,
  atualizadoEm,
  tokenExpiraEm,
  erro,
  previa,
}: {
  conectado: boolean;
  usuario: string | null;
  atualizadoEm: string | null;
  tokenExpiraEm: string | null;
  erro: string | null;
  previa: { id: string; imagem: string; link: string }[];
}) {
  const acao = useAcao({ mensagens: MENSAGEM });
  const [token, setToken] = useState("");
  const [trocando, setTrocando] = useState(!conectado);
  const [desconectando, setDesconectando] = useState(false);

  async function conectar(e: React.FormEvent) {
    e.preventDefault();
    const { ok } = await acao.json("/api/admin/instagram", "POST", { acao: "conectar", token });
    if (ok) {
      setToken("");
      setTrocando(false);
    }
  }

  return (
    <section className="cartao space-y-4 p-5">
      <div>
        <h2 className="titulo text-xl">Instagram na home</h2>
        <p className="text-sm text-apagado">
          As 6 postagens mais recentes aparecem na home e se atualizam sozinhas a cada hora. Grátis, pela API
          oficial da Meta.
        </p>
      </div>

      {conectado && (
        <div className="rounded-[10px] bg-areia p-4 text-sm">
          <p className="font-semibold text-ok">Conectado como @{usuario}</p>
          <p className="mt-1 text-apagado">
            Última atualização: {quando(atualizadoEm)} · a chave se renova sozinha
            {tokenExpiraEm && ` (vale até ${quando(tokenExpiraEm)})`}.
          </p>
          {erro && (
            <p className="mt-2 font-medium text-ruim">
              Último erro do Instagram: {erro}. Se continuar, gere uma chave nova e cole abaixo.
            </p>
          )}

          {previa.length > 0 && (
            <ul className="mt-3 grid grid-cols-6 gap-1.5">
              {previa.map((p) => (
                <li key={p.id}>
                  <a href={p.link} target="_blank" rel="noreferrer">
                    <img
                      src={p.imagem}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="aspect-square w-full rounded-[6px] object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={acao.ocupado}
              onClick={() => acao.json("/api/admin/instagram", "POST", { acao: "atualizar" })}
              className="botao-secundario"
            >
              {acao.ocupado ? <Girando /> : null}
              Atualizar agora
            </button>
            {!trocando && (
              <button type="button" onClick={() => setTrocando(true)} className="font-semibold text-laranja-escuro hover:underline">
                Trocar chave
              </button>
            )}
            {desconectando ? (
              <>
                <button
                  type="button"
                  disabled={acao.ocupado}
                  onClick={async () => {
                    await acao.executar("/api/admin/instagram", { method: "DELETE" });
                    setDesconectando(false);
                    setTrocando(true);
                  }}
                  className="font-semibold text-ruim hover:underline"
                >
                  Confirmar: tirar da home
                </button>
                <button type="button" onClick={() => setDesconectando(false)} className="text-apagado hover:underline">
                  Voltar
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setDesconectando(true)} className="font-semibold text-ruim hover:underline">
                Desconectar
              </button>
            )}
          </div>
        </div>
      )}

      {acao.erro && <Recado erro={acao.erro} aoFechar={acao.limpar} />}

      {trocando && (
        <>
          <details className="rounded-[10px] border border-linha p-4 text-sm" open={!conectado}>
            <summary className="cursor-pointer font-semibold text-tinta">Como conseguir a chave (uns 20 minutos, uma vez só)</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-tinta/90">
              <li>
                No app do Instagram, em <strong>@jubigoficial</strong>: Configurações → Tipo de conta e ferramentas →
                <strong> Mudar para conta profissional</strong> (Criador de conteúdo ou Empresa). É grátis e não muda
                nada para quem segue.
              </li>
              <li>
                No computador, entre em <strong>developers.facebook.com</strong> com um Facebook, clique em
                <strong> Criar app</strong> e escolha o caso de uso de <strong>Instagram</strong> (&quot;Gerenciar
                mensagens e conteúdo no Instagram&quot;).
              </li>
              <li>
                No app criado, abra <strong>Instagram → Configuração da API com login do Instagram</strong>. Em
                &quot;Gerar tokens de acesso&quot;, clique em <strong>Adicionar conta</strong> e entre com o
                @jubigoficial. Se pedir, aceite o convite de testador no Instagram (Configurações → Apps e sites).
              </li>
              <li>
                Clique em <strong>Gerar token</strong> ao lado da conta, copie a chave inteira e cole aqui embaixo.
                O app pode ficar em modo de desenvolvimento: não precisa mandar para análise da Meta.
              </li>
            </ol>
          </details>

          <form onSubmit={conectar} className="space-y-2">
            <label htmlFor="token-instagram" className="block text-sm font-semibold text-tinta">
              Chave de acesso do Instagram
            </label>
            <textarea
              id="token-instagram"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              rows={3}
              placeholder="IGAA..."
              autoComplete="off"
              spellCheck={false}
              className="campo-texto font-mono text-xs"
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={acao.ocupado || token.length < 20} className="botao-primario">
                {acao.ocupado ? (
                  <>
                    <Girando />
                    Conferindo com a Meta...
                  </>
                ) : (
                  "Conectar"
                )}
              </button>
              {conectado && (
                <button type="button" onClick={() => setTrocando(false)} className="botao-secundario">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
