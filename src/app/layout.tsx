import type { Metadata, Viewport } from "next";
import { Archivo, Outfit } from "next/font/google";
import "./globals.css";
import { pegarSessao } from "@/lib/sessao";
import { AvisoEmailNaoConfirmado } from "@/components/AvisoEmailNaoConfirmado";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import { SemConfiguracao } from "@/components/SemConfiguracao";
import { faltandoConfiguracao } from "@/lib/supabase/config";
import { Analytics } from "@vercel/analytics/next";

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
  /*
   * Antes de qualquer consulta: sem as chaves do Supabase o cliente estoura
   * aqui mesmo, no layout, e aí nem a página de erro renderiza — o visitante
   * recebe um "Internal Server Error" sem uma linha de explicação.
   */
  const faltando = faltandoConfiguracao();
  if (faltando.length > 0) return <SemConfiguracao faltando={faltando} />;

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
        {/*
          Contagem de acessos da Vercel: sem cookie e sem identificar ninguém,
          então não precisa de aviso de consentimento. Os números aparecem na
          aba Analytics do projeto, não dentro do site — construir um painel
          de tráfego aqui seria refazer o que a hospedagem já dá pronto.
        */}
        <Analytics />
      </body>
    </html>
  );
}
