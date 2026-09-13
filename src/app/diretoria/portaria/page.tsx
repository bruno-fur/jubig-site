import type { Metadata } from "next";
import { exigirDiretoria } from "@/lib/sessao";
import { LeitorQR } from "./LeitorQR";

export const metadata: Metadata = { title: "Portaria", robots: { index: false } };

export default async function Portaria() {
  await exigirDiretoria();
  return (
    <>
      <p className="mb-4 text-apagado">
        Aponte a câmera para o QR Code do ingresso. Aparece a pessoa, a situação da inscrição e o
        botão de confirmar a entrada — cada ingresso entra uma vez só.
      </p>
      <LeitorQR />
    </>
  );
}
