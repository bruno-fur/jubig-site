"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { CartaoPortaria, type DadosCartao } from "@/components/CartaoPortaria";
import { Girando } from "@/components/Girando";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const MENSAGEM: Record<string, string> = {
  nao_encontrado: "Esse QR não é de nenhum ingresso da JUBIG.",
  ja_entrou: "Esse ingresso já tinha sido usado.",
  nao_confirmada: "A inscrição não está confirmada.",
  sem_permissao: "Você não tem acesso à validação.",
};

/** O que a janela mostra depois de uma leitura. */
type Leitura =
  | { tipo: "ingresso"; dados: DadosCartao; liberadoAgora: boolean; erro: string | null }
  | { tipo: "erro"; mensagem: string };

/**
 * Validação de ingressos na entrada do evento.
 *
 *   1. "Começar validação" abre a câmera, que fica varrendo
 *   2. leu um QR → janela por cima com a pessoa e a situação
 *   3. "Liberar entrada" → registra (uma vez só, garantido no banco)
 *   4. "Próximo ingresso" fecha a janela e volta a ler; "Sair" vai para a
 *      visão geral e desliga a câmera
 *
 * A câmera comum do celular também lê o QR, mas abre uma aba por pessoa. Aqui
 * a câmera fica aberta entre uma leitura e outra — na fila, é o que importa.
 *
 * jsQR em vez de BarcodeDetector: o nativo não existe no Safari do iPhone.
 */
export function LeitorQR() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const janela = useRef<HTMLDialogElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const ultimaLeitura = useRef<string | null>(null);

  const [ligada, setLigada] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");
  const [liberados, setLiberados] = useState(0);

  const buscar = useCallback(async (texto: string) => {
    const achado = texto.match(UUID)?.[0];
    if (!achado) {
      setLeitura({ tipo: "erro", mensagem: "Esse QR não é de um ingresso da JUBIG." });
      return;
    }
    setBuscando(true);
    const r = await fetch(`/api/admin/ingresso/${achado}`).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setBuscando(false);

    if (!r?.ok) {
      setLeitura({ tipo: "erro", mensagem: MENSAGEM[corpo.erro] ?? "Sem conexão. Tente de novo." });
      return;
    }
    setLeitura({ tipo: "ingresso", dados: corpo, liberadoAgora: false, erro: null });
  }, []);

  const desligar = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    setLigada(false);
  }, []);

  const ligar = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      fluxo.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setLigada(true);
    } catch {
      setErroCamera(
        "Não deu para abrir a câmera. Libere o acesso nas configurações do navegador — ou digite o código abaixo."
      );
    }
  }, []);

  /*
   * A câmera abre num toque, não sozinha: o Safari do iPhone só libera a
   * câmera depois de um gesto de quem está com o celular. Ao sair da tela,
   * desliga — senão a luz da câmera fica acesa no bolso.
   */
  useEffect(() => desligar, [desligar]);

  // Varre o vídeo enquanto a janela estiver fechada.
  useEffect(() => {
    if (!ligada || leitura || buscando) return;

    const id = setInterval(() => {
      const v = video.current;
      const c = tela.current;
      if (!v || !c || v.readyState < 2) return;

      // Resolução reduzida: decodificar 1080p a cada 250ms esquenta o celular na fila.
      const largura = 480;
      const altura = Math.round((v.videoHeight / v.videoWidth) * largura) || 360;
      c.width = largura;
      c.height = altura;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, largura, altura);
      const img = ctx.getImageData(0, 0, largura, altura);
      const qr = jsQR(img.data, largura, altura, { inversionAttempts: "dontInvert" });

      // O mesmo QR parado na frente da câmera não abre a janela de novo em loop.
      if (qr?.data && qr.data !== ultimaLeitura.current) {
        ultimaLeitura.current = qr.data;
        navigator.vibrate?.(60);
        void buscar(qr.data);
      }
    }, 250);

    return () => clearInterval(id);
  }, [ligada, leitura, buscando, buscar]);

  // A janela nativa (<dialog>) prende o foco e fecha no Esc — acessível sem biblioteca.
  useEffect(() => {
    const d = janela.current;
    if (!d) return;
    if (leitura && !d.open) d.showModal();
    if (!leitura && d.open) d.close();
  }, [leitura]);

  async function liberar() {
    if (leitura?.tipo !== "ingresso") return;
    setRegistrando(true);
    const r = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ingresso: leitura.dados.ingresso }),
    }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setRegistrando(false);

    const dados: DadosCartao = corpo.dados ?? leitura.dados;
    if (r?.ok) {
      navigator.vibrate?.([40, 60, 40]);
      setLiberados((n) => n + 1);
      setLeitura({ tipo: "ingresso", dados, liberadoAgora: true, erro: null });
    } else {
      setLeitura({
        tipo: "ingresso",
        dados,
        liberadoAgora: false,
        erro: MENSAGEM[corpo.resultado ?? corpo.erro] ?? "Sem conexão. Tente de novo.",
      });
    }
  }

  function proximo() {
    setLeitura(null);
    ultimaLeitura.current = null;
    setCodigoManual("");
  }

  function sair() {
    desligar();
    router.push("/diretoria");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-apagado">Aponte a câmera para o QR Code do ingresso.</p>
        {liberados > 0 && (
          <p className="text-sm font-semibold text-ok" aria-live="polite">
            {liberados} {liberados === 1 ? "entrada liberada" : "entradas liberadas"} agora
          </p>
        )}
      </div>

      <div className="cartao overflow-hidden">
        <div className="relative aspect-square bg-tinta sm:aspect-video">
          <video
            ref={video}
            playsInline
            muted
            className={`h-full w-full object-cover ${ligada ? "" : "hidden"}`}
          />
          <canvas ref={tela} className="hidden" />

          {ligada && !leitura && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[18%] rounded-[16px] border-4 border-laranja/80"
            />
          )}

          {!ligada && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-creme">
              <img src="/juca/heh.webp" alt="" className="w-20" />
              <p>{erroCamera ?? "A câmera fica ligada entre um ingresso e outro."}</p>
              <button
                type="button"
                onClick={() => {
                  setErroCamera(null);
                  void ligar();
                }}
                className="botao-primario py-4 text-lg"
              >
                {erroCamera ? "Tentar de novo" : "Começar validação"}
              </button>
            </div>
          )}

          {buscando && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-tinta/70 text-creme">
              <Girando className="h-6 w-6" />
              Buscando ingresso...
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 border-t border-linha p-3">
          <button type="button" onClick={sair} className="text-sm font-semibold text-apagado hover:underline">
            Sair da validação
          </button>
          {ligada && (
            <button type="button" onClick={desligar} className="text-sm font-semibold text-apagado hover:underline">
              Desligar câmera
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void buscar(codigoManual);
        }}
        className="cartao flex flex-wrap gap-2 p-4"
      >
        <label className="w-full text-sm font-semibold text-tinta" htmlFor="codigo-manual">
          QR não lê? Cole ou digite o código do ingresso
        </label>
        <input
          id="codigo-manual"
          value={codigoManual}
          onChange={(e) => setCodigoManual(e.target.value)}
          placeholder="8a2f...-...."
          className="campo-texto min-w-0 flex-1 font-mono text-sm"
        />
        <button type="submit" disabled={buscando} className="botao-secundario">
          Buscar
        </button>
      </form>

      <dialog
        ref={janela}
        onCancel={(e) => {
          // Esc fecha como "Próximo ingresso", mantendo o estado da tela em ordem.
          e.preventDefault();
          proximo();
        }}
        aria-label="Ingresso lido"
        className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[16px] border border-linha bg-white p-0 text-tinta backdrop:bg-tinta/70"
      >
        {leitura?.tipo === "ingresso" && (
          <>
            <CartaoPortaria
              dados={leitura.dados}
              registrando={registrando}
              aoRegistrar={liberar}
              liberadoAgora={leitura.liberadoAgora}
              semMoldura
            />
            {leitura.erro && (
              <p role="alert" className="mx-5 mb-3 rounded-[10px] bg-ruim/10 px-4 py-3 text-sm font-medium text-ruim">
                {leitura.erro}
              </p>
            )}
          </>
        )}

        {leitura?.tipo === "erro" && (
          <div className="p-7 text-center">
            <img src="/juca/nao.webp" alt="" className="mx-auto w-24" />
            <p className="titulo mt-3 text-xl">Não liberado</p>
            <p role="alert" className="mt-1 text-apagado">
              {leitura.mensagem}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-linha p-4">
          <button type="button" onClick={sair} className="botao-secundario py-4">
            Sair
          </button>
          <button type="button" onClick={proximo} autoFocus className="botao-primario py-4">
            Próximo ingresso
          </button>
        </div>
      </dialog>
    </div>
  );
}
