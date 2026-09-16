import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    /*
     * Carimbo do build, congelado no momento em que a Vercel compila.
     * Serve para responder "meu redeploy pegou?" sem ficar no chute: as
     * variáveis NEXT_PUBLIC_* só mudam com build novo, e sem esse carimbo
     * não há como distinguir página velha de variável faltando.
     */
    BUILD_EM: new Date().toISOString(),
    BUILD_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
  },

  /*
   * Cabeçalhos de segurança em todas as páginas.
   *
   * O risco concreto aqui é clickjacking: o formulário de inscrição e a tela
   * da diretoria dentro de um iframe em outro site, com a pessoa clicando sem
   * ver onde. `DENY` corta isso — o site não é embutido em lugar nenhum.
   *
   * A câmera fica liberada só para o próprio site, que é o leitor de QR da
   * validação; microfone e localização, para ninguém.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
