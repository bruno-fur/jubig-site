import { TabelaVariaveis } from "./TabelaVariaveis";

/**
 * Mostrada no lugar do site quando falta configuração do Supabase.
 *
 * Não usa nada do layout normal — fontes, CSS e cabeçalho ficam de fora de
 * propósito, porque o layout raiz é justamente o que não conseguiu rodar.
 *
 * Lista nomes de variável e um "tem valor / não tem", nunca o valor. Nome de
 * variável não é segredo, e enquanto ela estiver faltando o site não funciona
 * de qualquer jeito. O que se ganha é não passar uma tarde procurando a causa
 * de um "Internal Server Error" sem texto.
 */
export function SemConfiguracao({ faltando }: { faltando: string[] }) {
  /*
   * Os nomes que o build enxergou de fato. Filtro frouxo de propósito:
   * procurar por "SUPABASE" não encontraria "SUPBASE", que é exatamente o
   * erro de digitação que se quer flagrar.
   */
  const vistas = Object.keys(process.env)
    .filter((k) => /SUP|BASE|ANON|SERVICE_ROLE/i.test(k))
    .sort();

  const semNomeParecido = vistas.length === 0;

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#F8F1E0",
          color: "#2A1710",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "32px 24px",
        }}
      >
        <main style={{ maxWidth: 720, margin: "0 auto" }}>
          <img src="/juca/nervoso.webp" alt="" width={110} style={{ display: "block" }} />
          <h1 style={{ fontSize: 26, margin: "16px 0 8px" }}>Site sem configuração</h1>
          <p style={{ margin: "0 0 24px", lineHeight: 1.6, color: "#7A6350" }}>
            O site subiu, mas não consegue falar com o banco. Falta{faltando.length > 1 ? "m" : ""}{" "}
            {faltando.join(" e ")}.
          </p>

          <div
            style={{
              background: "#fff",
              border: "1px solid #E0D3BC",
              borderRadius: 10,
              padding: "4px 18px 8px",
              marginBottom: 20,
            }}
          >
            <TabelaVariaveis />
          </div>

          {semNomeParecido ? (
            <p
              style={{
                margin: 0,
                padding: "14px 18px",
                background: "#EFE4CE",
                borderRadius: 10,
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              <strong>Nenhuma variável parecida chegou a este build.</strong> Elas foram salvas em
              outro projeto ou em outro escopo da Vercel. Confira o seletor de projeto no topo do
              painel.
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                padding: "14px 18px",
                background: "#EFE4CE",
                borderRadius: 10,
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              Na Vercel, abra cada variável marcada como FALTA em <code>⋯</code> → Edit e confira o
              campo <strong>Value</strong> — colar várias linhas de uma vez cria o nome e deixa o
              valor para trás. Se o valor estiver lá, desmarque <strong>Sensitive</strong> nas que
              começam com <code>NEXT_PUBLIC_</code>: assim marcadas, elas não chegam ao build, e é
              no build que o valor é embutido no JavaScript do navegador.
            </p>
          )}

          <p style={{ margin: "14px 0 0", lineHeight: 1.6, color: "#7A6350", fontSize: 14 }}>
            Depois de salvar, <strong>é preciso um novo deploy</strong> — recarregar a página não
            resolve.
          </p>
          <p
            style={{
              margin: "18px 0 0",
              color: "#7A6350",
              fontSize: 12.5,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            build {process.env.BUILD_COMMIT} ·{" "}
            {process.env.BUILD_EM?.replace("T", " ").slice(0, 16)} UTC
          </p>
        </main>
      </body>
    </html>
  );
}
