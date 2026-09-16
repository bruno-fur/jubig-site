"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { comprimirImagem, tamanhoLegivel } from "@/lib/comprimir";

export type FotoDaGaleria = {
  id: string;
  legenda: string | null;
  eventoId: string | null;
  ordem: number;
  url: string;
};

type Evento = { id: string; nome: string };

const MENSAGEM: Record<string, string> = {
  tipo_invalido: "Aceita foto JPG, PNG ou WebP.",
  arquivo_grande: "A foto passa de 8 MB mesmo depois de reduzida.",
  falha_upload: "A foto não subiu. Tente de novo.",
  sem_permissao: "Só a diretoria mexe na galeria.",
  nao_encontrada: "Essa foto já tinha sido apagada.",
};

/**
 * Galeria pela tela, sem passar pelo painel do Supabase.
 *
 * Sobe várias de uma vez, uma depois da outra: dez fotos em paralelo no 4G do
 * ginásio derrubam o envio inteiro, e aí não se sabe quais entraram. Em fila,
 * o que falhou fica claro e o resto já está lá.
 *
 * Cada foto é reduzida no navegador antes de subir (mesma função do
 * comprovante): álbum de evento é o que enche o 1 GB do plano gratuito.
 */
export function GerenciarGaleria({ fotos, eventos }: { fotos: FotoDaGaleria[]; eventos: Evento[] }) {
  const router = useRouter();
  const acao = useAcao({ mensagens: MENSAGEM });
  const [eventoId, setEventoId] = useState("");
  const [legenda, setLegenda] = useState("");
  const [fila, setFila] = useState<{ total: number; feitas: number } | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  async function enviar(lista: FileList | null) {
    if (!lista?.length) return;
    setErroLocal(null);
    const arquivos = [...lista];
    setFila({ total: arquivos.length, feitas: 0 });

    let falhas = 0;
    for (const [i, bruto] of arquivos.entries()) {
      const { arquivo } = await comprimirImagem(bruto);
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);
      corpo.append("legenda", legenda);
      corpo.append("ordem", String(fotos.length + i));
      if (eventoId) corpo.append("eventoId", eventoId);

      const r = await fetch("/api/admin/galeria", { method: "POST", body: corpo }).catch(() => null);
      if (!r?.ok) falhas++;
      setFila({ total: arquivos.length, feitas: i + 1 });
    }

    setFila(null);
    if (falhas > 0) setErroLocal(`${falhas} de ${arquivos.length} não subiram. Tente de novo.`);
    router.refresh();
  }

  const porEvento = new Map<string, FotoDaGaleria[]>();
  for (const f of fotos) {
    const chave = f.eventoId ?? "";
    porEvento.set(chave, [...(porEvento.get(chave) ?? []), f]);
  }
  const nomeDoEvento = (id: string) => eventos.find((e) => e.id === id)?.nome ?? "Sem evento";

  return (
    <>
      <section className="cartao p-5">
        <h2 className="titulo text-xl">Subir fotos</h2>
        <p className="mt-1 text-sm text-apagado">
          Dá para escolher várias de uma vez. Cada foto é reduzida no seu celular antes de subir, então
          o envio é rápido mesmo no 4G.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-tinta">Evento</span>
            <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="campo-texto">
              <option value="">Sem evento (galeria geral)</option>
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-tinta">Legenda (opcional)</span>
            <input
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Vale para todas as fotos deste envio"
              maxLength={200}
              className="campo-texto"
            />
          </label>
        </div>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={Boolean(fila)}
          onChange={(e) => void enviar(e.target.files)}
          className="mt-3 block w-full rounded-[10px] border-2 border-dashed border-linha bg-areia/40 p-4 text-sm text-apagado file:mr-3 file:rounded-[10px] file:border-0 file:bg-tinta file:px-4 file:py-2 file:text-sm file:font-semibold file:text-creme disabled:opacity-50"
        />

        {fila && (
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-laranja-escuro" aria-live="polite">
            <Girando />
            Enviando {fila.feitas} de {fila.total}...
          </p>
        )}

        {(erroLocal || acao.erro) && (
          <div className="mt-3">
            <Recado erro={erroLocal ?? acao.erro} aoFechar={() => setErroLocal(null)} />
          </div>
        )}
      </section>

      {fotos.length === 0 ? (
        <div className="cartao mt-6 flex items-center gap-4 p-6">
          <img src="/juca/heh.webp" alt="" className="w-16" />
          <p className="text-apagado">Nenhuma foto ainda. As que você subir aparecem na home e na página /galeria.</p>
        </div>
      ) : (
        [...porEvento.entries()].map(([id, lista]) => (
          <section key={id || "geral"} className="mt-8">
            <h2 className="titulo text-xl">
              {id ? nomeDoEvento(id) : "Galeria geral"}{" "}
              <span className="text-base font-normal text-apagado">· {lista.length} fotos</span>
            </h2>

            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {lista.map((f) => (
                <li key={f.id} className="cartao overflow-hidden">
                  <img src={f.url} alt={f.legenda ?? ""} loading="lazy" className="aspect-square w-full object-cover" />
                  <div className="p-2">
                    <input
                      defaultValue={f.legenda ?? ""}
                      placeholder="Legenda"
                      maxLength={200}
                      onBlur={(e) => {
                        if (e.target.value === (f.legenda ?? "")) return;
                        void acao.json("/api/admin/galeria", "PATCH", { id: f.id, legenda: e.target.value });
                      }}
                      className="w-full rounded-[8px] border border-linha px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      disabled={acao.ocupado}
                      onClick={() => acao.json("/api/admin/galeria", "DELETE", { id: f.id })}
                      className="mt-1 text-xs font-semibold text-ruim hover:underline disabled:opacity-40"
                    >
                      Apagar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="mt-8 text-sm text-apagado">
        Espaço do plano gratuito: 1 GB para comprovantes e fotos juntos. Cada foto aqui fica em torno de{" "}
        {tamanhoLegivel(300 * 1024)} depois de reduzida — dá para umas 2.000.
      </p>
    </>
  );
}
