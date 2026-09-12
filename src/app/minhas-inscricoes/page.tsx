import type { Metadata } from "next";
import Link from "next/link";
import { exigirLogin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { AvisoEmailNaoConfirmado } from "@/components/AvisoEmailNaoConfirmado";
import { SeloStatus } from "@/components/SeloStatus";
import { TrocaEsporte } from "@/components/TrocaEsporte";
import { agruparPorTurno, esportesDoEvento, hojeISO } from "@/lib/eventos";
import { formatarData, formatarReais, cpfMascarado } from "@/lib/validacao";
import { ROTULO_TURNO, type Comprovante, type Evento, type Inscricao, type Inscrito, type VagaEsporte } from "@/tipos/db";

export const metadata: Metadata = { title: "Minhas inscrições" };

type Linha = Inscricao & {
  eventos: Evento;
  inscritos: (Inscrito & { inscritos_esportes: { esporte_id: string }[] })[];
  comprovantes: Comprovante[];
};

export default async function MinhasInscricoes() {
  const sessao = await exigirLogin();

  if (!sessao.emailConfirmado) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <AvisoEmailNaoConfirmado email={sessao.email} variante="bloqueio" />
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("inscricoes")
    .select("*, eventos(*), inscritos(*, inscritos_esportes(esporte_id)), comprovantes(*)")
    .order("criado_em", { ascending: false });

  const inscricoes = (data ?? []) as Linha[];

  if (inscricoes.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <img src="/juca/feliz.webp" alt="" className="mx-auto w-32" />
        <h1 className="mt-4 text-3xl">Nenhuma inscrição ainda</h1>
        <p className="mt-2 text-apagado">Quando você se inscrever num evento, ele aparece aqui.</p>
        <Link href="/" className="botao-primario mt-6">
          Ver os eventos
        </Link>
      </div>
    );
  }

  // Uma consulta de modalidades por evento, não por inscrição.
  const eventos = [...new Map(inscricoes.map((i) => [i.eventos.id, i.eventos])).values()];
  const esportesPorEvento = new Map<string, VagaEsporte[]>();
  await Promise.all(
    eventos.map(async (e) => esportesPorEvento.set(e.id, await esportesDoEvento(e.id)))
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl">Minhas inscrições</h1>

      <div className="mt-6 space-y-6">
        {inscricoes.map((i) => {
          const esportes = esportesPorEvento.get(i.eventos.id) ?? [];
          const nomeEsporte = new Map(esportes.map((e) => [e.esporte_id, `${e.nome} (${ROTULO_TURNO[e.turno]})`]));
          const prazoTroca = prazoDeTroca(i.eventos);
          const podeTrocar = hojeISO() <= prazoTroca && i.status !== "cancelada";
          const pagos = i.comprovantes.filter((c) => c.aprovado !== false).length;
          const faltaComprovante = pagos < i.parcelas;

          return (
            <article key={i.id} className="cartao overflow-hidden">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-linha p-5">
                <div>
                  <p className="titulo text-xl">{i.eventos.nome}</p>
                  <p className="mt-1 text-sm text-apagado">
                    {formatarData(i.eventos.data_evento)} · {i.eventos.cidade} · {i.codigo}
                  </p>
                </div>
                <SeloStatus status={i.status} />
              </header>

              {i.status === "recusada" && i.motivo_recusa && (
                <p className="border-b border-linha bg-ruim/5 px-5 py-3 text-sm text-ruim">
                  <strong>Motivo da recusa:</strong> {i.motivo_recusa}
                </p>
              )}

              <ul className="divide-y divide-linha">
                {i.inscritos.map((p) => (
                  <li key={p.id} className="p-5">
                    <p className="font-semibold text-tinta">{p.nome}</p>
                    <p className="text-sm text-apagado">
                      {cpfMascarado(p.cpf)} · {p.igreja}
                    </p>

                    <p className="mt-2 text-sm">
                      {p.de_boa ? (
                        <span className="text-apagado">Vai só de boa, sem competir.</span>
                      ) : (
                        p.inscritos_esportes
                          .map((e) => nomeEsporte.get(e.esporte_id) ?? "—")
                          .join(", ") || <span className="text-apagado">Sem modalidade.</span>
                      )}
                    </p>

                    {podeTrocar && esportes.length > 0 && (
                      <TrocaEsporte
                        codigo={i.codigo}
                        inscritoId={p.id}
                        nome={p.nome}
                        grupos={agruparPorTurno(esportes)}
                        atuais={p.inscritos_esportes.map((e) => e.esporte_id)}
                        deBoa={p.de_boa}
                        prazo={formatarData(prazoTroca)}
                        maxPorTurno={i.eventos.max_esportes_por_turno ?? 0}
                      />
                    )}
                  </li>
                ))}
              </ul>

              <footer className="flex flex-wrap items-center justify-between gap-3 bg-areia/50 px-5 py-4">
                <span className="text-sm text-apagado">
                  {formatarReais(i.valor_centavos)}
                  {i.parcelas > 1 && ` · ${pagos} de ${i.parcelas} comprovantes`}
                </span>
                <Link
                  href={`/inscricoes/${i.codigo}`}
                  className={faltaComprovante ? "botao-primario px-4 py-2 text-sm" : "botao-secundario px-4 py-2 text-sm"}
                >
                  {faltaComprovante ? "Pagar e enviar comprovante" : "Ver inscrição"}
                </Link>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Último dia para trocar de modalidade: N dias antes do evento. */
function prazoDeTroca(evento: Evento): string {
  const d = new Date(evento.data_evento + "T12:00:00");
  d.setDate(d.getDate() - evento.troca_esporte_ate_dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
