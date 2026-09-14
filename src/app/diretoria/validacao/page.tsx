import type { Metadata } from "next";
import { exigirDiretoria } from "@/lib/sessao";
import { LeitorQR } from "./LeitorQR";

export const metadata: Metadata = { title: "Validação", robots: { index: false } };

export default async function Validacao() {
  await exigirDiretoria();
  return <LeitorQR />;
}
