import type { Metadata, Viewport } from "next";
import { Archivo, Outfit } from "next/font/google";
import "./globals.css";
import { pegarSessao } from "@/lib/sessao";
import { AvisoEmailNaoConfirmado } from "@/components/AvisoEmailNaoConfirmado";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";

const titulo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--fonte-titulo",
  display: "swap",
});

const texto = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fonte-texto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "JUBIG — Juventude Batista do Iguaçu", template: "%s · JUBIG" },
  description:
    "Encontros, esportes e inscrições da juventude das igrejas batistas do oeste do Paraná.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "JUBIG",
  },
};

export const viewport: Viewport = {
  themeColor: "#2A1710",
  // O formulário tem campo pequeno; deixar o pinch livre é acessibilidade básica.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessao = await pegarSessao();

  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {/*
          Regra do projeto: quem não confirmou o e-mail vê isto em toda página
          logada, desde o primeiro login — nunca só no fim do formulário.
        */}
        {sessao && !sessao.emailConfirmado && <AvisoEmailNaoConfirmado email={sessao.email} />}
        <Cabecalho sessao={sessao} />
        <main className="flex-1">{children}</main>
        <Rodape />
      </body>
    </html>
  );
}
