import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eventoPorSlug, esportesDoEvento, agruparPorTurno, vagasRestantes, eventoJaComecou } from "@/lib/eventos";
import { formatarData } from "@/lib/validacao";
import { ChamadaEvento } from "@/components/ChamadaEvento";
import { Abas } from "@/components/Abas";
import { Programacao } from "@/components/Programacao";
import type { ItemProgramacao } from "@/lib/programacao";
import { Galeria } from "@/components/Galeria";
import { ROTULO_FORMATO, ROTULO_TIPO, ROTULO_TURNO } from "@/tipos/db";
import { rotuloModalidades } from "@/lib/modalidades";
import { PlacarPublico } from "@/components/PlacarPublico";

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

  // O tour acontece numa igreja da união; os outros formatos não têm anfitriã.
  const { data: igreja } = evento.igreja_id
    ? await supabase.from("igrejas").select("*").eq("id", evento.igreja_id).maybeSingle()
    : { data: null };

  const [{ data: programacao }, { data: duvidas }, esportes, restantes, { data: avisos }, { data: placar }] = await Promise.all([
    supabase
      .from("programacao")
      .select("*")
      .eq("evento_id", evento.id)
      .order("dia", { nullsFirst: true })
      .order("hora", { nullsFirst: false })
      .order("ordem"),
    supabase
      .from("duvidas")
      .select("*")
      .or(`evento_id.eq.${evento.id},evento_id.is.null`)
      .order("ordem"),
    esportesDoEvento(evento.id),
    vagasRestantes(evento),
    // Tabela nova: se o schema ainda não rodou, a consulta falha e a página
    // simplesmente não mostra avisos.
    supabase
      .from("avisos")
      .select("id, titulo, mensagem, criado_em")
      .eq("evento_id", evento.id)
      .order("criado_em", { ascending: false })
      .limit(5),
    // Idem: sem a view, só não aparece.
    supabase.from("placar").select("*").eq("evento_id", evento.id),
  ]);


  /*
   * Congresso não tem modalidade e tour não tem inscrição. Montar as abas a
   * partir das capacidades evita mostrar "Modalidades" vazio num congresso —
   * aba vazia parece defeito, não ausência de propósito.
   */
  const abas = [
    {
      id: "programacao",
      titulo: "Programação",
      conteudo:
        programacao && programacao.length > 0 ? (
          <Programacao itens={programacao as unknown as ItemProgramacao[]} />
        ) : (
          <Vazio texto="A programação ainda está sendo fechada." />
        ),
    },
    evento.tem_modalidades && {
      id: "modalidades",
      titulo: rotuloModalidades(esportes).plural,
      conteudo:
        esportes.length > 0 ? (
          <div className="space-y-5">
            {agruparPorTurno(esportes).map(([turno, lista]) => (
              <div key={turno}>
                <p className="mb-2 text-sm font-semibold text-apagado">{ROTULO_TURNO[turno]}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lista.map((e) => (
                    <li
                      key={e.esporte_id}
                      className="flex items-center justify-between gap-2 rounded-[10px] border border-linha bg-white p-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-tinta">{e.nome}</span>
                        <span className="block text-xs text-apagado">
                          {[
                            e.categoria === "oficina" && e.responsavel && `com ${e.responsavel}`,
                            e.categoria !== "oficina" && e.formato && e.formato !== "individual" && ROTULO_FORMATO[e.formato],
                            e.descricao,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
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
      conteudo: (() => {
        // Na igreja anfitriã o endereço já é público; nos outros, nem sempre.
        const nome = igreja?.nome ?? evento.local_nome ?? evento.cidade;
        const endereco = igreja?.endereco ?? evento.local_endereco;
        const busca = endereco
          ? `${nome}, ${endereco}, ${igreja?.cidade ?? evento.cidade}`
          : null;

        return (
          <div className="cartao p-5">
            <p className="titulo text-lg">{nome}</p>
            <p className="mt-1 text-apagado">
              {igreja ? `${igreja.cidade} · ${igreja.estado}` : evento.cidade}
            </p>
            {endereco && <p className="mt-1 text-apagado">{endereco}</p>}
            {igreja?.responsavel && (
              <p className="mt-2 text-sm text-apagado">Anfitrião: {igreja.responsavel}</p>
            )}

            {evento.local_mapa_url || busca ? (
              <a
                href={
                  evento.local_mapa_url ??
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca!)}`
                }
                target="_blank"
                rel="noreferrer"
                className="botao-secundario mt-4"
              >
                Como chegar
              </a>
            ) : (
              <p className="mt-3 text-sm text-apagado">
                {evento.tem_inscricao
                  ? "O endereço completo sai junto com a confirmação da inscrição."
                  : "O endereço completo sai mais perto da data."}
              </p>
            )}
          </div>
        );
      })(),
    },
    {
      id: "duvidas",
      titulo: "Dúvidas",
      conteudo:
        duvidas && duvidas.length > 0 ? (
          <div className="cartao divide-y divide-linha">
            {duvidas.map((d) => (
              <details key={d.id} className="p-4">
                <summary className="cursor-pointer font-semibold text-tinta">{d.pergunta}</summary>
                <p className="mt-2 text-sm text-apagado">{d.resposta}</p>
              </details>
            ))}
          </div>
        ) : (
          <Vazio texto="Ainda não temos perguntas cadastradas. Chama a diretoria no WhatsApp." />
        ),
    },
  ].filter(Boolean) as { id: string; titulo: string; conteudo: React.ReactNode }[];

  return (
    <>
      <section className="border-b border-linha bg-areia">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-sm font-semibold tracking-wide text-laranja-escuro uppercase">
            {ROTULO_TIPO[evento.tipo]}
          </p>
          <h1 className="mt-1 text-4xl lg:text-5xl xl:text-6xl">{evento.nome}</h1>
          <p className="mt-2 text-lg text-apagado">
            {formatarData(evento.data_evento)}
            {evento.data_fim && ` a ${formatarData(evento.data_fim)}`} · {evento.cidade}
          </p>
          {evento.descricao && <p className="mt-4 max-w-prose text-tinta/80">{evento.descricao}</p>}

          <ChamadaEvento evento={evento} restantes={restantes} />
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {avisos && avisos.length > 0 && (
          <section aria-labelledby="titulo-avisos" className="mb-8">
            <h2 id="titulo-avisos" className="titulo mb-3 text-xl">
              Avisos
            </h2>
            <ul className="space-y-3">
              {avisos.map((a) => (
                <li key={a.id} className="cartao border-l-4 border-l-laranja p-4">
                  <p className="font-semibold text-tinta">{a.titulo}</p>
                  <p className="mt-0.5 text-xs text-apagado">
                    {new Date(a.criado_em).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-line text-tinta/80">{a.mensagem}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Placar só aparece para o público depois que o evento começa. */}
        {eventoJaComecou(evento) && <PlacarPublico linhas={placar ?? []} />}

        <Abas abas={abas} />
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
