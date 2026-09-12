/**
 * Estado de cada variável de ambiente: só se tem valor, nunca o valor.
 *
 * Nome de variável e um "sim/não" não são segredo — o que protege os dados é
 * a RLS. O que se ganha é enxergar a falha silenciosa: sem as do Supabase o
 * site nem abre, mas sem GMAIL_SENHA_APP ele abre normalmente e simplesmente
 * não manda e-mail nenhum. Descobrir isso com as inscrições no ar significa
 * gente inscrita que nunca recebeu o código.
 */

export type Variavel = {
  nome: string;
  papel: string;
  semIsso: string;
  obrigatoria: boolean;
};

export const ESPERADAS: Variavel[] = [
  {
    nome: "NEXT_PUBLIC_SUPABASE_URL",
    papel: "endereço do projeto no Supabase",
    semIsso: "o site não abre",
    obrigatoria: true,
  },
  {
    nome: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    papel: "chave publishable, usada no navegador",
    semIsso: "o site não abre",
    obrigatoria: true,
  },
  {
    nome: "SUPABASE_SERVICE_ROLE_KEY",
    papel: "chave secret, só no servidor",
    semIsso: "a diretoria não abre comprovante nem aprova inscrição",
    obrigatoria: true,
  },
  {
    nome: "NEXT_PUBLIC_SITE_URL",
    papel: "endereço público do site",
    semIsso: "os links do e-mail podem apontar para o lugar errado",
    obrigatoria: false,
  },
  {
    nome: "GMAIL_USUARIO",
    papel: "conta que envia os e-mails",
    semIsso: "nenhum e-mail sai, sem erro na tela",
    obrigatoria: true,
  },
  {
    nome: "GMAIL_SENHA_APP",
    papel: "senha de app do Gmail",
    semIsso: "nenhum e-mail sai, sem erro na tela",
    obrigatoria: true,
  },
  {
    nome: "EMAIL_NOME_REMETENTE",
    papel: "nome que aparece na caixa de entrada",
    semIsso: 'usa "JUBIG"',
    obrigatoria: false,
  },
  {
    nome: "NEXT_PUBLIC_WHATSAPP_DIRETORIA",
    papel: "número do botão de WhatsApp",
    semIsso: "o botão leva para um número de exemplo",
    obrigatoria: false,
  },
  {
    nome: "NEXT_PUBLIC_INSTAGRAM",
    papel: "perfil do rodapé",
    semIsso: "usa um perfil de exemplo",
    obrigatoria: false,
  },
];

/**
 * Lê por chave dinâmica de propósito: o Next substitui
 * `process.env.NOME_LITERAL` no build, e com a chave numa variável a leitura
 * acontece de verdade em tempo de execução.
 */
export function lerVariaveis() {
  const env = process.env as Record<string, string | undefined>;
  return ESPERADAS.map((v) => ({ ...v, tem: Boolean(env[v.nome]?.trim()) }));
}

export function TabelaVariaveis({ escuro = false }: { escuro?: boolean }) {
  const linhas = lerVariaveis();
  const cor = {
    linha: escuro ? "#E0D3BC" : "#E0D3BC",
    apagado: "#7A6350",
    ruim: "#C0392B",
    ok: "#2E7D32",
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${cor.linha}`, color: cor.apagado }}>
          <th style={{ padding: "8px 12px 8px 0", fontWeight: 600 }}>Variável</th>
          <th style={{ padding: "8px 12px 8px 0", fontWeight: 600 }}>Para quê</th>
          <th style={{ padding: "8px 0", fontWeight: 600 }}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.nome} style={{ borderBottom: `1px solid ${cor.linha}`, verticalAlign: "top" }}>
            <td
              style={{
                padding: "12px 12px 12px 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                wordBreak: "break-all",
              }}
            >
              {l.nome}
            </td>
            <td style={{ padding: "12px 12px 12px 0", color: cor.apagado }}>
              {l.papel}
              {!l.tem && (
                <span style={{ display: "block", fontSize: 12, color: cor.ruim }}>
                  sem isso: {l.semIsso}
                </span>
              )}
            </td>
            <td style={{ padding: "12px 0", whiteSpace: "nowrap" }}>
              {l.tem ? (
                <span style={{ fontWeight: 600, color: cor.ok }}>preenchida</span>
              ) : l.obrigatoria ? (
                <span style={{ fontWeight: 600, color: cor.ruim }}>FALTA</span>
              ) : (
                <span style={{ color: cor.apagado }}>vazia (opcional)</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
