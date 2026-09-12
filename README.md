# Site da JUBIG

Site de divulgação e inscrições da Juventude Batista do Iguaçu.
Next.js 16 + Supabase + SMTP do Gmail, hospedado na Vercel.

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

- Site URL: `https://jubig-site.vercel.app` (ou o domínio final)
- Redirect URLs: acrescente `https://SEU-DOMINIO/auth/callback` e
  `http://localhost:3000/auth/callback`

### 4. E-mail

Tudo sai de `jubig.ofc@gmail.com`, pelo SMTP do Gmail, com os templates de
`src/emails/templates.ts`. **O Supabase não envia e-mail nenhum.**

Em **Authentication → Sign In / Providers → Email**, deixe
**Confirm email DESLIGADO**. A confirmação dele barra o login de quem não
confirmou — e aí a faixa de aviso, que deveria aparecer em toda página logada
desde o primeiro login, nunca chega a aparecer. A confirmação é nossa:
`perfis.email_confirmado_em`, preenchido pelo link que mandamos.

**Senha de app.** A senha normal do Gmail não serve para SMTP. Na conta
Google: Segurança → ative a verificação em duas etapas (obrigatória) →
Senhas de app → gere uma. São 16 letras; pode colar com ou sem os espaços.

Teste antes de abrir as inscrições:

```bash
npm run testar:email -- voce@exemplo.com
```

Mande também para um Outlook e um Hotmail: remetente @gmail.com cai em spam
com mais facilidade que domínio próprio, e é melhor descobrir agora.

### 5. Variáveis de ambiente

`.env.local` na sua máquina e as mesmas variáveis na Vercel:

```
NEXT_PUBLIC_SITE_URL                # https://jubig-site.vercel.app
NEXT_PUBLIC_WHATSAPP_DIRETORIA      # 5545999999999
NEXT_PUBLIC_INSTAGRAM
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY           # só servidor, nunca em "use client"
GMAIL_USUARIO                       # jubig.ofc@gmail.com
GMAIL_SENHA_APP                     # a senha de app, 16 letras
EMAIL_NOME_REMETENTE                # JUBIG
```

As `NEXT_PUBLIC_*` são **congeladas no build**. Mudar qualquer uma delas na
Vercel não tem efeito nenhum até um novo deploy — não adianta só salvar e
recarregar a página.

Se `NEXT_PUBLIC_SITE_URL` faltar, `src/lib/site.ts` cai na URL de produção que
a própria Vercel injeta. Funciona, mas prefira declarar: no dia em que entrar
um domínio próprio, é essa variável que manda.

O endereço do remetente é sempre o `GMAIL_USUARIO`. `EMAIL_NOME_REMETENTE`
muda só o nome que aparece na caixa de entrada — o Gmail reescreve qualquer
From diferente da conta autenticada, então não adianta tentar mandar como
outro endereço.

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

As quatro olham para o mesmo campo: `perfis.email_confirmado_em`.

A quarta camada usa a função `email_confirmado()`, em `security definer`.

A pessoa entra normalmente sem ter confirmado — é o que faz a faixa de aviso
aparecer **desde o primeiro login**, em vez de a pendência só aparecer no fim
do formulário. O que ela não consegue é se inscrever.

O fluxo:

1. `/criar-conta` cadastra e já devolve sessão
2. `POST /api/auth/enviar-confirmacao` grava um token e manda o e-mail
3. `/confirmar/<token>` consome o token e preenche `email_confirmado_em`

O token vale 24 horas, serve uma vez só, e é aceito um envio por minuto por
pessoa. A tabela `confirmacoes_email` tem RLS ligada e nenhuma política: só o
service role a alcança, porque um token nas mãos erradas confirma a conta de
outra pessoa.

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
- **Gmail grátis: 500 destinatários por dia.** Cada inscrição gasta cerca de
  três e-mails (confirmação de conta, inscrição registrada, comprovante) e
  mais um na validação — dá algo perto de 125 inscrições por dia. Estourando,
  o Gmail devolve `550 5.4.5` e **para de enviar até o dia seguinte**: a
  inscrição é gravada, mas ninguém recebe nada. O log grita quando isso
  acontece. Se o pico chegar perto disso, o caminho é domínio próprio com
  serviço de envio, trocando só `src/lib/email.ts`.
- **Remetente @gmail.com cai em spam com mais facilidade** que um domínio
  próprio com SPF e DKIM. Antes de abrir, mande um teste para Gmail, Outlook e
  Hotmail e confira onde caiu.
- **O PIX não confirma pagamento sozinho.** O BR Code é estático; quem
  confirma é a diretoria olhando o comprovante. Confirmação automática
  exigiria PSP com API, CNPJ e mensalidade.
- **Não dá para verificar se o CPF pertence à pessoa.** O site valida os
  dígitos e impede repetição no mesmo evento, nada além disso. A tela não
  promete mais que isso.
