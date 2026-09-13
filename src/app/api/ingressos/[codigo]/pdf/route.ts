import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pegarSessao } from "@/lib/sessao";
import { ingressosDaInscricao } from "@/lib/ingressos";

const LARANJA = rgb(0xd9 / 255, 0x4c / 255, 0x1a / 255);
const TINTA = rgb(0x2a / 255, 0x17 / 255, 0x10 / 255);
const APAGADO = rgb(0x7a / 255, 0x63 / 255, 0x50 / 255);
const CREME = rgb(0xf8 / 255, 0xf1 / 255, 0xe0 / 255);

/**
 * As fontes padrão do PDF só conhecem o alfabeto latino básico. Acento
 * português passa; emoji ou caractere de outro alfabeto no nome faria o
 * pdf-lib estourar e a pessoa ficar sem ingresso nenhum.
 */
const seguro = (t: string) =>
  (t ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");

/** PDF com uma folha por pessoa. */
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const sessao = await pegarSessao();
  if (!sessao) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  const { codigo } = await params;
  const dados = await ingressosDaInscricao(codigo);
  if (!dados) return NextResponse.json({ erro: "nao_encontrada" }, { status: 404 });
  if (dados.status !== "confirmada")
    return NextResponse.json({ erro: "nao_confirmada" }, { status: 409 });

  const pdf = await PDFDocument.create();
  pdf.setTitle(seguro(`Ingressos ${dados.codigo} - ${dados.evento.nome}`));
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  // A6 em pé: cabe numa folha dobrada e na tela do celular sem zoom.
  const L = 298;
  const A = 420;

  for (const p of dados.pessoas) {
    const pagina = pdf.addPage([L, A]);

    pagina.drawRectangle({ x: 0, y: A - 56, width: L, height: 56, color: TINTA });
    pagina.drawRectangle({ x: 0, y: A - 60, width: L, height: 4, color: LARANJA });
    pagina.drawText("JU", { x: 18, y: A - 36, size: 20, font: negrito, color: CREME });
    pagina.drawText("BIG", {
      x: 18 + negrito.widthOfTextAtSize("JU", 20),
      y: A - 36,
      size: 20,
      font: negrito,
      color: LARANJA,
    });
    pagina.drawText(seguro(dados.evento.nome), {
      x: 18,
      y: A - 50,
      size: 8,
      font: normal,
      color: CREME,
      maxWidth: L - 36,
    });

    let y = A - 84;
    const linha = (rotulo: string, valor: string, tamanho = 9) => {
      pagina.drawText(seguro(rotulo).toUpperCase(), { x: 18, y, size: 6.5, font: normal, color: APAGADO });
      y -= tamanho + 3;
      pagina.drawText(seguro(valor), {
        x: 18,
        y,
        size: tamanho,
        font: negrito,
        color: TINTA,
        maxWidth: L - 36,
        lineHeight: tamanho + 2,
      });
      y -= tamanho + 9;
    };

    linha("Participante", p.nome, 14);
    linha("Igreja", p.igreja);
    linha("Quando", dados.evento.data);
    linha("Onde", dados.evento.local);
    if (p.modalidades.length) linha("Modalidades", p.modalidades.join(", "), 8);
    else if (p.deBoa) linha("Modalidades", "vai só de boa", 8);
    linha("Inscrição", dados.codigo);

    const png = await pdf.embedPng(Buffer.from(p.qr.split(",")[1], "base64"));
    const lado = 132;
    pagina.drawImage(png, { x: (L - lado) / 2, y: 30, width: lado, height: lado });
    const aviso = "Apresente este QR Code na portaria";
    pagina.drawText(aviso, {
      x: (L - normal.widthOfTextAtSize(aviso, 7.5)) / 2,
      y: 18,
      size: 7.5,
      font: normal,
      color: APAGADO,
    });
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="ingressos-${dados.codigo}.pdf"`,
      // Tem nome e igreja de gente: nada de cache compartilhado.
      "cache-control": "private, no-store",
    },
  });
}
