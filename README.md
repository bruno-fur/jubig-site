# Site da JUBIG

Site de divulgação e inscrições da Juventude Batista do Iguaçu.
Next.js + Supabase + Resend, hospedado na Vercel.

## Criar o projeto

```bash
bash criar-site.sh jubig
```

O script cria o Next.js, instala as dependências e copia os arquivos daqui
para dentro. Depois siga os 5 passos que ele imprime no final.

## Regra central: e-mail confirmado

Ninguém se inscreve em nada sem confirmar o e-mail. Isso é garantido em
três camadas — se uma falhar, as outras seguram:

| Camada | Onde | O que faz |
|---|---|---|
| Visual | `AvisoEmailNaoConfirmado` | Faixa fixa no topo em toda página logada, desde o primeiro login |
| Rota | `exigirEmailConfirmado()` | Redireciona para `/confirmar-email` antes de abrir o formulário |
| API | `route.ts` das inscrições | Devolve 403 mesmo se alguém chamar a API direto |
| Banco | política RLS `criar inscricao com email confirmado` | Postgres recusa o insert |

## Os quatro e-mails

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

## Estrutura

```
src/
  emails/layout.ts        layout em tabela (Gmail/Outlook/Apple Mail)
  emails/templates.ts     os 5 e-mails
  lib/email.ts            envio via Resend, com log de falha
  lib/sessao.ts           pegarSessao / exigirLogin / exigirEmailConfirmado
  lib/validacao.ts        CPF, idade na data do evento, formatação
  components/             faixa e bloqueio de e-mail não confirmado
  app/api/                inscrições, comprovantes, validação da diretoria
supabase/schema.sql       tabelas, RLS e gerador de código (JD-0042)
public/juca/              as 8 figurinhas otimizadas em WebP
```

## Cuidados

- O bucket `comprovantes` precisa ser **privado**. Comprovante de PIX mostra
  nome, banco e às vezes CPF — link público vaza dado dos inscritos.
- O `SUPABASE_SERVICE_ROLE_KEY` só pode aparecer em código de servidor.
  Nunca em componente `"use client"`.
- Resend gratuito: 3.000/mês, mas **100 por dia**. Se o pico de inscrições
  passar disso, troque para Brevo (300/dia) mudando só `src/lib/email.ts`.
