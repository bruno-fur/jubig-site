import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/lib/sessao";
import { igrejasParaEscolha } from "@/lib/eventos";
import { FormularioEvento } from "../FormularioEvento";

export const metadata: Metadata = { title: "Novo evento", robots: { index: false } };

export default async function NovoEvento() {
  await exigirAdmin();
  const igrejas = await igrejasParaEscolha();

  return (
    <>
      <Link href="/diretoria/eventos" className="text-sm font-semibold text-apagado hover:underline">
        ← Eventos
      </Link>
      <h2 className="titulo mt-2 mb-5 text-2xl">Novo evento</h2>
      <FormularioEvento igrejas={igrejas} />
    </>
  );
}
