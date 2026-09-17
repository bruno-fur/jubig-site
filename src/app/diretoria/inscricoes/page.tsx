import type { Metadata } from "next";
import Link from "next/link";
import { exigirDiretoria } from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { todosOsUsuarios } from "@/lib/usuarios";
import { ListaInscricoes, type LinhaInscricao } from "./ListaInscricoes";
import type { StatusInscricao } from "@/tipos/db";

export const metadata: Metadata = { title: "Inscrições", robots: { index: false } };
export const dynamic = "force-dynamic";

type Bruta = {
  codigo: string;
  status: StatusInscricao;
  valor_centavos: number;
  parcelas: number;
  criado_em: string;
  responsavel_id: string;
  eventos: { id: string; nome: string };
  inscritos: { nome: string; cpf: string; igreja: string }[];
  comprovantes: { aprovado: boolean | null }[];
};

/** Controle de todas as inscrições, de todos os usuários. */
export default async function Inscricoes({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string; status?: string; responsavel?: string; q?: string }>;
}) {
  await exigirDiretoria();
  const filtros = await searchParams;
  const supabase = await createClient();

  const [{ data }, { data: eventos }, usuarios] = await Promise.all([
    supabase
      .from("inscricoes")
      .select(
        "codigo, status, valor_centavos, parcelas, criado_em, responsavel_id, eventos(id, nome), inscritos(nome, cpf, igreja), comprovantes(aprovado)"
      )
      .order("criado_em", { ascending: false })
      .limit(2000),
    supabase.from("eventos").select("id, nome").order("data_evento"),
    todosOsUsuarios(),
  ]);

  const conta = new Map(usuarios.map((u) => [u.id, u]));

  const linhas: LinhaInscricao[] = ((data ?? []) as unknown as Bruta[]).map((i) => ({
    codigo: i.codigo,
    status: i.status,
    valorCentavos: i.valor_centavos,
    criadoEm: i.criado_em,
    eventoId: i.eventos.id,
    evento: i.eventos.nome,
    responsavelId: i.responsavel_id,
    responsavel: conta.get(i.responsavel_id)?.nome || "(sem nome)",
    responsavelEmail: conta.get(i.responsavel_id)?.email ?? "",
    pessoas: i.inscritos.map((p) => ({ nome: p.nome, cpf: p.cpf, igreja: p.igreja })),
    comprovantesPendentes: i.comprovantes.filter((c) => c.aprovado === null).length,
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-apagado">
          Todas as inscrições, de todos os eventos. Quem chegou no dia e pagou na hora entra pelo balcão.
        </p>
        <Link href="/diretoria/inscricoes/balcao" className="botao-primario">
          + Inscrição no balcão
        </Link>
      </div>

      <ListaInscricoes
      linhas={linhas}
      eventos={(eventos ?? []) as { id: string; nome: string }[]}
      inicial={{
        evento: filtros.evento ?? "",
        status: filtros.status ?? "",
        responsavel: filtros.responsavel ?? "",
        q: filtros.q ?? "",
        }}
      />
    </>
  );
}
