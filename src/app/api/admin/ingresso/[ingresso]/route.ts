import { NextResponse } from "next/server";
import { pegarSessao, papelDe } from "@/lib/sessao";
import { dadosDoIngresso } from "@/lib/ingressos";

/** O que o leitor da portaria mostra depois de ler o QR. */
export async function GET(_req: Request, { params }: { params: Promise<{ ingresso: string }> }) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  if (!(await papelDe(sessao.userId)))
    return NextResponse.json({ erro: "sem_permissao" }, { status: 403 });

  const { ingresso } = await params;
  const dados = await dadosDoIngresso(ingresso);
  if (!dados) return NextResponse.json({ erro: "nao_encontrado" }, { status: 404 });

  return NextResponse.json(dados, { headers: { "cache-control": "private, no-store" } });
}
