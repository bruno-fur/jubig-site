import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eventoPorSlug, esportesDoEvento, agruparPorHorario, inscricoesAbertas, vagasRestantes } from "@/lib/eventos";
import { formatarData, formatarReais } from "@/lib/validacao";
import { Abas } from "@/components/Abas";
import { Galeria } from "@/components/Galeria";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ evento: string }>;
}): Promise<Metadata> {
  const { evento: slug } = await params;
  const evento = await eventoPorSlug(slug);
  if (!evento) return { title: "Evento" };
  return {
    title: evento.nome,
    description: evento.descricao ?? `${formatarData(evento.data_evento)} em ${evento.cidade}.`,
  };
}

export default async function PaginaEvento({ params }: { params: Promise<{ evento: string }> }) {
  const { evento: slug } = await params;
  const evento = await eventoPorSlug(slug);
  if (!evento) notFound();

  const supabase = await createClient();
  const [{ data: programacao }, { data: duvidas }, esportes, restantes] = await Promise.all([
    supabase.from("programacao").select("*").eq("evento_id", evento.id).order("ordem"),
    supabase
      .from("duvidas")
      .select("*")
      .or(`evento_id.eq.${evento.id},evento_id.is.null`)
      .order("ordem"),
    esportesDoEvento(evento.id),
    vagasRestantes(evento),
  ]);

  const abertas = inscricoesAbertas(evento);
  const poucas = restantes !== null && restantes > 0 && restantes <= 20;

  return (
    <>
      <section className="border-b border-linha bg-areia">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="text-4xl">{evento.nome}</h1>
          <p className="mt-2 text-lg text-apagado">
            {formatarData(evento.data_evento)}
            {evento.data_fim && ` a ${formatarData(evento.data_fim)}`} · {evento.cidade}
          </p>
          {evento.descricao && <p className="mt-4 max-w-prose text-tinta/80">{evento.descricao}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {abertas ? (
              <Link href={`/${evento.slug}/inscricao`} className="botao-primario">
                Inscrever — {formatarReais(evento.valor_centavos)} por pessoa
              </Link>
            ) : (
              <span className="rounded-[10px] bg-tinta/10 px-5 py-3 font-semibold text-apagado">
                Inscrições encerradas
              </span>
            )}
            {poucas && (
              <span className="inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-sm font-semibold text-laranja-escuro">
                <img src="/juca/susto.webp" alt="" className="h-7 w-7 object-contain" />
                Restam {restantes} vagas
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <Abas
          abas={[
            {
              id: "programacao",
              titulo: "Programação",
              conteudo:
                programacao && programacao.length > 0 ? (
                  <ol className="cartao divide-y divide-linha">
                    {programacao.map((p) => (
                      <li key={p.id} className="flex gap-4 p-4">
                        <span className="titulo w-16 shrink-0 text-laranja-escuro">{p.horario}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-tinta">{p.titulo}</span>
                          {p.descricao && (
                            <span className="block text-sm text-apagado">{p.descricao}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Vazio texto="A programação ainda está sendo fechada." />
                ),
            },
            {
              id: "modalidades",
              titulo: "Modalidades",
              conteudo:
                esportes.length > 0 ? (
                  <div className="space-y-5">
                    {agruparPorHorario(esportes).map(([horario, lista]) => (
                      <div key={horario}>
                        <p className="mb-2 text-sm font-semibold text-apagado">{horario}</p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {lista.map((e) => (
                            <li
                              key={e.esporte_id}
                              className="flex items-center justify-between gap-2 rounded-[10px] border border-linha bg-white p-3 text-sm"
                            >
                              <span className="font-semibold text-tinta">{e.nome}</span>
                              <span className={e.restantes <= 0 ? "text-ruim" : "text-apagado"}>
                                {e.restantes <= 0 ? "lotada" : `${e.restantes} vagas`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Vazio texto="As modalidades ainda não foram cadastradas." />
                ),
            },
            {
              id: "local",
              titulo: "Local",
              conteudo: (
                <div className="cartao p-5">
                  <p className="titulo text-lg">{evento.local_nome ?? evento.cidade}</p>
                  {evento.local_endereco && (
                    <p className="mt-1 text-apagado">{evento.local_endereco}</p>
                  )}
                  {evento.local_mapa_url ? (
                    <a
                      href={evento.local_mapa_url}
                      target="_blank"
                      rel="noreferrer"
                      className="botao-secundario mt-4"
                    >
                      Abrir no mapa
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-apagado">
                      O endereço completo sai junto com a confirmação da inscrição.
                    </p>
                  )}
                </div>
              ),
            },
            {
              id: "duvidas",
              titulo: "Dúvidas",
              conteudo:
                duvidas && duvidas.length > 0 ? (
                  <div className="cartao divide-y divide-linha">
                    {duvidas.map((d) => (
                      <details key={d.id} className="p-4">
                        <summary className="cursor-pointer font-semibold text-tinta">
                          {d.pergunta}
                        </summary>
                        <p className="mt-2 text-sm text-apagado">{d.resposta}</p>
                      </details>
                    ))}
                  </div>
                ) : (
                  <Vazio texto="Ainda não temos perguntas cadastradas. Chama a diretoria no WhatsApp." />
                ),
            },
          ]}
        />
      </div>

      <Galeria eventoId={evento.id} limite={8} />
    </>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="cartao flex items-center gap-4 p-6">
      <img src="/juca/heh.webp" alt="" className="w-16" />
      <p className="text-apagado">{texto}</p>
    </div>
  );
}
