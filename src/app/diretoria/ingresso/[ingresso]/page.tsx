import type { Metadata } from "next";
import Link from "next/link";
import { exigirDiretoria } from "@/lib/sessao";
import { dadosDoIngresso } from "@/lib/ingressos";
import { ValidarIngresso } from "./ValidarIngresso";

export const metadata: Metadata = { title: "Validar ingresso", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Para onde o QR aponta.
 *
 * Quem é da diretoria e lê com a câmera comum do celular cai aqui direto. O
 * layout de /diretoria já barra quem não é — e barra antes de qualquer consulta.
 */
export default async function PaginaIngresso({ params }: { params: Promise<{ ingresso: string }> }) {
  await exigirDiretoria();
  const { ingresso } = await params;
  const dados = await dadosDoIngresso(ingresso);

  if (!dados) {
    return (
      <div className="cartao p-7 text-center">
        <img src="/juca/nao.webp" alt="" className="mx-auto w-28" />
        <h2 className="titulo mt-3 text-2xl">Ingresso não encontrado</h2>
        <p className="mt-2 text-apagado">
          Esse QR não pertence a nenhuma inscrição. Pode ser ingresso de outro sistema ou um print
          adulterado.
        </p>
        <Link href="/diretoria/portaria" className="botao-primario mt-6">
          Ler outro
        </Link>
      </div>
    );
  }

  return <ValidarIngresso inicial={dados} />;
}
