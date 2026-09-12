# JUBIG — contexto do projeto

## O que é

Site de divulgação e inscrições da **JUBIG** (Juventude Batista do Iguaçu),
união de jovens das igrejas batistas do oeste do Paraná.

**Stack:** Next.js (App Router, TypeScript, Tailwind) + Supabase (Auth,
Postgres, Storage) + Resend (e-mail) + Vercel (hospedagem).

**Primeiro evento:** JubigDay — 17/10/2026, Assis Chateaubriand, R$ 50 por
pessoa. **As inscrições precisam estar no ar até 26/09/2026**, senão as
igrejas não conseguem organizar caravana a tempo.

**Evento seguinte:** Congresso de Carnaval, 6 a 9/02/2027, Medianeira.

**Quem mantém:** uma pessoa só (desenvolvedor C#/SAP, experiente em backend,
menos em frontend React). A diretoria apenas consulta dados e valida
comprovantes — nunca mexe em código.

---

## O que já existe na pasta

| Arquivo | Papel |
|---|---|
| `supabase/schema.sql` | tabelas, enums, RLS, função `gerar_codigo` |
| `src/lib/sessao.ts` | `pegarSessao`, `exigirLogin`, `exigirEmailConfirmado` |
| `src/lib/email.ts` | envio via Resend, com log de falha |
| `src/emails/layout.ts` | layout base dos e-mails, em tabela |
| `src/emails/templates.ts` | os 5 e-mails transacionais |
| `src/lib/validacao.ts` | CPF, idade na data do evento, formatação BRL |
| `src/lib/supabase/{client,server}.ts` | clientes do Supabase |
| `src/components/AvisoEmailNaoConfirmado.tsx` | faixa e tela de bloqueio |
| `src/app/api/inscricoes/route.ts` | cria inscrição + dispara e-mail |
| `src/app/api/comprovantes/route.ts` | upload do comprovante + e-mail |
| `src/app/api/admin/validar/route.ts` | diretoria aprova/recusa + e-mail |
| `public/juca/*.webp` | 8 figurinhas do mascote |

**Não reescreva esses arquivos sem necessidade.** Eles são a base combinada.

---

## Regras invioláveis

1. **E-mail confirmado é pré-requisito para qualquer inscrição.** Já está em
   quatro camadas (faixa visual, guard de rota, 403 na API, política RLS).
   Não remova nenhuma. O usuário precisa descobrir a pendência no login, nunca
   no fim do formulário.
2. **Bucket `comprovantes` é privado.** Comprovante de PIX mostra nome, banco e
   às vezes CPF. Acesso só por signed URL, e só para o dono ou a diretoria.
3. **`SUPABASE_SERVICE_ROLE_KEY` nunca em componente `"use client"`.**
4. **Telefone sempre em E.164** (`+5545999990000`), via `libphonenumber-js`.
   Brasil é o padrão; Paraguai, Argentina e Uruguai no topo da lista (tríplice
   fronteira).
5. **Idade validada na data do evento**, não a de hoje. Mínimo configurável por
   evento (12 anos no JubigDay).
6. **PIX não parcela nativamente.** "2x" significa dois pagamentos manuais, cada
   um com seu comprovante. O parcelamento é configurável por evento e deve ficar
   desligado quando `max_parcelas = 1`.
7. **CPF:** validar dígitos verificadores e impedir duplicidade no mesmo evento.
   Não é possível verificar se o CPF pertence à pessoa — não prometa isso na UI.
8. **Respeitar `prefers-reduced-motion`** em toda animação.

---

## Identidade visual

Tirada do logo (capivara de óculos e jaqueta, chamada **Juca**).

```
--laranja: #E26722    --laranja-escuro: #B44C13
--tinta:   #2A1710    --creme: #F8F1E0
--areia:   #EFE4CE    --linha: #E0D3BC
--apagado: #7A6350
ok #2E7D32   ruim #C0392B
```

Fontes: **Archivo** (títulos, 800) e **Outfit** (texto). Botões com raio 10px,
cartões 16px.

### O Juca reage ao estado do sistema

Componente único, reutilizado em todas as telas. Estados e figurinhas:

| Estado | Arquivo | Quando |
|---|---|---|
| ocioso | `feliz.webp` | home, nada acontecendo |
| digitando | `heh.webp` | preenchendo campo |
| válido | `joia.webp` | CPF confere, inscrição confirmada |
| inválido | `nao.webp` | CPF errado, campo obrigatório vazio |
| incompleto | `nervoso.webp` | faltam dígitos, comprovante em análise |
| exagero | `choque.webp` | caravana de 4+ pessoas |
| urgência | `susto.webp` | menos de 20 vagas |
| recusa | `choro.webp` | comprovante recusado, modalidade lotada |

**Posicionamento (já testado, não invente outro):** enquanto um campo está
focado, o Juca fica **ancorado logo acima do campo**, em `position: absolute`,
tamanho reduzido (58px). Nada de `position: fixed` com cálculo de
`visualViewport` — quebra dentro de webview no iOS. Sem foco, ele volta grande
(92px) ao canto inferior direito. Com erro e sem teclado, desce até o campo com
uma seta apontando.

A bolha de fala muda a cada tecla, mas **a animação só dispara quando a
figurinha muda** — senão ele pulsa a cada letra e vira ruído.

---

## Backlog, na ordem

### 1. Fundação
- [ ] Layout raiz com as fontes, cores e a faixa `AvisoEmailNaoConfirmado`
- [ ] Middleware de sessão do Supabase (`@supabase/ssr`)
- [ ] Páginas `/entrar`, `/criar-conta`, `/confirmar-email`, `/confirmado`

### 2. Inscrição (o caminho crítico — precisa estar pronto até 26/09)
- [ ] `/[evento]/inscricao` com stepper de 4 etapas
- [ ] Componente `<Juca>` com os estados acima
- [ ] Campos: nome (exige sobrenome), CPF, nascimento, igreja, telefone
      internacional. Máscaras **por tamanho**, nunca regex encadeado —
      `replace` em cadeia quebrou o telefone antes
- [ ] Múltiplos inscritos na mesma inscrição (caravana da igreja)
- [ ] Seleção de esportes agrupada por horário, com bloqueio de conflito,
      vagas por modalidade e a opção "vou só de boa" como escolha obrigatória
- [ ] Tela de pagamento: PIX copia e cola, QR, upload do comprovante

### 3. Painel do usuário
- [ ] `/minhas-inscricoes` com status por pessoa e reenvio de comprovante
- [ ] Troca de esporte liberada até X dias antes do evento

### 4. Painel da diretoria
- [ ] Lista de comprovantes pendentes com signed URL da imagem
- [ ] Aprovar / recusar com motivo obrigatório
- [ ] Exportar CSV por evento e por modalidade

### 5. Site público
- [ ] Home: hero do próximo evento, quem somos, próximos eventos, galeria,
      Instagram, contato
- [ ] `/[evento]` com abas Programação / Local / Dúvidas
- [ ] Galeria com fotos do bucket público

---

## Como validar antes de considerar pronto

- `npm run build` sem erro de tipo
- Testar o formulário **no celular**, com teclado aberto, e confirmar que o
  Juca continua visível
- Tentar criar inscrição com e-mail não confirmado: precisa falhar nas quatro
  camadas
- Tentar abrir um comprovante sem estar logado: precisa dar 403

---

## Estilo de resposta esperado

Respostas curtas e práticas. Aponte problemas reais em vez de concordar —
principalmente sobre prazo, custo e dados sensíveis dos inscritos.
