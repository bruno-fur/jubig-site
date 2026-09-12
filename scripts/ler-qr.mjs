/**
 * Lê um QR Code de PIX e confere campo a campo contra o que o site gera.
 *
 *   npm run ler:qr -- caminho/do/qr.png
 *
 * Serve para uma coisa só: comparar o QR oficial do banco com o BR Code que
 * `src/lib/pix.ts` monta. Se os dois apontarem para a mesma chave e o mesmo
 * recebedor, o pagamento vai cair no lugar certo. É o tipo de conferência que
 * ninguém faz e que só aparece quando o dinheiro sumiu.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: npm run ler:qr -- caminho/do/qr.png   (aceita .png, .jpg)");
  process.exit(1);
}

const bytes = readFileSync(arquivo);
const ext = extname(arquivo).toLowerCase();

let imagem;
if (ext === ".png") {
  const png = PNG.sync.read(bytes);
  imagem = { data: png.data, width: png.width, height: png.height };
} else if (ext === ".jpg" || ext === ".jpeg") {
  const jpg = jpeg.decode(bytes, { useTArray: true });
  imagem = { data: jpg.data, width: jpg.width, height: jpg.height };
} else {
  console.error(`Formato ${ext} não suportado. Salve como PNG ou JPG.`);
  process.exit(1);
}

const lido = jsQR(new Uint8ClampedArray(imagem.data), imagem.width, imagem.height);
if (!lido) {
  console.error(
    "Não consegui ler o QR. Tente um print maior, sem corte e sem a borda cortada."
  );
  process.exit(1);
}

const texto = lido.data;
console.log("Conteúdo lido:\n" + texto + "\n");

/** Percorre o BR Code campo a campo (id de 2 dígitos + tamanho de 2 dígitos + valor). */
function campos(payload, prefixo = "") {
  const saida = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const tam = Number(payload.slice(i + 2, i + 4));
    if (!Number.isInteger(tam)) break;
    const valor = payload.slice(i + 4, i + 4 + tam);
    saida.push([prefixo + id, valor]);
    // 26 e 62 carregam outros campos dentro deles.
    if (id === "26" || id === "62") saida.push(...campos(valor, prefixo + id + "."));
    i += 4 + tam;
  }
  return saida;
}

const NOME = {
  "00": "formato do payload",
  "26": "conta do recebedor",
  "26.00": "arranjo (br.gov.bcb.pix)",
  "26.01": "CHAVE PIX",
  "52": "categoria do comerciante",
  "53": "moeda (986 = real)",
  "54": "VALOR",
  "58": "país",
  "59": "NOME DO RECEBEDOR",
  "60": "cidade",
  "62": "dados adicionais",
  "62.05": "identificador",
  "63": "CRC",
};

const lidos = campos(texto);

for (const [id, valor] of lidos) {
  const rotulo = NOME[id];
  if (!rotulo || id === "26" || id === "62") continue;
  console.log(`  ${id.padEnd(6)} ${rotulo.padEnd(26)} ${valor}`);
}

/*
 * O BR Code é posicional, não dá para procurar "54" com regex — "54" aparece
 * dentro de qualquer valor que tenha esses dígitos. Só a leitura campo a campo
 * diz se o valor está mesmo lá.
 */
const valor = lidos.find(([id]) => id === "54")?.[1];
console.log(
  valor
    ? `\nQR com valor fixo de R$ ${valor} — serve para uma cobrança só.`
    : "\nQR sem valor: quem paga digita o quanto quiser. É o normal do QR estático do banco."
);

const chave = lidos.find(([id]) => id === "26.01")?.[1];
if (chave && /^\d{11}$/.test(chave)) {
  console.log(
    `\nAtenção: a chave "${chave}" parece celular sem o +55. Chave de telefone no\n` +
      "DICT é +55DDNNNNNNNNN — assim o app do banco não acha a chave."
  );
}
