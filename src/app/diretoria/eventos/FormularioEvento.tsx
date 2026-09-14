"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Girando } from "@/components/Girando";
import { Recado } from "@/components/Recado";
import { useAcao } from "@/lib/useAcao";
import { gerarBRCode } from "@/lib/pix";
import { formatarReais } from "@/lib/validacao";
import { ROTULO_TIPO, type Evento, type OpcaoIgreja, type TipoEvento } from "@/tipos/db";

const MENSAGEM: Record<string, string> = {
  pedido_invalido: "Confira os campos obrigatórios: nome, endereço do link, prefixo, data e cidade.",
  slug_repetido: "Já existe um evento com esse endereço de link. Troque o endereço.",
  prefixo_repetido:
    "Esse prefixo já é de outro evento — os códigos de inscrição iam se repetir. Use outro, por exemplo JD27.",
  data_fim_antes: "A data de término está antes da data de início.",
  abertura_sem_data: "Escolha a data e a hora em que as inscrições abrem.",
  fecha_depois_do_evento: "As inscrições não podem fechar depois do evento.",
  abre_depois_de_fechar: "As inscrições estão marcadas para abrir depois da data de fechamento.",
  pix_celular_sem_55:
    "Chave PIX de celular precisa do +55 na frente (ex.: +5545999990000). Sem isso o app do banco não acha a chave.",
  pix_incompleto: "Para publicar um evento pago, preencha chave PIX, recebedor e cidade.",
  tem_inscricoes: "Este evento já tem inscrições e não pode ser apagado. Despublique em vez de apagar.",
  sem_permissao: "Só administrador mexe nos eventos.",
  evento_nao_encontrado: "Evento não encontrado. Recarregue a página.",
};

const PADRAO: Record<TipoEvento, { temInscricao: boolean; temModalidades: boolean; prefixo: string }> = {
  jubigday: { temInscricao: true, temModalidades: true, prefixo: "JD" },
  congresso: { temInscricao: true, temModalidades: false, prefixo: "CC" },
  tour: { temInscricao: false, temModalidades: false, prefixo: "JT" },
};

type Abertura = "em_breve" | "agendada" | "abertas";

type Campos = {
  tipo: TipoEvento;
  nome: string;
  slug: string;
  prefixo: string;
  descricao: string;
  dataEvento: string;
  dataFim: string;
  horaInicio: string;
  cidade: string;
  localNome: string;
  localEndereco: string;
  localMapaUrl: string;
  igrejaId: string;
  temInscricao: boolean;
  temModalidades: boolean;
  valor: string;
  idadeMinima: string;
  maxParcelas: string;
  vagas: string;
  abertura: Abertura;
  inscricoesDe: string;
  inscricoesAte: string;
  trocaEsporteAteDias: string;
  maxEsportesPorTurno: string;
  pixChave: string;
  pixNome: string;
  pixCidade: string;
  publicado: boolean;
};

/** timestamptz → "2026-09-20T19:00" no horário de Brasília, o formato do <input type="datetime-local">. */
function paraCampoDataHora(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(" ", "T");
}

function inicial(e?: Evento): Campos {
  return {
    tipo: e?.tipo ?? "jubigday",
    nome: e?.nome ?? "",
    slug: e?.slug ?? "",
    prefixo: e?.prefixo ?? "JD",
    descricao: e?.descricao ?? "",
    dataEvento: e?.data_evento ?? "",
    dataFim: e?.data_fim ?? "",
    horaInicio: e?.hora_inicio?.slice(0, 5) ?? "",
    cidade: e?.cidade ?? "",
    localNome: e?.local_nome ?? "",
    localEndereco: e?.local_endereco ?? "",
    localMapaUrl: e?.local_mapa_url ?? "",
    igrejaId: e?.igreja_id ?? "",
    temInscricao: e?.tem_inscricao ?? true,
    temModalidades: e?.tem_modalidades ?? true,
    valor: e ? (e.valor_centavos / 100).toFixed(2).replace(".", ",") : "50,00",
    idadeMinima: String(e?.idade_minima ?? 12),
    maxParcelas: String(e?.max_parcelas ?? 1),
    vagas: e?.vagas ? String(e.vagas) : "",
    // Evento novo nasce "em breve": ninguém se inscreve num rascunho meio pronto.
    abertura: !e ? "em_breve" : e.inscricoes_em_breve ? "em_breve" : e.inscricoes_de ? "agendada" : "abertas",
    inscricoesDe: e?.inscricoes_de ? paraCampoDataHora(e.inscricoes_de) : "",
    inscricoesAte: e?.inscricoes_ate ?? "",
    trocaEsporteAteDias: String(e?.troca_esporte_ate_dias ?? 7),
    maxEsportesPorTurno: String(e?.max_esportes_por_turno ?? 0),
    pixChave: e?.pix_chave ?? "",
    pixNome: e?.pix_nome ?? "",
    pixCidade: e?.pix_cidade ?? "",
    publicado: e?.publicado ?? false,
  };
}

/** "JubigDay 2027" → "jubigday-2027" */
function paraSlug(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** "50,00" → 5000. NaN quando não é número. */
function paraCentavos(valor: string) {
  const limpo = valor.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
  return limpo === "" ? 0 : Math.round(Number(limpo) * 100);
}

const vazioNulo = (v: string) => (v.trim() ? v.trim() : null);

export function FormularioEvento({
  evento,
  igrejas,
  inscricoes = 0,
}: {
  evento?: Evento;
  igrejas: OpcaoIgreja[];
  inscricoes?: number;
}) {
  const router = useRouter();
  const acao = useAcao({ mensagens: MENSAGEM, sucesso: evento ? "Evento salvo." : undefined });
  const [f, setF] = useState<Campos>(() => inicial(evento));
  const [slugManual, setSlugManual] = useState(Boolean(evento));
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const mudar = <K extends keyof Campos>(campo: K, valor: Campos[K]) => setF((atual) => ({ ...atual, [campo]: valor }));

  const centavos = paraCentavos(f.valor);
  const podeTestarPix = Boolean(f.pixChave && f.pixNome && f.pixCidade && centavos > 0);
  const slugMudou = evento && f.slug !== evento.slug;

  function trocarTipo(tipo: TipoEvento) {
    setF((atual) => ({
      ...atual,
      tipo,
      temInscricao: PADRAO[tipo].temInscricao,
      temModalidades: PADRAO[tipo].temModalidades,
      // Prefixo só muda sozinho em evento novo: em evento com código emitido, trocar confunde.
      prefixo: evento ? atual.prefixo : PADRAO[tipo].prefixo,
    }));
  }

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    setErroLocal(null);

    if (f.temInscricao && Number.isNaN(centavos)) {
      setErroLocal("Valor inválido. Use o formato 50,00.");
      return;
    }

    const corpo = {
      ...(evento && { id: evento.id }),
      tipo: f.tipo,
      nome: f.nome,
      slug: f.slug,
      prefixo: f.prefixo,
      descricao: vazioNulo(f.descricao),
      dataEvento: f.dataEvento,
      dataFim: vazioNulo(f.dataFim),
      horaInicio: vazioNulo(f.horaInicio),
      cidade: f.cidade,
      localNome: vazioNulo(f.localNome),
      localEndereco: vazioNulo(f.localEndereco),
      localMapaUrl: vazioNulo(f.localMapaUrl),
      igrejaId: vazioNulo(f.igrejaId),
      temInscricao: f.temInscricao,
      temModalidades: f.temModalidades,
      valorCentavos: f.temInscricao ? centavos : 0,
      idadeMinima: Number(f.idadeMinima || 0),
      maxParcelas: Number(f.maxParcelas || 1),
      vagas: f.vagas ? Number(f.vagas) : null,
      abertura: f.abertura,
      inscricoesDe: f.abertura === "agendada" ? vazioNulo(f.inscricoesDe) : null,
      inscricoesAte: vazioNulo(f.inscricoesAte),
      trocaEsporteAteDias: Number(f.trocaEsporteAteDias || 0),
      maxEsportesPorTurno: Number(f.maxEsportesPorTurno || 0),
      pixChave: vazioNulo(f.pixChave),
      pixNome: vazioNulo(f.pixNome),
      pixCidade: vazioNulo(f.pixCidade),
      publicado: f.publicado,
    };

    const { ok, dados } = await acao.json("/api/admin/eventos", evento ? "PATCH" : "POST", corpo);
    if (ok && !evento) router.push(`/diretoria/eventos/${dados.id}`);
  }

  async function copiarPixTeste() {
    const br = gerarBRCode({
      chave: f.pixChave,
      nome: f.pixNome,
      cidade: f.pixCidade,
      valorCentavos: centavos,
      identificador: `${f.prefixo}TESTE`,
    });
    await navigator.clipboard.writeText(br).catch(() => null);
    setCopiado(true);
  }

  return (
    <form onSubmit={salvar} className="space-y-6" noValidate>
      {/* ---------------- Tipo ---------------- */}
      <fieldset className="cartao p-5">
        <legend className="titulo px-1 text-lg">Formato</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(Object.keys(PADRAO) as TipoEvento[]).map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer flex-col rounded-[10px] border-2 p-3 ${
                f.tipo === t ? "border-laranja bg-laranja/5" : "border-linha"
              }`}
            >
              <span className="flex items-center gap-2 font-semibold text-tinta">
                <input
                  type="radio"
                  name="tipo"
                  checked={f.tipo === t}
                  onChange={() => trocarTipo(t)}
                  className="accent-[#D94C1A]"
                />
                {ROTULO_TIPO[t]}
              </span>
              <span className="mt-1 text-xs text-apagado">
                {t === "jubigday" && "Inscrição paga, com modalidades"}
                {t === "congresso" && "Inscrição paga, sem modalidades"}
                {t === "tour" && "Visita a uma igreja, entrada franca"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ---------------- Básico ---------------- */}
      <fieldset className="cartao space-y-4 p-5">
        <legend className="titulo px-1 text-lg">Evento</legend>
        <Campo rotulo="Nome" obrigatorio>
          <input
            value={f.nome}
            onChange={(e) => {
              mudar("nome", e.target.value);
              if (!slugManual) mudar("slug", paraSlug(e.target.value));
            }}
            placeholder="JubigDay 2027"
            maxLength={120}
            className="campo-texto"
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Campo
            rotulo="Endereço do link"
            obrigatorio
            dica={
              slugMudou
                ? "Atenção: links já enviados por e-mail com o endereço antigo vão parar de funcionar."
                : `jubig-site.vercel.app/${f.slug || "..."}`
            }
            alerta={Boolean(slugMudou)}
          >
            <input
              value={f.slug}
              onChange={(e) => {
                setSlugManual(true);
                mudar("slug", paraSlug(e.target.value));
              }}
              className="campo-texto font-mono text-sm"
            />
          </Campo>
          <Campo rotulo="Prefixo do código" obrigatorio dica={`Inscrições saem como ${f.prefixo || "JD"}-0001`}>
            <input
              value={f.prefixo}
              onChange={(e) => mudar("prefixo", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
              className="campo-texto font-mono uppercase"
            />
          </Campo>
        </div>

        <Campo rotulo="Descrição" dica="Aparece na home e na página do evento.">
          <textarea
            value={f.descricao}
            onChange={(e) => mudar("descricao", e.target.value)}
            rows={3}
            maxLength={800}
            className="campo-texto"
          />
        </Campo>
      </fieldset>

      {/* ---------------- Data e local ---------------- */}
      <fieldset className="cartao space-y-4 p-5">
        <legend className="titulo px-1 text-lg">Data e local</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Data" obrigatorio>
            <input type="date" value={f.dataEvento} onChange={(e) => mudar("dataEvento", e.target.value)} className="campo-texto" />
          </Campo>
          <Campo rotulo="Término" dica="Só para eventos de vários dias.">
            <input type="date" value={f.dataFim} onChange={(e) => mudar("dataFim", e.target.value)} className="campo-texto" />
          </Campo>
          <Campo rotulo="Hora de início" dica="Usada na contagem regressiva.">
            <input type="time" value={f.horaInicio} onChange={(e) => mudar("horaInicio", e.target.value)} className="campo-texto" />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Cidade" obrigatorio>
            <input value={f.cidade} onChange={(e) => mudar("cidade", e.target.value)} maxLength={80} className="campo-texto" />
          </Campo>
          <Campo rotulo="Igreja anfitriã" dica="No JubigTour, o endereço sai da igreja.">
            <select value={f.igrejaId} onChange={(e) => mudar("igrejaId", e.target.value)} className="campo-texto">
              <option value="">Nenhuma</option>
              {igrejas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome} ({i.cidade})
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do local" dica="Ex.: Ginásio Municipal">
            <input value={f.localNome} onChange={(e) => mudar("localNome", e.target.value)} maxLength={120} className="campo-texto" />
          </Campo>
          <Campo rotulo="Endereço do local">
            <input value={f.localEndereco} onChange={(e) => mudar("localEndereco", e.target.value)} maxLength={200} className="campo-texto" />
          </Campo>
        </div>
        <Campo rotulo="Link do mapa" dica="Cole o link de compartilhar do Google Maps. Opcional.">
          <input
            type="url"
            value={f.localMapaUrl}
            onChange={(e) => mudar("localMapaUrl", e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            className="campo-texto"
          />
        </Campo>
      </fieldset>

      {/* ---------------- Inscrições ---------------- */}
      <fieldset className="cartao space-y-4 p-5">
        <legend className="titulo px-1 text-lg">Inscrições</legend>
        <Interruptor
          ligado={f.temInscricao}
          aoMudar={(v) => mudar("temInscricao", v)}
          rotulo="Este evento tem inscrição"
          dica="Desligado: entrada franca, sem formulário nem pagamento."
        />

        {f.temInscricao && (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">Situação</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["em_breve", "Em breve", "Aparece \"em breve\", sem data. Ninguém se inscreve."],
                    ["agendada", "Abrir em data e hora", "Contagem regressiva no site; abre sozinha."],
                    ["abertas", "Abertas agora", "O botão Inscrever aparece já."],
                  ] as [Abertura, string, string][]
                ).map(([valor, titulo, dica]) => (
                  <label
                    key={valor}
                    className={`flex cursor-pointer flex-col rounded-[10px] border-2 p-3 ${
                      f.abertura === valor ? "border-laranja bg-laranja/5" : "border-linha"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-tinta">
                      <input
                        type="radio"
                        name="abertura"
                        checked={f.abertura === valor}
                        onChange={() => mudar("abertura", valor)}
                        className="accent-[#D94C1A]"
                      />
                      {titulo}
                    </span>
                    <span className="mt-1 text-xs text-apagado">{dica}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {f.abertura === "agendada" && (
                <Campo rotulo="Abrem em" obrigatorio dica="Horário de Brasília.">
                  <input
                    type="datetime-local"
                    value={f.inscricoesDe}
                    onChange={(e) => mudar("inscricoesDe", e.target.value)}
                    className="campo-texto"
                  />
                </Campo>
              )}
              <Campo rotulo="Fecham em" dica="Vazio: fecham no dia do evento.">
                <input
                  type="date"
                  value={f.inscricoesAte}
                  onChange={(e) => mudar("inscricoesAte", e.target.value)}
                  className="campo-texto"
                />
              </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Vagas no evento" dica="Vazio: sem limite.">
                <input
                  type="number"
                  min={1}
                  value={f.vagas}
                  onChange={(e) => mudar("vagas", e.target.value)}
                  className="campo-texto"
                />
              </Campo>
              <Campo rotulo="Idade mínima" dica="Conta na data do evento.">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={f.idadeMinima}
                  onChange={(e) => mudar("idadeMinima", e.target.value)}
                  className="campo-texto"
                />
              </Campo>
            </div>

            <Interruptor
              ligado={f.temModalidades}
              aoMudar={(v) => mudar("temModalidades", v)}
              rotulo="Tem modalidades esportivas"
              dica="As modalidades em si são cadastradas em Diretoria > Modalidades."
            />

            {f.temModalidades && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Modalidades por turno" dica="Quantas cada pessoa escolhe no mesmo turno.">
                  <select
                    value={f.maxEsportesPorTurno}
                    onChange={(e) => mudar("maxEsportesPorTurno", e.target.value)}
                    className="campo-texto"
                  >
                    <option value="0">Sem limite</option>
                    <option value="1">Até 1</option>
                    <option value="2">Até 2</option>
                    <option value="3">Até 3</option>
                  </select>
                </Campo>
                <Campo rotulo="Troca de modalidade até" dica="Dias antes do evento.">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={f.trocaEsporteAteDias}
                    onChange={(e) => mudar("trocaEsporteAteDias", e.target.value)}
                    className="campo-texto"
                  />
                </Campo>
              </div>
            )}
          </>
        )}
      </fieldset>

      {/* ---------------- Pagamento ---------------- */}
      {f.temInscricao && (
        <fieldset className="cartao space-y-4 p-5">
          <legend className="titulo px-1 text-lg">Pagamento</legend>
          <p className="text-sm text-apagado">
            PIX copia e cola, gerado por inscrição. A diretoria confere cada comprovante em Pagamentos.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor por pessoa (R$)" obrigatorio dica={Number.isNaN(centavos) ? "Valor inválido" : formatarReais(centavos || 0)}>
              <input
                inputMode="decimal"
                value={f.valor}
                onChange={(e) => mudar("valor", e.target.value)}
                className="campo-texto"
              />
            </Campo>
            <Campo rotulo="Parcelas" dica="Cada parcela é um PIX e um comprovante à parte.">
              <select value={f.maxParcelas} onChange={(e) => mudar("maxParcelas", e.target.value)} className="campo-texto">
                <option value="1">Só à vista</option>
                <option value="2">Até 2x</option>
                <option value="3">Até 3x</option>
                <option value="4">Até 4x</option>
              </select>
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Chave PIX" dica="Celular com +55; CPF/CNPJ só números; ou e-mail.">
              <input
                value={f.pixChave}
                onChange={(e) => mudar("pixChave", e.target.value.trim())}
                placeholder="+5545999990000"
                className="campo-texto"
              />
            </Campo>
            <Campo rotulo="Recebedor" dica={`${f.pixNome.length}/25 letras`}>
              <input
                value={f.pixNome}
                onChange={(e) => mudar("pixNome", e.target.value.toUpperCase().slice(0, 25))}
                placeholder="JUVENTUDE BATISTA"
                className="campo-texto uppercase"
              />
            </Campo>
            <Campo rotulo="Cidade do recebedor" dica={`${f.pixCidade.length}/15 letras`}>
              <input
                value={f.pixCidade}
                onChange={(e) => mudar("pixCidade", e.target.value.toUpperCase().slice(0, 15))}
                placeholder="TOLEDO"
                className="campo-texto uppercase"
              />
            </Campo>
          </div>

          {podeTestarPix && (
            <div className="rounded-[10px] bg-areia p-4 text-sm">
              <p className="text-tinta">
                <strong>Teste antes de publicar:</strong> copie o PIX de {formatarReais(centavos)} e cole no app do
                banco. Se aparecer o recebedor certo, está pronto — não precisa pagar.
              </p>
              <button type="button" onClick={copiarPixTeste} className="botao-secundario mt-3">
                {copiado ? "Copiado ✓" : "Copiar PIX de teste"}
              </button>
            </div>
          )}
        </fieldset>
      )}

      {/* ---------------- Publicação ---------------- */}
      <fieldset className="cartao space-y-3 p-5">
        <legend className="titulo px-1 text-lg">Publicação</legend>
        <Interruptor
          ligado={f.publicado}
          aoMudar={(v) => mudar("publicado", v)}
          rotulo="Publicado no site"
          dica="Desligado, o evento some da home e do calendário. Inscrições feitas continuam valendo."
        />
        {evento && inscricoes > 0 && (
          <p className="text-xs text-apagado">
            {inscricoes} {inscricoes === 1 ? "inscrição feita" : "inscrições feitas"}. Mudar o valor não altera o
            que já foi cobrado delas.
          </p>
        )}
      </fieldset>

      <div className="sticky bottom-3 z-10 space-y-2">
        {(erroLocal || acao.erro || acao.feito) && (
          <Recado erro={erroLocal ?? acao.erro} sucesso={acao.feito} aoFechar={acao.limpar} />
        )}
        <button type="submit" disabled={acao.ocupado} aria-busy={acao.ocupado} className="botao-primario w-full py-4 shadow-lg">
          {acao.ocupado ? (
            <>
              <Girando />
              Salvando...
            </>
          ) : evento ? (
            "Salvar alterações"
          ) : (
            "Criar evento"
          )}
        </button>
      </div>
    </form>
  );
}

function Campo({
  rotulo,
  obrigatorio,
  dica,
  alerta,
  children,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  dica?: string;
  alerta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-tinta">
        {rotulo}
        {obrigatorio && <span className="ml-1 text-laranja">*</span>}
      </span>
      {children}
      {dica && <span className={`mt-1 block text-xs ${alerta ? "font-semibold text-ruim" : "text-apagado"}`}>{dica}</span>}
    </label>
  );
}

function Interruptor({
  ligado,
  aoMudar,
  rotulo,
  dica,
}: {
  ligado: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
  dica?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={ligado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[#D94C1A]"
      />
      <span>
        <span className="block font-semibold text-tinta">{rotulo}</span>
        {dica && <span className="block text-xs text-apagado">{dica}</span>}
      </span>
    </label>
  );
}

/** Apagar pede confirmação em dois passos; com inscrição, nem oferece. */
export function ApagarEvento({ id, inscricoes }: { id: string; inscricoes: number }) {
  const router = useRouter();
  const acao = useAcao({ mensagens: MENSAGEM, recarregar: false });
  const [confirmando, setConfirmando] = useState(false);

  if (inscricoes > 0) {
    return (
      <p className="mt-8 text-sm text-apagado">
        Este evento tem inscrições, então não pode ser apagado. Para tirar do site, desligue &quot;Publicado&quot;.
      </p>
    );
  }

  return (
    <section className="mt-8 rounded-[16px] border border-ruim/30 p-5">
      <p className="titulo text-lg text-ruim">Apagar evento</p>
      <p className="mt-1 text-sm text-apagado">Some junto a programação, as dúvidas e as modalidades dele.</p>
      {acao.erro && (
        <div className="mt-3">
          <Recado erro={acao.erro} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {confirmando ? (
          <>
            <button
              type="button"
              disabled={acao.ocupado}
              onClick={async () => {
                const { ok } = await acao.json("/api/admin/eventos", "DELETE", { id });
                if (ok) router.push("/diretoria/eventos");
              }}
              className="botao-primario bg-ruim hover:bg-ruim/85"
            >
              {acao.ocupado ? <Girando /> : null}
              Apagar de vez
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="botao-secundario">
              Voltar
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className="botao-secundario text-ruim">
            Apagar este evento
          </button>
        )}
      </div>
    </section>
  );
}
