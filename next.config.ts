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
};

export default nextConfig;
