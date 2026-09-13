import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirLogin } from "@/lib/sessao";
import { ingressosDaInscricao } from "@/lib/ingressos";
import { BotaoImprimir } from "./BotaoImprimir";

export const metadata: Metadata = { title: "Ingressos", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Um ingresso por pessoa, pronto para imprimir.
 *
 * Imprimir sai uma pessoa por folha (`break-after-page`), para a caravana
 * recortar e cada um levar o seu. O PDF é o mesmo conteúdo, para quem vai
 * mostrar no celular ou mandar no grupo.
 */
export default async function Ingressos({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  await exigirLogin();

  const dados = await ingressosDaInscricao(codigo);
  if (!dados) notFound();

  if (dados.status !== "confirmada") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <img src="/juca/nervoso.webp" alt="" className="mx-auto w-32" />
        <h1 className="mt-4 text-3xl">Os ingressos saem depois da confirmação</h1>
        <p className="mt-2 text-apagado">
          Assim que a diretoria confirmar todo o pagamento da inscrição {dados.codigo}, os
          ingressos com QR Code aparecem aqui e você recebe um e-mail.
        </p>
        <Link href={`/inscricoes/${dados.codigo}`} className="botao-primario mt-6">
          Ver a inscrição
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 print:max-w-none print:p-0">
      <div className="print:hidden">
        <h1 className="text-3xl">Ingressos</h1>
        <p className="mt-2 text-apagado">
          {dados.evento.nome} · inscrição {dados.codigo} · {dados.pessoas.length}{" "}
          {dados.pessoas.length === 1 ? "pessoa" : "pessoas"}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a href={`/api/ingressos/${dados.codigo}/pdf`} className="botao-primario">
            Baixar PDF
          </a>
          <BotaoImprimir />
        </div>

        <p className="mt-3 text-sm text-apagado">
          Cada pessoa apresenta o próprio QR Code na portaria — no celular ou impresso. Não mande
          print para quem não é da caravana: o ingresso só entra uma vez.
        </p>
      </div>

      <ul className="mt-8 space-y-6 print:mt-0 print:space-y-0">
        {dados.pessoas.map((p) => (
          <li
            key={p.ingresso}
            className="cartao overflow-hidden break-inside-avoid print:rounded-none print:border-0 print:break-after-page"
          >
            <div className="bg-tinta px-5 py-4 text-creme print:[print-color-adjust:exact]">
              <p className="titulo text-lg">
                JU<span className="text-laranja">BIG</span>
                <span className="ml-2 text-sm font-normal text-creme/70">{dados.evento.nome}</span>
              </p>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-xs tracking-wide text-apagado uppercase">Participante</p>
                <p className="titulo text-2xl leading-tight">{p.nome}</p>
                <p className="mt-1 text-apagado">{p.igreja}</p>

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-apagado">Quando</dt>
                    <dd className="font-semibold text-tinta">{dados.evento.data}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-apagado">Onde</dt>
                    <dd className="font-semibold text-tinta">{dados.evento.local}</dd>
                  </div>
                  {p.modalidades.length > 0 && (
                    <div className="flex gap-2">
                      <dt className="text-apagado">Modalidades</dt>
                      <dd className="font-semibold text-tinta">{p.modalidades.join(", ")}</dd>
                    </div>
                  )}
                  {p.deBoa && (
                    <div className="flex gap-2">
                      <dt className="text-apagado">Modalidades</dt>
                      <dd className="font-semibold text-tinta">vai só de boa</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="text-apagado">Inscrição</dt>
                    <dd className="font-mono font-semibold text-tinta">{dados.codigo}</dd>
                  </div>
                </dl>

                {p.checkinEm && (
                  <p className="mt-3 inline-block rounded-full bg-ok/10 px-3 py-1 text-xs font-semibold text-ok print:hidden">
                    Entrada já registrada
                  </p>
                )}
              </div>

              <figure className="mx-auto text-center">
                <img
                  src={p.qr}
                  alt={`QR Code do ingresso de ${p.nome}`}
                  width={220}
                  height={220}
                  className="rounded-[10px] border border-linha bg-white"
                />
                <figcaption className="mt-1 text-xs text-apagado">Apresente na portaria</figcaption>
              </figure>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
