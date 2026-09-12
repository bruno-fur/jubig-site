import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/*
 * eslint-config-next 16 já vem em flat config. Passar por FlatCompat aqui
 * estoura com "Converting circular structure to JSON".
 */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      /*
       * As figurinhas do Juca já são WebP pequenas e de tamanho fixo; o QR do
       * PIX é data: URI e o comprovante é signed URL que vence em 10 minutos.
       * Em nenhum desses o next/image ajuda — ele só acrescentaria um proxy no
       * meio. Vale reavaliar para as fotos da galeria, que são as únicas
       * imagens grandes do site.
       */
      "@next/next/no-img-element": "off",
    },
  },
  { ignores: [".next/**", "node_modules/**", "scripts/**"] },
];

export default config;
