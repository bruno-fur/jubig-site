/**
 * Encolhe a foto do comprovante no navegador, antes de subir.
 *
 * Foto de celular hoje sai com 2 a 4 MB, e o comprovante do PIX é um print
 * com texto grande: 1600px de lado e WebP a 82% deixa o arquivo em ~300 KB e
 * continua legível para quem confere. Com 250 inscrições, isso é a diferença
 * entre 750 MB e 80 MB no plano gratuito do Supabase — que dá 1 GB.
 *
 * Também economiza a franquia de transferência: cada vez que a diretoria abre
 * um comprovante, o arquivo é baixado de novo.
 *
 * Se qualquer coisa der errado (navegador antigo, imagem que o canvas não lê,
 * resultado maior que o original), devolve o arquivo como veio. Comprovante
 * que sobe grande é melhor do que comprovante que não sobe.
 */

const LADO_MAX = 1600;
const QUALIDADE = 0.82;

/** Abaixo disso não compensa: já está pequeno e o recorte só perderia nitidez. */
const MINIMO = 400 * 1024;

export type Comprimido = { arquivo: File; original: number };

export async function comprimirImagem(arquivo: File): Promise<Comprimido> {
  const igual = { arquivo, original: arquivo.size };

  if (!arquivo.type.startsWith("image/") || arquivo.size <= MINIMO) return igual;

  try {
    // `from-image` respeita o EXIF: foto tirada deitada não sobe de lado.
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const ctx = tela.getContext("2d");
    if (!ctx) return igual;

    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      tela.toBlob(resolve, "image/webp", QUALIDADE)
    );
    if (!blob || blob.size >= arquivo.size) return igual;

    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".webp";
    return {
      arquivo: new File([blob], nome, { type: "image/webp", lastModified: Date.now() }),
      original: arquivo.size,
    };
  } catch (e) {
    console.error("[comprimir] não deu, sobe como veio", e);
    return igual;
  }
}

/** "2,8 MB" — para a tela mostrar o antes e o depois. */
export function tamanhoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
