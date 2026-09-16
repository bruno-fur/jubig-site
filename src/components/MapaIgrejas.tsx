"use client";

import { useEffect, useRef } from "react";
import type { Igreja } from "@/tipos/db";

/**
 * Mapa das igrejas, com OpenStreetMap.
 *
 * Sem Google Maps de propósito: a API deles exige conta de faturamento com
 * cartão cadastrado, e uma chave que vaze vira fatura. O OSM não pede chave
 * nem cartão, e para mostrar uns pinos no oeste do Paraná entrega o mesmo.
 *
 * Leaflet direto, sem react-leaflet: é uma biblioteca que manipula o DOM
 * sozinha, e envolver isso numa camada React só acrescenta uma dependência
 * que precisa acompanhar cada versão nova do React.
 */
export function MapaIgrejas({ igrejas }: { igrejas: Igreja[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);

  const comCoordenada = igrejas.filter(
    (i) => typeof i.latitude === "number" && typeof i.longitude === "number"
  );

  useEffect(() => {
    if (!caixa.current || comCoordenada.length === 0) return;

    let vivo = true;
    let criado: import("leaflet").Map | null = null;

    /*
     * Import dinâmico: o Leaflet toca em `window` ao carregar e quebra no
     * render do servidor. Dentro do efeito, só roda no navegador.
     */
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!vivo || !caixa.current || mapa.current) return;

      criado = L.map(caixa.current, { scrollWheelZoom: false });
      mapa.current = criado;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(criado);

      /*
       * Pino desenhado à mão em vez do ícone padrão do Leaflet: o padrão é um
       * PNG referenciado por caminho relativo, que o bundler não acha e some
       * do mapa. De quebra, sai no laranja da marca.
       */
      const pino = L.divIcon({
        className: "",
        html: `<span style="display:block;width:18px;height:18px;border-radius:50%;
                 background:#D94C1A;border:3px solid #fff;
                 box-shadow:0 1px 4px rgb(0 0 0 / .4)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      for (const i of comCoordenada) {
        L.marker([i.latitude!, i.longitude!], { icon: pino, title: i.nome })
          .addTo(criado)
          .bindPopup(
            `<strong>${i.nome}</strong><br>${i.cidade} · ${i.estado}` +
              (i.endereco ? `<br>${i.endereco}` : "")
          );
      }

      const limites = L.latLngBounds(comCoordenada.map((i) => [i.latitude!, i.longitude!]));
      // Uma igreja só não tem área: `fitBounds` daria zoom máximo na rua.
      if (comCoordenada.length === 1) criado.setView(limites.getCenter(), 13);
      else criado.fitBounds(limites, { padding: [40, 40] });
    })();

    return () => {
      vivo = false;
      criado?.remove();
      mapa.current = null;
    };
  }, [comCoordenada]);

  if (comCoordenada.length === 0) {
    return (
      <div className="cartao flex items-center gap-4 p-6">
        <img src="/juca/heh.webp" alt="" className="w-16" />
        <p className="text-apagado">
          Nenhuma igreja tem localização cadastrada ainda. A lista abaixo continua valendo.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={caixa}
      role="application"
      aria-label={`Mapa com ${comCoordenada.length} igrejas da JUBIG`}
      className="h-[360px] w-full overflow-hidden rounded-[16px] border border-linha bg-areia lg:h-[540px]"
    />
  );
}
