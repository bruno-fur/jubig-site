"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Opcoes = {
  /** erro da API -> texto para a tela */
  mensagens?: Record<string, string>;
  /** o que dizer quando der certo */
  sucesso?: string;
  /** recarrega os dados do servidor depois de gravar */
  recarregar?: boolean;
};

/**
 * Chama uma rota da API e devolve o estado da chamada.
 *
 * Existe porque `router.refresh()` é assíncrono e não bloqueia: sem
 * `useTransition`, o botão reabilitava assim que o fetch terminava, mas a
 * lista na tela só mudava um instante depois. Quem estava olhando via o botão
 * liberado com o dado velho e clicava de novo — e a diretoria aprovava o mesmo
 * comprovante duas vezes.
 *
 * Com a transição, `ocupado` só solta quando os dados novos já estão na tela.
 */
export function useAcao({ mensagens = {}, sucesso, recarregar = true }: Opcoes = {}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [atualizando, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  const executar = useCallback(
    async (url: string, init: RequestInit): Promise<{ ok: boolean; dados: Record<string, unknown> }> => {
      setErro(null);
      setFeito(null);
      setEnviando(true);

      let resposta: Response;
      try {
        resposta = await fetch(url, init);
      } catch {
        setEnviando(false);
        // Sinal de celular caindo no meio do ginásio é o caso comum aqui.
        setErro("Sem conexão. Confira a internet e tente de novo.");
        return { ok: false, dados: {} };
      }

      const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
      setEnviando(false);

      if (!resposta.ok) {
        setErro(mensagens[String(dados.erro)] ?? "Não deu para salvar agora. Tente de novo.");
        return { ok: false, dados };
      }

      if (sucesso) setFeito(sucesso);
      if (recarregar) iniciarTransicao(() => router.refresh());
      return { ok: true, dados };
    },
    [mensagens, sucesso, recarregar, router]
  );

  const json = useCallback(
    (url: string, metodo: string, corpo: unknown) =>
      executar(url, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      }),
    [executar]
  );

  return {
    executar,
    json,
    /** true do clique até os dados novos estarem na tela */
    ocupado: enviando || atualizando,
    enviando,
    atualizando,
    erro,
    feito,
    limpar: () => {
      setErro(null);
      setFeito(null);
    },
  };
}
