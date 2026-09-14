import { agendaCompleta, daquiPraFrente, hojeISO, igrejasAtivas, eventoPorSlug, vagasRestantes } from "@/lib/eventos";
import { formatarData } from "@/lib/validacao";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { postagensInstagram, type PostagemInstagram } from "@/lib/instagram";
import { Galeria } from "@/components/Galeria";
import { Calendario } from "@/components/Calendario";
import { MapaIgrejas } from "@/components/MapaIgrejas";
import { ChamadaEvento } from "@/components/ChamadaEvento";
import { ROTULO_TIPO, type Igreja, type ItemAgenda } from "@/tipos/db";

export default async function Home() {
  const hoje = hojeISO();
  const [agenda, igrejas, config, instagram] = await Promise.all([
    agendaCompleta(),
    igrejasAtivas(),
    lerConfiguracoes(),
    postagensInstagram(),
  ]);
  const destaque = daquiPraFrente(agenda, hoje)[0];

  return (
    <>
      <Hero item={destaque} />
      <Atalhos temAgenda={agenda.length > 0} temIgrejas={igrejas.length > 0} />
      <QuemSomos texto={config.quemSomos} />
      <Agenda agenda={agenda} hoje={hoje} />
      <Onde igrejas={igrejas} />
      <Instagram usuario={instagram.usuario ?? config.instagram} postagens={instagram.postagens} />
      <Galeria limite={8} />
      <Contato whatsapp={config.whatsapp} instagram={config.instagram} />
    </>
  );
}

async function Hero({ item }: { item?: ItemAgenda }) {
  if (!item) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <img src="/juca/feliz.webp" alt="" className="mx-auto w-36" />
        <h1 className="mt-4 text-4xl">A JUBIG está preparando o próximo encontro</h1>
        <p className="mt-3 text-apagado">
          Assim que as datas fecharem, tudo aparece aqui no calendário.
        </p>
      </section>
    );
  }

  // O hero é o único lugar que precisa do evento inteiro: vagas, prazo e abertura.
  const evento = await eventoPorSlug(item.slug);
  const restantes = evento ? await vagasRestantes(evento) : null;
  const poucas = restantes !== null && restantes <= 20 && restantes > 0;

  return (
    <section className="border-b border-linha bg-areia">
      <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-14 sm:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-wide text-laranja-escuro uppercase">
            Próximo encontro
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] normal-case">
              {ROTULO_TIPO[item.tipo]}
            </span>
          </p>
          <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">{item.nome}</h1>
          <p className="mt-3 text-lg text-apagado">
            {item.data_fim && item.data_fim !== item.data_evento
              ? `${formatarData(item.data_evento)} a ${formatarData(item.data_fim)}`
              : formatarData(item.data_evento)}{" "}
            · {item.igreja_nome ?? item.cidade}
          </p>
          {item.descricao && <p className="mt-4 max-w-prose text-tinta/80">{item.descricao}</p>}

          {evento && <ChamadaEvento evento={evento} restantes={restantes} detalhes />}
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

/** Leva direto às seções de baixo — no celular, rolar tudo é longo. */
function Atalhos({ temAgenda, temIgrejas }: { temAgenda: boolean; temIgrejas: boolean }) {
  const itens = [
    { href: "#quem-somos", titulo: "Quem somos", figura: "heh" },
    temAgenda && { href: "#agenda", titulo: "Calendário", figura: "joia" },
    temIgrejas && { href: "#onde", titulo: "Onde estamos", figura: "feliz" },
    { href: "#contato", titulo: "Falar com a gente", figura: "choque" },
  ].filter(Boolean) as { href: string; titulo: string; figura: string }[];

  return (
    <nav aria-label="Seções do site" className="mx-auto max-w-5xl px-4 pt-10">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {itens.map((i) => (
          <li key={i.href}>
            <a
              href={i.href}
              className="cartao flex h-full items-center gap-2 p-3 transition hover:border-laranja"
            >
              <img src={`/juca/${i.figura}.webp`} alt="" className="h-9 w-9 object-contain" />
              <span className="text-sm font-semibold text-tinta">{i.titulo}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Texto editável em Diretoria > Site; sem texto cadastrado, fica o padrão. */
function QuemSomos({ texto }: { texto: string | null }) {
  return (
    <section id="quem-somos" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14">
      <h2 className="text-3xl">Quem somos</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-3">
        {texto ? (
          <p className="whitespace-pre-line text-apagado sm:col-span-2">{texto}</p>
        ) : (
          <p className="text-apagado sm:col-span-2">
            A JUBIG reúne a juventude das igrejas batistas do oeste do Paraná. São encontros de
            esporte, música e comunhão que juntam caravanas de cidades inteiras — de Medianeira a
            Assis Chateaubriand, passando pela tríplice fronteira.
          </p>
        )}
        <div className="cartao p-5">
          <p className="titulo text-lg">O que a gente faz</p>
          <ul className="mt-2 space-y-2 text-sm text-apagado">
            <li>
              <strong className="text-tinta">JubigDay</strong> — um dia inteiro de modalidades
              esportivas, com inscrição por caravana.
            </li>
            <li>
              <strong className="text-tinta">Congresso</strong> — vários dias de louvor e palavra,
              com inscrição.
            </li>
            <li>
              <strong className="text-tinta">JubigTour</strong> — a gente visita as igrejas da
              união. Entrada franca.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Agenda({ agenda, hoje }: { agenda: ItemAgenda[]; hoje: string }) {
  if (agenda.length === 0) return null;
  const futuros = daquiPraFrente(agenda, hoje).length;

  return (
    <section id="agenda" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14">
      <h2 className="text-3xl">Calendário</h2>
      <p className="mt-2 text-apagado">
        {futuros > 0
          ? `${futuros} ${futuros === 1 ? "encontro marcado" : "encontros marcados"}. Tudo que já rolou fica abaixo.`
          : "O que já rolou. As próximas datas aparecem aqui assim que fecharem."}
      </p>
      <Calendario itens={agenda} hoje={hoje} />
    </section>
  );
}

function Onde({ igrejas }: { igrejas: Igreja[] }) {
  if (igrejas.length === 0) return null;

  return (
    <section id="onde" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14">
      <h2 className="text-3xl">Onde estamos</h2>
      <p className="mt-2 text-apagado">
        {igrejas.length} {igrejas.length === 1 ? "igreja" : "igrejas"} batistas no oeste do Paraná.
      </p>

      <div className="mt-5">
        <MapaIgrejas igrejas={igrejas} />
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {igrejas.map((i) => (
          <li key={i.id} className="cartao p-4">
            <p className="font-semibold text-tinta">{i.nome}</p>
            <p className="text-sm text-apagado">
              {i.cidade} · {i.estado}
            </p>
            {i.endereco && <p className="mt-1 text-sm text-apagado">{i.endereco}</p>}

            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {i.endereco && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${i.nome}, ${i.endereco}, ${i.cidade}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-laranja-escuro hover:underline"
                >
                  Como chegar
                </a>
              )}
              {i.instagram && (
                <a
                  href={`https://instagram.com/${i.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-apagado hover:text-tinta hover:underline"
                >
                  @{i.instagram}
                </a>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Últimas postagens, pela API oficial. Sem conta conectada ou sem postagem
 * guardada, a seção não aparece — nada de caixa vazia na home.
 */
function Instagram({ usuario, postagens }: { usuario: string; postagens: PostagemInstagram[] }) {
  if (postagens.length === 0) return null;

  return (
    <section id="instagram" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-3xl">No Instagram</h2>
        <a
          href={`https://instagram.com/${usuario}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-laranja-escuro hover:underline"
        >
          Seguir @{usuario}
        </a>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {postagens.map((p) => (
          <li key={p.id}>
            <a
              href={p.link}
              target="_blank"
              rel="noreferrer"
              className="relative block overflow-hidden rounded-[16px] border border-linha bg-white hover:border-laranja"
            >
              <img
                src={p.imagem}
                alt={p.legenda ? p.legenda.slice(0, 140) : `Postagem de @${usuario}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-square w-full object-cover"
              />
              {p.tipo === "VIDEO" && (
                <span className="absolute top-2 right-2 rounded-full bg-tinta/75 px-2 py-0.5 text-[11px] font-semibold text-creme">
                  vídeo
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Contato({ whatsapp, instagram }: { whatsapp: string; instagram: string }) {
  return (
    <section id="contato" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14">
      <div className="cartao flex flex-wrap items-center gap-6 p-7">
        <img src="/juca/heh.webp" alt="" className="w-24" />
        <div className="min-w-[240px] flex-1">
          <h2 className="text-2xl">Ficou com dúvida?</h2>
          <p className="mt-1 text-apagado">
            Fala com a diretoria no WhatsApp ou acompanha o dia a dia no Instagram.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="botao-primario">
            WhatsApp
          </a>
          <a
            href={`https://instagram.com/${instagram}`}
            target="_blank"
            rel="noreferrer"
            className="botao-secundario"
          >
            @{instagram}
          </a>
        </div>
      </div>
    </section>
  );
}
