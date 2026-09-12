# Site da JUBIG

Site de divulgação e inscrições da Juventude Batista do Iguaçu.
Next.js 16 + Supabase + Resend, hospedado na Vercel.

```bash
npm install
npm run dev             # http://localhost:3000
npm run build           # precisa passar sem erro antes de subir
npm run verificar       # CPF, idade, máscaras, telefone e BR Code do PIX
npm run testar:schema   # aplica o SQL num Postgres descartável e testa as regras
```

`testar:schema` precisa do Docker aberto. Ele sobe um Postgres do zero, roda
`schema.sql` e `seed.sql`, confere 22 regras (RLS, CPF duplicado, idade, vaga,
conflito de horário, prazo de troca) e derruba o container. **Rode antes de
colar qualquer alteração de SQL no Supabase** — é a diferença entre achar um
erro aqui e achar no banco com inscrição de gente de verdade dentro.

---

## Colocar no ar — os passos manuais

Só os passos abaixo precisam de você. Todo o resto está no código.

### 1. Banco

No SQL Editor do Supabase, rode nesta ordem:

1. `supabase/schema.sql` — tabelas, RLS, triggers e os buckets.
2. `supabase/seed.sql` — JubigDay 2026, modalidades e dúvidas.

Os dois são idempotentes: pode rodar de novo depois de editar. Os dois já
rodam limpos em `npm run testar:schema`, então erro aqui é sinal de que a
edição quebrou alguma coisa — rode o teste local antes de insistir.

Os `NOTICE: ... does not exist, skipping` que aparecem são normais: são os
`drop ... if exists` do começo de cada bloco.

**Antes de abrir para o público**, edite a linha do evento:

```sql
update eventos set
  pix_chave  = 'a-chave-pix-da-jubig',
  pix_nome   = 'JUVENTUDE BATISTA',      -- máx 25 caracteres, sem acento
  pix_cidade = 'ASSIS CHATEAUBRIAND',    -- máx 15 caracteres, sem acento
  publicado  = true
where slug = 'jubigday-2026';
```

Sem `pix_chave` a tela de pagamento aparece sem QR e sem copia e cola.

### 2. Quem é da diretoria

A pessoa cria a conta pelo site e depois:

```sql
insert into diretoria (user_id, papel)
select id, 'admin' from auth.users where email = 'voce@exemplo.com';
```

### 3. Autenticação

Em **Authentication → Sign In / Providers → Email**:

- **Confirm email: ligado.** É isso que impede login sem confirmação.

Em **Authentication → URL Configuration**:

- Site URL: `https://jubig.vercel.app` (ou o domínio final)
- Redirect URLs: acrescente `https://SEU-DOMINIO/auth/callback` e
  `http://localhost:3000/auth/callback`

### 4. E-mail

São dois caminhos diferentes, e os dois precisam do Resend:

| E-mail | Quem dispara | Onde fica o template |
|---|---|---|
| Confirmação de endereço | Supabase | painel do Supabase |
| Inscrição, comprovante, aprovação, recusa | nosso código | `src/emails/templates.ts` |

**Custom SMTP** (Authentication → Emails → SMTP Settings): aponte para o
Resend. Sem isso o Supabase usa o SMTP compartilhado dele, que entrega poucos
e-mails por hora e cai em spam.

```
Host: smtp.resend.com    Porta: 465
Usuário: resend          Senha: sua RESEND_API_KEY
```

Depois, em **Authentication → Emails → Confirm signup**, cole o HTML gerado por:

```bash
npm run email:confirmacao -- https://SEU-DOMINIO
```

A URL é obrigatória porque entra no `src` da figurinha do Juca dentro do
e-mail. O script recusa localhost de propósito: esse HTML só vai para o painel
do Supabase, que dispara e-mail de verdade, e imagem quebrada na caixa de
entrada não tem conserto depois do envio.

Sem colar isso, o e-mail de confirmação sai com o texto padrão do Supabase —
sem o Juca e sem o tom do resto do site.

### 5. Variáveis de ambiente

`.env.local` na sua máquina e as mesmas variáveis na Vercel:

```
NEXT_PUBLIC_SITE_URL                # https://jubig-site.vercel.app
NEXT_PUBLIC_WHATSAPP_DIRETORIA      # 5545999999999
NEXT_PUBLIC_INSTAGRAM
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY           # só servidor, nunca em "use client"
RESEND_API_KEY
EMAIL_REMETENTE                     # JUBIG <contato@jubig.org.br>
```

As `NEXT_PUBLIC_*` são **congeladas no build**. Mudar qualquer uma delas na
Vercel não tem efeito nenhum até um novo deploy — não adianta só salvar e
recarregar a página.

Se `NEXT_PUBLIC_SITE_URL` faltar, `src/lib/site.ts` cai na URL de produção que
a própria Vercel injeta. Funciona, mas prefira declarar: no dia em que entrar
um domínio próprio, é essa variável que manda.

No Resend, o domínio do `EMAIL_REMETENTE` precisa estar verificado (SPF e
DKIM), senão o Gmail manda tudo para spam.

### 6. MCP do Supabase (opcional, para o Claude Code)

O `.mcp.json` já está no repositório. Autentique uma vez, em terminal normal:

```bash
claude /mcp      # escolha "supabase" e siga o fluxo no navegador
```

---

## Regra central: e-mail confirmado

Ninguém se inscreve em nada sem confirmar o e-mail. São quatro camadas
independentes — se uma falhar, as outras seguram:

| Camada | Onde | O que faz |
|---|---|---|
| Visual | `AvisoEmailNaoConfirmado` | Faixa no topo de toda página logada |
| Rota | `exigirEmailConfirmado()` | Redireciona antes de abrir o formulário |
| API | `api/inscricoes`, `api/comprovantes` | 403 mesmo chamando a API direto |
| Banco | política `criar inscricao com email confirmado` | Postgres recusa o insert |

A quarta camada usa a função `email_confirmado()`, em `security definer` —
sem isso a política não conseguiria ler `auth.users` e passaria batido.

Como o Supabase barra o login de quem não confirmou, a pessoa descobre a
pendência **no login**: `/entrar` reconhece o erro e manda para
`/confirmar-email`, que é pública de propósito e tem o botão de reenvio.

---

## Onde as regras moram

Quase toda regra está no banco, não só no formulário. A tela avisa; o banco
decide. Isso importa porque duas caravanas preenchendo ao mesmo tempo veem a
mesma contagem de vagas desatualizada.

| Regra | Onde é garantida |
|---|---|
| Mesmo CPF só uma vez por evento | índice `inscrito_unico_por_evento` |
| Idade mínima na data do evento | função `criar_inscricao` |
| Vaga da modalidade | trigger `conferir_esporte`, com `select ... for update` |
| Conflito de horário | mesmo trigger, e a tela usa rádio por horário |
| Parcelas dentro de `max_parcelas` | trigger `conferir_parcelas` |
| Prazo para trocar de modalidade | política `escolher meus esportes` |
| Inscrição de outra pessoa | RLS em `inscricoes` e `inscritos` |

Criar inscrição e trocar modalidade passam por funções (`criar_inscricao`,
`trocar_esporte`) porque cada uma mexe em três tabelas. Feitas em chamadas
separadas pelo PostgREST, uma falha no meio deixaria inscrição sem esporte ou
pessoa sem modalidade nenhuma.

---

## Os cinco e-mails

Todos em `src/emails/templates.ts`, com o Juca correspondente ao estado:

| Quando | Template | Juca |
|---|---|---|
| Conta criada / reenvio | `emailConfirmacaoEndereco` | heh |
| Inscrição registrada | `emailInscricaoRecebida` | joia |
| Comprovante anexado | `emailComprovanteRecebido` | nervoso |
| Diretoria aprovou | `emailInscricaoAprovada` | joia |
| Diretoria recusou | `emailComprovanteRecusado` | choro |

Todos trazem botão de WhatsApp com mensagem pré-preenchida contendo o código
da inscrição — link `wa.me`, sem custo e sem API.

Numa inscrição parcelada, aprovar uma parcela **não** dispara o e-mail de
confirmação: ele só sai quando o último comprovante é aprovado.

---

## Estrutura

```
src/
  app/                    páginas e rotas de API
    [evento]/             página do evento e o formulário de inscrição
    inscricoes/[codigo]/  pagamento por PIX e envio do comprovante
    diretoria/            fila de validação e exportação
  components/juca/        o mascote: figurinha, bolha e ancoragem no campo
  emails/                 layout em tabela e os 5 templates
  lib/supabase/           server.ts (anon, com RLS) e admin.ts (service role)
  lib/                    validação, máscaras, PIX, consultas de evento
supabase/schema.sql       tabelas, RLS, triggers, funções e buckets
supabase/seed.sql         JubigDay 2026, modalidades e dúvidas
scripts/verificar.mts     conferência rápida das funções puras
public/juca/              as 8 figurinhas em WebP
```

---

## Cuidados

- **Bucket `comprovantes` é privado.** Comprovante de PIX mostra nome, banco e
  às vezes CPF. O acesso sai por signed URL de 10 minutos, e a política do
  storage só libera para o dono da inscrição ou para a diretoria.
- **`SUPABASE_SERVICE_ROLE_KEY` só em `src/lib/supabase/admin.ts`**, que tem
  `import "server-only"` no topo — o build quebra se alguém importar isso de
  um componente `"use client"`. Todo o resto usa a chave anônima e passa pela
  RLS.
- **O CSV exportado tem CPF e telefone de todos os inscritos.** Não mande em
  grupo de WhatsApp.
- **Resend gratuito: 3.000/mês, mas 100 por dia.** Cada inscrição gasta cerca
  de três e-mails (confirmação de conta, inscrição registrada, comprovante) e
  mais um na validação. Um pico de 25 inscrições no mesmo dia já encosta no
  teto. Se acontecer, troque para o Brevo (300/dia) mexendo só em
  `src/lib/email.ts` — e lembre que o SMTP do Supabase também precisa mudar.
- **O PIX não confirma pagamento sozinho.** O BR Code é estático; quem
  confirma é a diretoria olhando o comprovante. Confirmação automática
  exigiria PSP com API, CNPJ e mensalidade.
- **Não dá para verificar se o CPF pertence à pessoa.** O site valida os
  dígitos e impede repetição no mesmo evento, nada além disso. A tela não
  promete mais que isso.
