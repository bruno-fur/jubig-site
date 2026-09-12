"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { ROTULO_TURNO, type Turno } from "@/tipos/db";

type Modalidade = { esporte_id: string; nome: string; turno: Turno };

export function Exportar({ eventos }: { eventos: { slug: string; nome: string }[] }) {
  const [slug, setSlug] = useState(eventos[0]?.slug ?? "");
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidade, setModalidade] = useState("");

  useEffect(() => {
    if (!slug) return;
    let valendo = true;

    (async () => {
      const supabase = criarClienteNavegador();
      const { data: evento } = await supabase
        .from("eventos")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!evento) return;

      const { data } = await supabase
        .from("vagas_por_esporte")
        .select("esporte_id, nome, turno")
        .eq("evento_id", evento.id)
        .order("turno");

      if (valendo) {
        setModalidades((data ?? []) as Modalidade[]);
        setModalidade("");
      }
    })();

    return () => {
      valendo = false;
    };
  }, [slug]);

  if (eventos.length === 0) return null;

  const url = `/api/admin/exportar?evento=${encodeURIComponent(slug)}${
    modalidade ? `&modalidade=${encodeURIComponent(modalidade)}` : ""
  }`;

  return (
    <section className="cartao mt-6 p-5">
      <h2 className="titulo text-lg">Exportar lista</h2>
      <p className="mt-1 text-sm text-apagado">
        CSV pronto para o Excel. Traz CPF e telefone dos inscritos — não mande em grupo de
        WhatsApp.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          aria-label="Evento"
          className="rounded-[10px] border-2 border-linha bg-white px-3 py-2 text-sm"
        >
          {eventos.map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.nome}
            </option>
          ))}
        </select>

        <select
          value={modalidade}
          onChange={(e) => setModalidade(e.target.value)}
          aria-label="Modalidade"
          className="rounded-[10px] border-2 border-linha bg-white px-3 py-2 text-sm"
        >
          <option value="">Todas as modalidades</option>
          {modalidades.map((m) => (
            <option key={m.esporte_id} value={m.esporte_id}>
              {m.nome} ({ROTULO_TURNO[m.turno]})
            </option>
          ))}
        </select>

        <a href={url} className="botao-primario px-4 py-2 text-sm">
          Baixar CSV
        </a>
      </div>
    </section>
  );
}
