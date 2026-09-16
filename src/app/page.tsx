import { agendaCompleta, daquiPraFrente, hojeISO, igrejasAtivas, eventoPorSlug, vagasRestantes } from "@/lib/eventos";
import { formatarData } from "@/lib/validacao";
import { lerConfiguracoes } from "@/lib/configuracoes";
import { postagensInstagram, type PostagemInstagram } from "@/lib/instagram";
import { Galeria } from "@/components/Galeria";
import { Calendario } from "@/components/Calendario";
import { MapaIgrejas } from "@/components/MapaIgrejas";
import { ChamadaEvento } from "@/components/ChamadaEvento";
import { ROTULO_TIPO, RESUMO_TIPO, type Igreja, type ItemAgenda } from "@/tipos/db";

export default async function Home() {
  const hoje = hojeISO();
  const [agenda, igrejas, config, instagram] = await Promise.all([
    agendaCompleta(),
    igrejasAtivas(),
    lerConfiguracoes(),
    postagensInstagram(),
  ]);
  const futuros = daquiPraFrente(agenda, hoje);

  return (
    <>
      <Hero item={futuros[0]} />
      <Faixa itens={futuros} />
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

/**
 * Hero.
 *
 * Ocupa a largura toda no computador — antes o site inteiro vivia numa coluna
 * de 1024px e, num notebook, parecia a versão de celular esticada. As manchas
 * de cor no fundo e o Juca boiando são CSS puro: nada baixado a mais.
 */
async function Hero({ item }: { item?: ItemAgenda }) {
  if (!item) {
    return (
      <section className="relative overflow-hidden border-b border-linha bg-areia">
        <Manchas />
        <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <img src="/juca/feliz.webp" alt="" className="flutua mx-auto w-36" />
          <h1 className="mt-4 text-4xl sm:text-5xl">A JUBIG está preparando o próximo encontro</h1>
          <p className="mt-3 text-lg text-apagado">
            Assim que as datas fecharem, tudo aparece aqui no calendário.
          </p>
        </div>
      </section>
    );
  }

  // O hero é o único lugar que precisa do evento inteiro: vagas, prazo e abertura.
  const evento = await eventoPorSlug(item.slug);
  const restantes = evento ? await vagasRestantes(evento) : null;
  const poucas = restantes !== null && restantes <= 20 && restantes > 0;

  return (
    <section className="relative overflow-hidden border-b border-linha bg-areia">
      <Manchas />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-wide text-laranja-escuro uppercase">
            Próximo encontro
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] normal-case shadow-sm">
              {ROTULO_TIPO[item.tipo]}
            </span>
          </p>

          <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl xl:text-7xl">
            {item.nome}
          </h1>

          <p className="mt-4 text-lg text-apagado lg:text-xl">
            {item.data_fim && item.data_fim !== item.data_evento
              ? `${formatarData(item.data_evento)} a ${formatarData(item.data_fim)}`
              : formatarData(item.data_evento)}{" "}
            · {item.igreja_nome ?? item.cidade}
          </p>

          {item.descricao && (
            <p className="mt-4 max-w-prose text-tinta/80 lg:text-lg">{item.descricao}</p>
          )}

          {evento && <ChamadaEvento evento={evento} restantes={restantes} detalhes />}
        </div>

        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <img
            src={poucas ? "/juca/susto.webp" : "/juca/feliz.webp"}
            alt="Juca, o mascote da JUBIG"
            className="flutua mx-auto w-52 drop-shadow-2xl sm:w-64 lg:w-full lg:max-w-[380px]"
          />
        </div>
      </div>
    </section>
  );
}

/** Manchas de cor no fundo do hero. Decorativas: escondidas de leitor de tela. */
function Manchas() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="mancha absolute -top-24 -left-20 block h-72 w-72 rounded-full bg-laranja/25" />
      <span
        className="mancha absolute -right-16 bottom-0 block h-80 w-80 rounded-full bg-ok/15"
        style={{ animationDelay: "-5s" }}
      />
    </div>
  );
}

/**
 * Faixa rolante com o que vem por aí.
 *
 * A lista é repetida duas vezes e a animação anda metade da largura: o corte
 * cai exatamente onde a segunda cópia começa, e o laço fica invisível.
 */
function Faixa({ itens }: { itens: ItemAgenda[] }) {
  const partes = itens.length
    ? itens.map((i) => `${i.nome} · ${formatarData(i.data_evento)}`)
    : ["Esporte", "Louvor", "Comunhão", "Caravana da sua igreja"];
  const dobrada = [...partes, ...partes, ...partes, ...partes];

  return (
    <div className="overflow-hidden border-b border-linha bg-tinta py-3 text-creme">
      <div aria-hidden="true" className="faixa-rolante flex w-max gap-8 whitespace-nowrap">
        {dobrada.map((t, i) => (
          <span key={i} className="flex items-center gap-8 text-sm font-semibold tracking-wide uppercase">
            {t}
            <span className="text-laranja">◆</span>
          </span>
        ))}
      </div>
    </div>
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
    <nav aria-label="Seções do site" className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        {itens.map((i) => (
          <li key={i.href}>
            <a href={i.href} className="cartao realce flex h-full items-center gap-2 p-3 lg:gap-3 lg:p-4">
              <img src={`/juca/${i.figura}.webp`} alt="" className="h-9 w-9 object-contain lg:h-12 lg:w-12" />
              <span className="text-sm font-semibold text-tinta lg:text-base">{i.titulo}</span>
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
    <section id="quem-somos" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <h2 className="revelar text-3xl lg:text-4xl">Quem somos</h2>

      <div className="revelar mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
        {texto ? (
          <p className="whitespace-pre-line text-apagado lg:text-lg lg:leading-relaxed">{texto}</p>
        ) : (
          <p className="text-apagado lg:text-lg lg:leading-relaxed">
            A JUBIG reúne a juventude das igrejas batistas do oeste do Paraná. São encontros de
            esporte, música e comunhão que juntam caravanas de cidades inteiras — de Medianeira a
            Assis Chateaubriand, passando pela tríplice fronteira.
          </p>
        )}

        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {(["jubigday", "congresso", "tour"] as const).map((tipo) => (
            <li key={tipo} className="cartao realce p-4">
              <p className="titulo text-lg text-laranja-escuro">{ROTULO_TIPO[tipo]}</p>
              <p className="mt-1 text-sm text-apagado">{RESUMO_TIPO[tipo]}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Agenda({ agenda, hoje }: { agenda: ItemAgenda[]; hoje: string }) {
  if (agenda.length === 0) return null;
  const futuros = daquiPraFrente(agenda, hoje).length;

  return (
    <section
      id="agenda"
      className="scroll-mt-24 border-y border-linha bg-white/60 py-14 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="revelar text-3xl lg:text-4xl">Calendário</h2>
        <p className="revelar mt-2 text-apagado lg:text-lg">
          {futuros > 0
            ? `${futuros} ${futuros === 1 ? "encontro marcado" : "encontros marcados"}. Tudo que já rolou fica abaixo.`
            : "O que já rolou. As próximas datas aparecem aqui assim que fecharem."}
        </p>
        <div className="revelar">
          <Calendario itens={agenda} hoje={hoje} />
        </div>
      </div>
    </section>
  );
}

function Onde({ igrejas }: { igrejas: Igreja[] }) {
  if (igrejas.length === 0) return null;

  return (
    <section id="onde" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <h2 className="revelar text-3xl lg:text-4xl">Onde estamos</h2>
      <p className="revelar mt-2 text-apagado lg:text-lg">
        {igrejas.length} {igrejas.length === 1 ? "igreja" : "igrejas e congregações"} batistas no
        oeste do Paraná.
      </p>

      {/* Mapa fixo à esquerda e lista rolando à direita: no computador, dá para
          procurar a igreja sem perder o mapa de vista. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-24">
          <MapaIgrejas igrejas={igrejas} />
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:max-h-[540px] lg:grid-cols-1 lg:overflow-y-auto lg:pr-2 xl:grid-cols-2">
          {igrejas.map((i) => (
            <li key={i.id} className="cartao realce p-4">
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
      </div>
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
    <section
      id="instagram"
      className="scroll-mt-24 border-y border-linha bg-white/60 py-14 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="revelar flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-3xl lg:text-4xl">No Instagram</h2>
          <a
            href={`https://instagram.com/${usuario}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-laranja-escuro hover:underline"
          >
            Seguir @{usuario}
          </a>
        </div>

        <ul className="revelar mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {postagens.map((p) => (
            <li key={p.id}>
              <a
                href={p.link}
                target="_blank"
                rel="noreferrer"
                className="realce relative block overflow-hidden rounded-[16px] border border-linha bg-white"
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
      </div>
    </section>
  );
}

function Contato({ whatsapp, instagram }: { whatsapp: string; instagram: string }) {
  return (
    <section id="contato" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="revelar cartao flex flex-wrap items-center gap-6 p-7 lg:p-10">
        <img src="/juca/heh.webp" alt="" className="w-24 lg:w-32" />
        <div className="min-w-[240px] flex-1">
          <h2 className="text-2xl lg:text-3xl">Ficou com dúvida?</h2>
          <p className="mt-1 text-apagado lg:text-lg">
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
