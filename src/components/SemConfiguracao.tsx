/**
 * Mostrada no lugar do site quando falta configuração do Supabase.
 *
 * Lista só o NOME das variáveis, nunca o valor. Nome de variável não é
 * segredo — e enquanto ela estiver faltando o site não funciona de qualquer
 * jeito, então não há o que proteger. O que se ganha é não passar uma tarde
 * procurando a causa de um "Internal Server Error" sem texto.
 */
export function SemConfiguracao({ faltando }: { faltando: string[] }) {
  /*
   * Os nomes (nunca os valores) das variáveis que este build realmente
   * enxergou com SUPABASE no nome.
   *
   * É o que separa as três causas possíveis, que de fora são idênticas:
   *   nome aparece diferente  -> erro de digitação no painel
   *   nenhum nome aparece     -> variável foi para outro projeto ou escopo
   *   nome aparece igual      -> a variável existe mas está vazia
   *
   * Nome de variável não é segredo, e a lista só aparece enquanto o site
   * estiver sem configuração — ou seja, enquanto não funciona de qualquer jeito.
   */
  /*
   * O filtro é frouxo de propósito. Procurar por "SUPABASE" não encontraria
   * "SUPBASE", que é exatamente o erro de digitação que se quer flagrar — o
   * nome errado some da lista e a tela volta a não explicar nada.
   */
  const vistas = Object.keys(process.env)
    .filter((k) => /SUP|BASE|ANON|SERVICE_ROLE/i.test(k))
    .sort();

  /*
   * Acesso por chave dinâmica. O Next substitui `process.env.NOME_LITERAL` no
   * momento do build; com a chave numa variável ele não consegue, e a leitura
   * acontece de verdade em runtime.
   *
   * Comparar os dois separa o que a lista de nomes não separa:
   *   vazio nos dois   -> a variável foi salva sem valor
   *   só runtime tem   -> o valor existe mas não chegou ao build
   *                       (na Vercel, é a marcação "Sensitive")
   */
  const env = process.env as Record<string, string | undefined>;
  const comparacao = faltando.map((nome) => ({
    nome,
    runtime: Boolean(env[nome]?.trim()),
  }));
  const soEmRuntime = comparacao.some((c) => c.runtime);

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
          <p style={{ margin: "0 0 10px", lineHeight: 1.6, color: "#7A6350", fontSize: 14 }}>
            O que este build <strong>enxergou</strong> com SUPABASE no nome:
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
            {vistas.length === 0 ? (
              <li style={{ color: "#C0392B" }}>
                nenhuma — as variáveis não chegaram a este projeto
              </li>
            ) : (
              vistas.map((v) => (
                <li key={v} style={{ padding: "3px 0" }}>
                  {v}
                </li>
              ))
            )}
          </ul>

          <p style={{ margin: "0 0 10px", lineHeight: 1.6, color: "#7A6350", fontSize: 14 }}>
            Valor conferido agora, em tempo de execução:
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
            {comparacao.map((c) => (
              <li key={c.nome} style={{ padding: "3px 0" }}>
                {c.nome} —{" "}
                <span style={{ color: c.runtime ? "#B44C13" : "#C0392B" }}>
                  {c.runtime ? "tem valor, mas não chegou ao build" : "sem valor"}
                </span>
              </li>
            ))}
          </ul>

          <p
            style={{
              margin: 0,
              lineHeight: 1.6,
              color: "#2A1710",
              fontSize: 14,
              padding: "14px 18px",
              background: "#EFE4CE",
              borderRadius: 10,
            }}
          >
            {soEmRuntime ? (
              <>
                <strong>O valor existe, mas o build não o recebeu.</strong> Na Vercel isso é a
                marcação <strong>Sensitive</strong> da variável: ela fica disponível só em tempo de
                execução. Variável <code>NEXT_PUBLIC_</code> precisa existir durante o build, porque
                o valor é embutido no JavaScript que vai para o navegador. Desmarque Sensitive
                nessas duas — a URL e a chave publishable são públicas por definição, quem protege
                os dados é a RLS. Depois, novo deploy.
              </>
            ) : (
              <>
                <strong>A variável existe com valor vazio.</strong> Na Vercel, abra cada uma no{" "}
                <code>⋯</code> → Edit e confira se o campo Value está preenchido — colar várias
                linhas de uma vez às vezes cria o nome e deixa o valor para trás. Depois, novo
                deploy.
              </>
            )}
          </p>
          <p style={{ margin: "10px 0 0", lineHeight: 1.6, color: "#7A6350", fontSize: 14 }}>
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
