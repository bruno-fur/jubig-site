import Link from "next/link";
import { eventosPublicados, inscricoesAbertas, vagasRestantes } from "@/lib/eventos";
import { formatarData, formatarReais } from "@/lib/validacao";
import { Galeria } from "@/components/Galeria";
import type { Evento } from "@/tipos/db";

const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM ?? "jubig.oficial";
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_DIRETORIA ?? "5545999999999";

export default async function Home() {
  const eventos = await eventosPublicados();
  const [destaque, ...proximos] = eventos;

  return (
    <>
      <Hero evento={destaque} />
      <QuemSomos />
      {proximos.length > 0 && <Proximos eventos={proximos} />}
      <Galeria limite={8} />
      <Contato />
    </>
  );
}

async function Hero({ evento }: { evento?: Evento }) {
  if (!evento) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <img src="/juca/feliz.webp" alt="" className="mx-auto w-36" />
        <h1 className="mt-4 text-4xl">A JUBIG está preparando o próximo encontro</h1>
        <p className="mt-3 text-apagado">
          Assim que as datas fecharem, as inscrições aparecem aqui.
        </p>
      </section>
    );
  }

  const restantes = await vagasRestantes(evento);
  const abertas = inscricoesAbertas(evento);
  const poucas = restantes !== null && restantes <= 20 && restantes > 0;

  return (
    <section className="border-b border-linha bg-areia">
      <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-14 sm:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-sm font-semibold tracking-wide text-laranja-escuro uppercase">
            Próximo encontro
          </p>
          <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">{evento.nome}</h1>
          <p className="mt-3 text-lg text-apagado">
            {formatarData(evento.data_evento)} · {evento.cidade}
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
            <Link href={`/${evento.slug}`} className="botao-secundario">
              Programação e local
            </Link>
          </div>

          {poucas && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-sm font-semibold text-laranja-escuro">
              <img src="/juca/susto.webp" alt="" className="h-7 w-7 object-contain" />
              Restam {restantes} vagas
            </p>
          )}
          {evento.inscricoes_ate && abertas && (
            <p className="mt-3 text-sm text-apagado">
              Inscrições até {formatarData(evento.inscricoes_ate)}.
            </p>
          )}
        </div>

        <img
          src={poucas ? "/juca/susto.webp" : "/juca/feliz.webp"}
          alt="Juca, o mascote da JUBIG"
          className="mx-auto w-48 sm:w-full sm:max-w-[260px]"
        />
      </div>
    </section>
  );
}

function QuemSomos() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <h2 className="text-3xl">Quem somos</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-3">
        <p className="text-apagado sm:col-span-2">
          A JUBIG reúne a juventude das igrejas batistas do oeste do Paraná. São encontros de
          esporte, música e comunhão que juntam caravanas de cidades inteiras — de Medianeira a
          Assis Chateaubriand, passando pela tríplice fronteira.
        </p>
        <div className="cartao p-5">
          <p className="titulo text-lg">Como participar</p>
          <ol className="mt-2 space-y-1 text-sm text-apagado">
            <li>1. Crie sua conta e confirme o e-mail</li>
            <li>2. Inscreva você ou a caravana da igreja</li>
            <li>3. Pague por PIX e envie o comprovante</li>
            <li>4. A diretoria confirma sua vaga</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function Proximos({ eventos }: { eventos: Evento[] }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <h2 className="text-3xl">Próximos eventos</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {eventos.map((e) => (
          <li key={e.id} className="cartao p-5">
            <p className="titulo text-lg">{e.nome}</p>
            <p className="mt-1 text-sm text-apagado">
              {formatarData(e.data_evento)} · {e.cidade}
            </p>
            <Link
              href={`/${e.slug}`}
              className="mt-3 inline-block text-sm font-semibold text-laranja-escuro hover:underline"
            >
              Ver detalhes
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Contato() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <div className="cartao flex flex-wrap items-center gap-6 p-7">
        <img src="/juca/heh.webp" alt="" className="w-24" />
        <div className="min-w-[240px] flex-1">
          <h2 className="text-2xl">Ficou com dúvida?</h2>
          <p className="mt-1 text-apagado">
            Fala com a diretoria no WhatsApp ou acompanha o dia a dia no Instagram.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer" className="botao-primario">
            WhatsApp
          </a>
          <a
            href={`https://instagram.com/${INSTAGRAM}`}
            target="_blank"
            rel="noreferrer"
            className="botao-secundario"
          >
            @{INSTAGRAM}
          </a>
        </div>
      </div>
    </section>
  );
}
