/**
 * BR Code do PIX (padrão EMV do Banco Central).
 *
 * É um "copia e cola" estático: gera o mesmo texto que os bancos leem no QR.
 * Não confirma pagamento — para isso precisaria de PSP com API, que custa e
 * exige CNPJ. Aqui a confirmação continua sendo a diretoria olhando o
 * comprovante, que é como a JUBIG já trabalha.
 */

function campo(id: string, valor: string) {
  return id + String(valor.length).padStart(2, "0") + valor;
}

/** O BR Code só aceita ASCII: acento vira letra simples, resto some. */
function limpar(texto: string, max: number) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();
}

/** CRC16/CCITT-FALSE — polinômio 0x1021, início 0xFFFF. */
function crc16(texto: string) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

type Cobranca = {
  chave: string;
  nome: string;
  cidade: string;
  valorCentavos: number;
  /** vai no extrato do recebedor — usamos o código da inscrição */
  identificador?: string;
};

export function gerarBRCode({ chave, nome, cidade, valorCentavos, identificador }: Cobranca): string {
  const txid = limpar(identificador ?? "***", 25).replace(/[^A-Z0-9]/g, "") || "***";

  const conta =
    campo("00", "br.gov.bcb.pix") + campo("01", chave.trim());

  const payload =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", (valorCentavos / 100).toFixed(2)) +
    campo("58", "BR") +
    campo("59", limpar(nome, 25)) +
    campo("60", limpar(cidade, 15)) +
    campo("62", campo("05", txid)) +
    "6304";

  return payload + crc16(payload);
}
