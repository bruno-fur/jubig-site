import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { exigirLogin } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { gerarBRCode } from "@/lib/pix";
import { formatarData, formatarReais, formatarCPF } from "@/lib/validacao";
import { ROTULO_STATUS, type Comprovante, type Evento, type Inscricao, type Inscrito } from "@/tipos/db";
import { CopiaECola } from "@/components/CopiaECola";
import { EnvioComprovante } from "@/components/EnvioComprovante";
import { SeloStatus } from "@/components/SeloStatus";

export const metadata: Metadata = { title: "Pagamento da inscrição" };

type Linha = Inscricao & { eventos: Evento; inscritos: Inscrito[]; comprovantes: Comprovante[] };

export default async function PaginaPagamento({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  await exigirLogin();

  /*
   * Sem filtro de dono aqui de propósito: quem garante é a RLS. Se a inscrição
   * for de outra pessoa, a consulta volta vazia e cai no notFound.
   */
  const supabase = await createClient();
  const { data } = await supabase
    .from("inscricoes")
    .select("*, eventos(*), inscritos(*), comprovantes(*)")
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  const inscricao = data as Linha | null;
  if (!inscricao) notFound();

  const evento = inscricao.eventos;
  const pagos = inscricao.comprovantes.filter((c) => c.aprovado !== false).length;
  const faltaParcela = Math.min(pagos + 1, inscricao.parcelas);
  const valorParcela = Math.ceil(inscricao.valor_centavos / inscricao.parcelas);
  const quitado = pagos >= inscricao.parcelas;

  const podeCobrar = Boolean(evento.pix_chave && evento.pix_nome && evento.pix_cidade);
  const brcode = podeCobrar
    ? gerarBRCode({
        chave: evento.pix_chave!,
        nome: evento.pix_nome!,
        cidade: evento.pix_cidade!,
        valorCentavos: valorParcela,
        identificador: inscricao.codigo.replace("-", ""),
      })
    : null;
  const qr = brcode ? await QRCode.toDataURL(brcode, { margin: 1, width: 260 }) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-laranja-escuro uppercase">
            {evento.nome}
          </p>
          <h1 className="mt-1 text-3xl">Inscrição {inscricao.codigo}</h1>
          <p className="mt-1 text-apagado">
            {formatarData(evento.data_evento)} · {evento.cidade}
          </p>
        </div>
        <SeloStatus status={inscricao.status} />
      </div>

      {inscricao.status === "recusada" && inscricao.motivo_recusa && (
        <div className="mt-6 flex gap-4 rounded-[16px] border border-ruim/30 bg-ruim/5 p-5">
          <img src="/juca/choro.webp" alt="" className="h-16 w-16 shrink-0 object-contain" />
          <div>
            <p className="font-semibold text-ruim">A diretoria recusou o comprovante</p>
            <p className="mt-1 text-sm text-tinta">{inscricao.motivo_recusa}</p>
            <p className="mt-2 text-sm text-apagado">
              Envie outro comprovante abaixo — a inscrição continua guardada.
            </p>
          </div>
        </div>
      )}

      <section className="mt-6 cartao divide-y divide-linha">
        {inscricao.inscritos.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold text-tinta">{p.nome}</p>
              <p className="text-sm text-apagado">
                {formatarCPF(p.cpf)} · {p.igreja}
              </p>
            </div>
            {p.de_boa && <span className="text-xs text-apagado">só de boa</span>}
          </div>
        ))}
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-apagado">
            {inscricao.inscritos.length}{" "}
            {inscricao.inscritos.length === 1 ? "pessoa" : "pessoas"}
            {inscricao.parcelas > 1 && ` · ${inscricao.parcelas} parcelas`}
          </span>
          <span className="titulo text-xl">{formatarReais(inscricao.valor_centavos)}</span>
        </div>
      </section>

      {quitado ? (
        <div className="mt-6 flex items-center gap-4 rounded-[16px] border border-ok/30 bg-ok/5 p-5">
          <img src="/juca/nervoso.webp" alt="" className="h-16 w-16 object-contain" />
          <p className="text-sm text-tinta">
            Comprovante{inscricao.parcelas > 1 ? "s" : ""} enviado
            {inscricao.parcelas > 1 ? "s" : ""}. A diretoria confere e você recebe o aviso por
            e-mail.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6 cartao p-5">
            <h2 className="titulo text-xl">
              Pagar por PIX
              {inscricao.parcelas > 1 && ` — parcela ${faltaParcela} de ${inscricao.parcelas}`}
            </h2>

            {inscricao.parcelas > 1 && (
              <p className="mt-1 text-sm text-apagado">
                O PIX não parcela sozinho. Cada parcela é um pagamento e um comprovante à parte.
              </p>
            )}

            {brcode && qr ? (
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <img
                  src={qr}
                  alt="QR Code do PIX"
                  width={200}
                  height={200}
                  className="rounded-[10px] border border-linha bg-white p-2"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-apagado">Valor desta parcela</p>
                  <p className="titulo text-2xl">{formatarReais(valorParcela)}</p>
                  <CopiaECola texto={brcode} />
                  <p className="mt-3 text-xs text-apagado">
                    Recebedor: {evento.pix_nome} · {evento.pix_cidade}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-[10px] bg-areia px-4 py-3 text-sm text-apagado">
                A chave PIX deste evento ainda não foi cadastrada. Fale com a diretoria.
              </p>
            )}
          </section>

          <EnvioComprovante codigo={inscricao.codigo} parcela={faltaParcela} />
        </>
      )}

      <p className="mt-8 text-center text-sm text-apagado">
        Guarde o código <strong>{inscricao.codigo}</strong>. Status atual:{" "}
        {ROTULO_STATUS[inscricao.status]}.{" "}
        <Link href="/minhas-inscricoes" className="font-semibold text-laranja-escuro hover:underline">
          Ver todas as inscrições
        </Link>
      </p>
    </div>
  );
}
