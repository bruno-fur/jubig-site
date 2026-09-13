"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CartaoPortaria, type DadosCartao } from "@/components/CartaoPortaria";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const MENSAGEM: Record<string, string> = {
  nao_encontrado: "Esse QR não é de nenhum ingresso da JUBIG.",
  ja_entrou: "Esse ingresso já tinha sido usado.",
  nao_confirmada: "A inscrição não está confirmada.",
  sem_permissao: "Você não tem acesso à portaria.",
};

/**
 * Leitor de QR dentro do site.
 *
 * A câmera comum do celular também lê o QR e abre a página do ingresso, mas
 * abre uma aba nova a cada pessoa. Na fila do JubigDay isso vira dezenas de
 * abas e uma espera a cada leitura. Aqui a câmera fica aberta: lê, mostra,
 * confirma, e já está pronta para o próximo.
 *
 * jsQR em vez de BarcodeDetector: o nativo não existe no Safari do iPhone, e
 * metade da diretoria usa iPhone.
 */
export function LeitorQR() {
  const video = useRef<HTMLVideoElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const ultimaLeitura = useRef<string | null>(null);

  const [ligada, setLigada] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [dados, setDados] = useState<DadosCartao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");

  const buscar = useCallback(async (texto: string) => {
    const achado = texto.match(UUID)?.[0];
    if (!achado) {
      setErro("Esse QR não é de um ingresso da JUBIG.");
      return;
    }
    setErro(null);
    setBuscando(true);
    const r = await fetch(`/api/admin/ingresso/${achado}`).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setBuscando(false);

    if (!r?.ok) {
      setDados(null);
      setErro(MENSAGEM[corpo.erro] ?? "Sem conexão. Tente de novo.");
      return;
    }
    setDados(corpo);
  }, []);

  const desligar = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    setLigada(false);
  }, []);

  async function ligar() {
    setErroCamera(null);
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
  }

  // Varre o vídeo enquanto não houver ingresso na tela.
  useEffect(() => {
    if (!ligada || dados || buscando) return;

    const id = setInterval(() => {
      const v = video.current;
      const c = tela.current;
      if (!v || !c || v.readyState < 2) return;

      // Leitura em resolução reduzida: o QR ocupa boa parte do quadro, e
      // decodificar 1080p a cada 250ms esquenta o celular na fila.
      const largura = 480;
      const altura = Math.round((v.videoHeight / v.videoWidth) * largura) || 360;
      c.width = largura;
      c.height = altura;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, largura, altura);
      const img = ctx.getImageData(0, 0, largura, altura);
      const qr = jsQR(img.data, largura, altura, { inversionAttempts: "dontInvert" });

      // Mesmo QR parado na frente da câmera não é lido de novo em loop.
      if (qr?.data && qr.data !== ultimaLeitura.current) {
        ultimaLeitura.current = qr.data;
        navigator.vibrate?.(60);
        void buscar(qr.data);
      }
    }, 250);

    return () => clearInterval(id);
  }, [ligada, dados, buscando, buscar]);

  useEffect(() => desligar, [desligar]);

  async function registrar() {
    if (!dados) return;
    setErro(null);
    setRegistrando(true);
    const r = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ingresso: dados.ingresso }),
    }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setRegistrando(false);

    if (corpo.dados) setDados(corpo.dados);
    if (!r?.ok) setErro(MENSAGEM[corpo.resultado ?? corpo.erro] ?? "Sem conexão. Tente de novo.");
  }

  function proximo() {
    setDados(null);
    setErro(null);
    ultimaLeitura.current = null;
  }

  return (
    <div className="space-y-4">
      <div className="cartao overflow-hidden">
        <div className="relative aspect-square bg-tinta sm:aspect-video">
          <video
            ref={video}
            playsInline
            muted
            className={`h-full w-full object-cover ${ligada ? "" : "hidden"}`}
          />
          <canvas ref={tela} className="hidden" />

          {ligada && !dados && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[18%] rounded-[16px] border-4 border-laranja/80"
            />
          )}

          {!ligada && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-creme">
              <img src="/juca/heh.webp" alt="" className="w-20" />
              <p>A câmera abre aqui e fica ligada entre uma pessoa e outra.</p>
              <button type="button" onClick={ligar} className="botao-primario">
                Ligar câmera
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

        {ligada && (
          <div className="flex justify-end border-t border-linha p-3">
            <button type="button" onClick={desligar} className="text-sm font-semibold text-apagado hover:underline">
              Desligar câmera
            </button>
          </div>
        )}
      </div>

      {erroCamera && <Recado erro={erroCamera} />}
      {erro && <Recado erro={erro} />}

      {dados && (
        <>
          <CartaoPortaria dados={dados} registrando={registrando} aoRegistrar={registrar} />
          <button type="button" onClick={proximo} className="botao-secundario w-full py-4 text-lg">
            Próximo
          </button>
        </>
      )}

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
    </div>
  );
}
