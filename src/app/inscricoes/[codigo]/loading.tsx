import { PaginaEsqueleto } from "@/components/Esqueleto";

export default function Carregando() {
  // O QR do PIX é gerado no servidor; esta é a tela que mais espera.
  return <PaginaEsqueleto rotulo="Carregando a inscrição" cartoes={3} />;
}
