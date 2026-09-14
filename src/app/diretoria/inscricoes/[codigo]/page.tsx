import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { comprovantesComLink } from "@/lib/comprovantes";
import {
  formatarCPF,
  formatarData,
  formatarDataCurta,
  formatarReais,
  formatarTelefone,
  idadeNaData,
} from "@/lib/validacao";
import { SeloStatus } from "@/components/SeloStatus";
import { ListaComprovantes } from "@/components/ListaComprovantes";
import { CancelarInscricao } from "@/components/CancelarInscricao";
import { CartaoValidacao } from "@/components/CartaoValidacao";
import { ROTULO_TURNO, type Comprovante, type Inscricao, type Turno } from "@/tipos/db";
import { descreverEscolha } from "@/lib/modalidades";

export const metadata: Metadata = { title: "Inscrição", robots: { index: false } };
export const dynamic = "force-dynamic";

type Linha = Inscricao & {
  eventos: { nome: string; slug: string; data_evento: string };
  inscritos: {
    id: string;
    nome: string;
    cpf: string;
    nascimento: string;
    telefone: string | null;
    igreja: string;
    de_boa: boolean;
    checkin_em?: string | null;
    inscritos_esportes: {
      nota?: number | null;
      parceiros?: string[] | null;
      esportes: { nome: string; turno: Turno } | null;
    }[];
  }[];
  comprovantes: Comprovante[];
};

/** Tudo de uma inscrição, para a diretoria: pessoas, comprovantes, ações. */
export default async function DetalheInscricao({ params }: { params: Promise<{ codigo: string }> }) {
  const sessao = await exigirDiretoria();
  const { codigo } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("inscricoes")
    .select(
      "*, eventos(nome, slug, data_evento), inscritos(*, inscritos_esportes(*, esportes(nome, turno))), comprovantes(*)"
    )
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();

  const i = data as unknown as Linha | null;
  if (!i) notFound();

  // E-mail do responsável só existe em auth.users: service role, depois do guard.
  const admin = criarClienteAdmin();
  const [{ data: dono }, { data: perfis }] = await Promise.all([
    admin.auth.admin.getUserById(i.responsavel_id),
    admin
      .from("perfis")
      .select("id, nome, telefone")
      .in("id", [i.responsavel_id, i.cancelada_por].filter(Boolean) as string[]),
  ]);
  const perfil = (id: string | null) => perfis?.find((p) => p.id === id);

  const comprovantes = await comprovantesComLink(supabase, i.comprovantes);
  const pendente = comprovantes.find((c) => c.aprovado === null);
  const cancelada = i.status === "cancelada";
  const ehMinha = i.responsavel_id === sessao.userId;

  return (
    <div className="space-y-6">
      <Link href="/diretoria/inscricoes" className="text-sm font-semibold text-laranja-escuro hover:underline">
        ← Todas as inscrições
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-laranja-escuro uppercase">{i.eventos.nome}</p>
          <h2 className="titulo text-3xl">{i.codigo}</h2>
          <p className="text-apagado">
            Criada em {new Date(i.criado_em).toLocaleString("pt-BR")} · {formatarReais(i.valor_centavos)}
            {i.parcelas > 1 && ` em ${i.parcelas} parcelas`}
          </p>
        </div>
        <SeloStatus status={i.status} />
      </header>

      {cancelada && (
        <div className="rounded-[16px] border border-linha bg-areia/60 p-4 text-sm">
          <p className="font-semibold text-tinta">Cancelada</p>
          {i.cancelada_em && (
            <p className="text-apagado">
              {new Date(i.cancelada_em).toLocaleString("pt-BR")}
              {perfil(i.cancelada_por)?.nome && ` por ${perfil(i.cancelada_por)?.nome}`}
            </p>
          )}
          {i.motivo_cancelamento && <p className="mt-1 text-tinta">Motivo: {i.motivo_cancelamento}</p>}
        </div>
      )}

      <section className="cartao p-5">
        <h3 className="titulo text-lg">Responsável</h3>
        <p className="mt-1 font-semibold text-tinta">{perfil(i.responsavel_id)?.nome || "(sem nome)"}</p>
        <p className="text-sm break-all text-apagado">{dono?.user?.email ?? "—"}</p>
        {perfil(i.responsavel_id)?.telefone && (
          <p className="text-sm text-apagado">{formatarTelefone(perfil(i.responsavel_id)!.telefone!)}</p>
        )}
        <Link
          href={`/diretoria/inscricoes?responsavel=${i.responsavel_id}`}
          className="mt-2 inline-block text-sm font-semibold text-laranja-escuro hover:underline"
        >
          Outras inscrições desta conta
        </Link>
      </section>

      <section className="cartao divide-y divide-linha">
        <h3 className="titulo p-5 pb-3 text-lg">
          {i.inscritos.length} {i.inscritos.length === 1 ? "pessoa" : "pessoas"}
        </h3>
        {i.inscritos.map((p) => (
          <div key={p.id} className="grid gap-1 p-5 text-sm sm:grid-cols-2">
            <p className="font-semibold text-tinta sm:col-span-2">{p.nome}</p>
            <p className="text-apagado">CPF {formatarCPF(p.cpf)}</p>
            <p className="text-apagado">
              {formatarDataCurta(p.nascimento)} · {idadeNaData(p.nascimento, i.eventos.data_evento)} anos no evento
            </p>
            <p className="text-apagado">{p.igreja}</p>
            <p className="text-apagado">{p.telefone ? formatarTelefone(p.telefone) : "sem telefone"}</p>
            <p className="text-tinta sm:col-span-2">
              {p.de_boa
                ? "Vai só de boa"
                : p.inscritos_esportes
                    .map((x) =>
                      x.esportes
                        ? [`${x.esportes.nome} (${ROTULO_TURNO[x.esportes.turno]})`, descreverEscolha(x)].filter(Boolean).join(" — ")
                        : ""
                    )
                    .filter(Boolean)
                    .join(", ") || "Sem modalidade"}
            </p>
            {p.checkin_em && (
              <p className="text-xs font-semibold text-ok sm:col-span-2">
                Entrou em {new Date(p.checkin_em).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        ))}
      </section>

      {pendente && !cancelada && (
        <CartaoValidacao
          codigo={i.codigo}
          evento={i.eventos.nome}
          data={formatarData(pendente.enviado_em.slice(0, 10))}
          valor={formatarReais(i.valor_centavos)}
          parcela={pendente.parcela}
          parcelas={i.parcelas}
          url={pendente.url}
          pessoas={i.inscritos.map((p) => ({ nome: p.nome, cpf: formatarCPF(p.cpf), igreja: p.igreja }))}
        />
      )}

      <section className="cartao p-5">
        <h3 className="titulo text-lg">Histórico de comprovantes</h3>
        <div className="mt-2">
          <ListaComprovantes comprovantes={comprovantes} parcelas={i.parcelas} />
        </div>
      </section>

      {!cancelada && (
        <section className="cartao p-5">
          <h3 className="titulo text-lg">Cancelar</h3>
          <p className="mt-1 mb-3 text-sm text-apagado">
            {i.status === "confirmada"
              ? "Esta inscrição está paga. Combine a devolução do PIX com a pessoa antes ou depois de cancelar — o site não devolve dinheiro."
              : "A pessoa recebe um e-mail com o motivo."}
          </p>
          <CancelarInscricao codigo={i.codigo} motivoObrigatorio={!ehMinha} pessoas={i.inscritos.length} />
        </section>
      )}
    </div>
  );
}
