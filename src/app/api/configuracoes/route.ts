import { NextResponse } from "next/server";
import { lerConfiguracoes } from "@/lib/configuracoes";

/**
 * Contatos públicos, para a tela de erro — ela roda no navegador e não
 * consegue ler o banco sozinha.
 */
export async function GET() {
  const { whatsapp, instagram } = await lerConfiguracoes();
  return NextResponse.json({ whatsapp, instagram });
}
