"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 *
 * São quase 50 igrejas: listar todas embaixo do mapa dava uma parede de
 * cartões. Agora escolhe-se a igreja numa lista agrupada por cidade, o mapa
 * voa até ela e os dados aparecem logo abaixo. Clicar no pino faz o mesmo
 * caminho ao contrário.
 */
export function MapaIgrejas({ igrejas }: { igrejas: Igreja[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const marcadores = useRef<Record<string, import("leaflet").Marker>>({});
  const [escolhida, setEscolhida] = useState("");

  const comCoordenada = useMemo(
    () => igrejas.filter((i) => typeof i.latitude === "number" && typeof i.longitude === "number"),
    [igrejas]
  );

  // Agrupadas por cidade, como no seletor de igreja da inscrição.
  const porCidade = useMemo(() => {
    const mapaCidades = new Map<string, Igreja[]>();
    const ordenadas = [...igrejas].sort(
      (a, b) => a.cidade.localeCompare(b.cidade, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")
    );
    for (const i of ordenadas) mapaCidades.set(i.cidade, [...(mapaCidades.get(i.cidade) ?? []), i]);
    return [...mapaCidades.entries()];
  }, [igrejas]);

  const atual = igrejas.find((i) => i.id === escolhida) ?? null;

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
        const marcador = L.marker([i.latitude!, i.longitude!], { icon: pino, title: i.nome })
          .addTo(criado)
          .bindPopup(
            `<strong>${i.nome}</strong><br>${i.cidade} · ${i.estado}` +
              (i.endereco ? `<br>${i.endereco}` : "")
          );
        // Clicar no pino escolhe a igreja: a ficha abaixo do mapa acompanha.
        marcador.on("click", () => setEscolhida(i.id));
        marcadores.current[i.id] = marcador;
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
      marcadores.current = {};
    };
  }, [comCoordenada]);

  // Voa até a igreja escolhida e abre o balão dela.
  useEffect(() => {
    const marcador = marcadores.current[escolhida];
    if (!mapa.current || !marcador) return;

    const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapa.current.flyTo(marcador.getLatLng(), 16, { duration: menosMovimento ? 0 : 0.9 });
    marcador.openPopup();
  }, [escolhida]);

  function verTodas() {
    setEscolhida("");
    const mapaAtual = mapa.current;
    if (!mapaAtual || comCoordenada.length === 0) return;
    mapaAtual.closePopup();
    const cantos = comCoordenada.map((i) => [i.latitude!, i.longitude!] as [number, number]);
    if (cantos.length === 1) mapaAtual.setView(cantos[0], 13);
    else mapaAtual.fitBounds(cantos, { padding: [40, 40] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[240px] flex-1">
          <span className="mb-1.5 block text-sm font-semibold text-tinta">Procure a sua igreja</span>
          <select
            value={escolhida}
            onChange={(e) => setEscolhida(e.target.value)}
            className="campo-texto"
          >
            <option value="">Todas as {igrejas.length} igrejas e congregações</option>
            {porCidade.map(([cidade, lista]) => (
              <optgroup key={cidade} label={cidade}>
                {lista.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                    {i.latitude === null ? " (sem ponto no mapa)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {escolhida && (
          <button type="button" onClick={verTodas} className="botao-secundario">
            Ver todas
          </button>
        )}
      </div>

      {comCoordenada.length === 0 ? (
        <div className="cartao flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">
            Nenhuma igreja tem localização cadastrada ainda. Use a lista acima para ver os dados.
          </p>
        </div>
      ) : (
        <div
          ref={caixa}
          role="application"
          aria-label={`Mapa com ${comCoordenada.length} igrejas da JUBIG`}
          className="h-[360px] w-full overflow-hidden rounded-[16px] border border-linha bg-areia lg:h-[520px]"
        />
      )}

      {atual && (
        <article className="cartao p-4" aria-live="polite">
          <p className="titulo text-lg">{atual.nome}</p>
          <p className="text-sm text-apagado">
            {atual.cidade} · {atual.estado}
          </p>
          {atual.endereco ? (
            <p className="mt-1 text-sm text-apagado">{atual.endereco}</p>
          ) : (
            <p className="mt-1 text-sm text-apagado">
              Endereço ainda não cadastrado{atual.latitude !== null && " — o pino mostra a região"}.
            </p>
          )}

          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {atual.endereco && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${atual.nome}, ${atual.endereco}, ${atual.cidade}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-laranja-escuro hover:underline"
              >
                Como chegar
              </a>
            )}
            {atual.telefone && (
              <a href={`tel:${atual.telefone}`} className="text-apagado hover:text-tinta hover:underline">
                {atual.telefone}
              </a>
            )}
            {atual.instagram && (
              <a
                href={`https://instagram.com/${atual.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="text-apagado hover:text-tinta hover:underline"
              >
                @{atual.instagram}
              </a>
            )}
          </p>
        </article>
      )}
    </div>
  );
}
