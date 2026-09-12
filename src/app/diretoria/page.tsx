import type { Metadata } from "next";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { eventosPublicados } from "@/lib/eventos";
import { formatarData, formatarReais, formatarCPF } from "@/lib/validacao";
import { CartaoValidacao } from "@/components/CartaoValidacao";
import { Exportar } from "@/components/Exportar";
import type { Comprovante, Evento, Inscricao, Inscrito } from "@/tipos/db";

export const metadata: Metadata = { title: "Diretoria" };

type Pendente = Comprovante & {
  inscricoes: Inscricao & { eventos: Evento; inscritos: Inscrito[] };
};

export default async function Diretoria() {
  await exigirDiretoria();
  const supabase = await createClient();

  const { data } = await supabase
    .from("comprovantes")
    .select("*, inscricoes(*, eventos(*), inscritos(*))")
    .is("aprovado", null)
    .order("enviado_em", { ascending: true });

  const pendentes = (data ?? []) as Pendente[];

  /*
   * Signed URL curta, gerada agora e só para quem já passou pela RLS.
   * O bucket é privado: comprovante de PIX mostra nome, banco e às vezes CPF.
   */
  const comLink = await Promise.all(
    pendentes.map(async (c) => {
      const { data: assinado } = await supabase.storage
        .from("comprovantes")
        .createSignedUrl(c.caminho, 60 * 10);
      return { ...c, url: assinado?.signedUrl ?? null };
    })
  );

  const eventos = await eventosPublicados();
  const { count: confirmadas } = await supabase
    .from("inscricoes")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmada");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl">Diretoria</h1>
      <p className="mt-2 text-apagado">
        {pendentes.length === 0
          ? "Nenhum comprovante esperando."
          : `${pendentes.length} comprovante${pendentes.length > 1 ? "s" : ""} para conferir.`}{" "}
        {confirmadas ?? 0} inscrições já confirmadas.
      </p>

      <Exportar eventos={eventos.map((e) => ({ slug: e.slug, nome: e.nome }))} />

      <section className="mt-8 space-y-5">
        {comLink.length === 0 ? (
          <div className="cartao flex items-center gap-4 p-6">
            <img src="/juca/joia.webp" alt="" className="w-16" />
            <p className="text-apagado">Fila limpa. Nada para validar agora.</p>
          </div>
        ) : (
          comLink.map((c) => (
            <CartaoValidacao
              key={c.id}
              codigo={c.inscricoes.codigo}
              evento={c.inscricoes.eventos.nome}
              data={formatarData(c.enviado_em.slice(0, 10))}
              valor={formatarReais(c.inscricoes.valor_centavos)}
              parcela={c.parcela}
              parcelas={c.inscricoes.parcelas}
              url={c.url}
              pessoas={c.inscricoes.inscritos.map((p) => ({
                nome: p.nome,
                cpf: formatarCPF(p.cpf),
                igreja: p.igreja,
              }))}
            />
          ))
        )}
      </section>
    </div>
  );
}
