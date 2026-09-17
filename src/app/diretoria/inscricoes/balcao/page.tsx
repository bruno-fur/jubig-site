import type { Metadata } from "next";
import Link from "next/link";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { esportesDoEvento, igrejasParaEscolha } from "@/lib/eventos";
import type { Evento } from "@/tipos/db";
import { FormularioBalcao, type EventoBalcao } from "./FormularioBalcao";

export const metadata: Metadata = { title: "Inscrição no balcão", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Inscrição feita pela diretoria, com a pessoa na frente.
 *
 * Existe porque as inscrições pelo site fecham antes do evento, mas sempre
 * aparece quem só resolve na hora — e paga em dinheiro ou na maquininha.
 */
export default async function Balcao() {
  await exigirDiretoria();
  const supabase = await createClient();

  const [{ data: lista }, igrejas] = await Promise.all([
    supabase.from("eventos").select("*").eq("tem_inscricao", true).order("data_evento"),
    igrejasParaEscolha(),
  ]);

  const eventos = (lista ?? []) as Evento[];
  const comModalidades = await Promise.all(
    eventos.map(async (e): Promise<EventoBalcao> => ({
      slug: e.slug,
      nome: e.nome,
      dataEvento: e.data_evento,
      idadeMinima: e.idade_minima,
      valorCentavos: e.valor_centavos,
      maxPorTurno: e.max_esportes_por_turno ?? 0,
      modalidades: e.tem_modalidades
        ? (await esportesDoEvento(e.id)).map((m) => ({
            id: m.esporte_id,
            nome: m.nome,
            turno: m.turno,
            categoria: m.categoria,
            formato: m.formato,
            restantes: m.restantes,
          }))
        : [],
    }))
  );

  return (
    <>
      <Link href="/diretoria/inscricoes" className="text-sm font-semibold text-apagado hover:underline">
        ← Inscrições
      </Link>
      <h2 className="titulo mt-2 mb-1 text-2xl">Inscrição no balcão</h2>
      <p className="mb-5 text-apagado">
        Para quem chegou no dia e pagou na hora. Entra já confirmada, com ingresso e QR — sem comprovante para
        conferir depois.
      </p>

      {eventos.length === 0 ? (
        <p className="cartao p-5 text-apagado">Nenhum evento com inscrição cadastrado.</p>
      ) : (
        <FormularioBalcao eventos={comModalidades} igrejas={igrejas} />
      )}
    </>
  );
}
