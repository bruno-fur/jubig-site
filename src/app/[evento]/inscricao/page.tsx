import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { exigirEmailConfirmado } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import {
  eventoPorSlug,
  esportesDoEvento,
  agruparPorTurno,
  inscricoesAbertas,
  situacaoInscricoes,
  vagasRestantes,
  igrejasParaEscolha,
} from "@/lib/eventos";
import { formatarData, formatarReais } from "@/lib/validacao";
import { avisoParcelas, parcelasDisponiveis } from "@/lib/parcelas";
import { FormularioInscricao } from "./FormularioInscricao";
import { Contagem } from "@/components/Contagem";
import { dataHoraBrasilia } from "@/components/ChamadaEvento";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ evento: string }>;
}): Promise<Metadata> {
  const { evento: slug } = await params;
  const evento = await eventoPorSlug(slug);
  return { title: evento ? `Inscrição — ${evento.nome}` : "Inscrição" };
}

export default async function PaginaInscricao({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;

  // Camada 2: guard de rota. Quem não confirmou nem chega a ver o formulário.
  const sessao = await exigirEmailConfirmado();

  const evento = await eventoPorSlug(slug);
  if (!evento) notFound();

  /*
   * Tour não tem inscrição — quem chegar aqui pelo endereço direto vai para a
   * página do evento, que explica que a entrada é franca.
   */
  if (!evento.tem_inscricao) redirect(`/${evento.slug}`);

  const situacao = situacaoInscricoes(evento);

  if (evento.publicado && situacao === "agendada" && evento.inscricoes_de) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <img src="/juca/nervoso.webp" alt="" className="mx-auto w-32" />
        <h1 className="mt-4 text-3xl">Quase lá!</h1>
        <p className="mt-2 text-apagado">
          As inscrições do {evento.nome} abrem {dataHoraBrasilia(evento.inscricoes_de)}. Deixe esta
          página aberta: o formulário aparece sozinho na hora.
        </p>
        <div className="mt-6 flex justify-center">
          <Contagem alvo={evento.inscricoes_de} titulo="Abre em" recarregarAoZerar />
        </div>
      </div>
    );
  }

  if (evento.publicado && situacao === "em_breve") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <img src="/juca/heh.webp" alt="" className="mx-auto w-32" />
        <h1 className="mt-4 text-3xl">Inscrições em breve</h1>
        <p className="mt-2 text-apagado">
          A diretoria ainda está fechando os detalhes do {evento.nome}. A data de abertura sai no
          Instagram e aqui no site.
        </p>
        <Link href={`/${evento.slug}`} className="botao-secundario mt-6">
          Ver o evento
        </Link>
      </div>
    );
  }

  if (!inscricoesAbertas(evento)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <img src="/juca/choro.webp" alt="" className="mx-auto w-32" />
        <h1 className="mt-4 text-3xl">Inscrições encerradas</h1>
        <p className="mt-2 text-apagado">
          As inscrições do {evento.nome} fecharam em{" "}
          {formatarData(evento.inscricoes_ate ?? evento.data_evento)}.
        </p>
        <Link href={`/${evento.slug}`} className="botao-secundario mt-6">
          Ver o evento
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [esportes, restantes, igrejas, { data: perfil }] = await Promise.all([
    esportesDoEvento(evento.id),
    vagasRestantes(evento),
    igrejasParaEscolha(),
    supabase.from("perfis").select("nome, telefone, igreja_id").eq("id", sessao.userId).maybeSingle(),
  ]);

  // A igreja do cadastro vem marcada — se ainda estiver na lista.
  const igrejaDoPerfil = igrejas.some((i) => i.id === perfil?.igreja_id) ? perfil!.igreja_id! : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm font-semibold tracking-wide text-laranja-escuro uppercase">
        {evento.nome}
      </p>
      <h1 className="mt-1 text-3xl">Inscrição</h1>
      <p className="mt-2 text-apagado">
        {formatarData(evento.data_evento)} · {evento.cidade} ·{" "}
        {formatarReais(evento.valor_centavos)} por pessoa
      </p>

      <FormularioInscricao
        evento={{
          slug: evento.slug,
          nome: evento.nome,
          dataEvento: evento.data_evento,
          idadeMinima: evento.idade_minima,
          maxParcelas: parcelasDisponiveis(evento),
          avisoParcelas: avisoParcelas(evento),
          maxEsportesPorTurno: evento.max_esportes_por_turno ?? 0,
          temModalidades: evento.tem_modalidades,
          valorCentavos: evento.valor_centavos,
        }}
        grupos={agruparPorTurno(esportes)}
        vagasRestantes={restantes}
        igrejas={igrejas}
        perfil={{
          nome: perfil?.nome ?? sessao.nome ?? "",
          igrejaId: igrejaDoPerfil,
          telefone: perfil?.telefone ?? "",
        }}
      />
    </div>
  );
}
