/**
 * Mostrada no lugar do site quando falta configuração do Supabase.
 *
 * Lista só o NOME das variáveis, nunca o valor. Nome de variável não é
 * segredo — e enquanto ela estiver faltando o site não funciona de qualquer
 * jeito, então não há o que proteger. O que se ganha é não passar uma tarde
 * procurando a causa de um "Internal Server Error" sem texto.
 */
export function SemConfiguracao({ faltando }: { faltando: string[] }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#F8F1E0",
          color: "#2A1710",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: 560 }}>
          <img src="/juca/nervoso.webp" alt="" width={110} style={{ display: "block" }} />
          <h1 style={{ fontSize: 26, margin: "16px 0 8px" }}>Site sem configuração</h1>
          <p style={{ margin: "0 0 16px", lineHeight: 1.6, color: "#7A6350" }}>
            O site subiu, mas não consegue falar com o banco. Faltam estas variáveis de ambiente:
          </p>
          <ul
            style={{
              margin: "0 0 20px",
              padding: "14px 18px",
              background: "#fff",
              border: "1px solid #E0D3BC",
              borderRadius: 10,
              listStyle: "none",
              fontFamily: "ui-monospace, monospace",
              fontSize: 14,
            }}
          >
            {faltando.map((v) => (
              <li key={v} style={{ padding: "3px 0" }}>
                {v}
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, lineHeight: 1.6, color: "#7A6350", fontSize: 14 }}>
            Na Vercel: Settings → Environment Variables. Elas são congeladas no build, então{" "}
            <strong>é preciso um novo deploy</strong> depois de salvar — recarregar a página não
            resolve.
          </p>
          <p style={{ margin: "14px 0 0", color: "#7A6350", fontSize: 12.5, fontFamily: "ui-monospace, monospace" }}>
            build {process.env.BUILD_COMMIT} · {process.env.BUILD_EM?.replace("T", " ").slice(0, 16)} UTC
          </p>
        </main>
      </body>
    </html>
  );
}
