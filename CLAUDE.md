# JUBIG — contexto do projeto

## O que é

Site de divulgação e inscrições da **JUBIG** (Juventude Batista do Iguaçu),
união de jovens das igrejas batistas do oeste do Paraná.

**Stack:** Next.js (App Router, TypeScript, Tailwind) + Supabase (Auth,
Postgres, Storage) + Resend (e-mail) + Vercel (hospedagem).

**Primeiro evento:** JubigDay — 17/10/2026, Assis Chateaubriand, R$ 50 por
pessoa. **As inscrições precisam estar no ar até 26/09/2026**, senão as
igrejas não conseguem organizar caravana a tempo.

**Tipos de evento** — cada um tem formato próprio, e tratar todos como
JubigDay era o erro original:

| Tipo | Inscrição | Modalidades | Exemplo |
|---|---|---|---|
| `jubigday` | sim, paga | sim | JubigDay, 17/10/2026 |
| `congresso` | sim, paga | **oficinas** | Congresso de Carnaval, 6–9/02/2027 |
| `tour` | **não**, entrada franca | não | JubigTour — visita a uma igreja |

As duas capacidades são colunas (`tem_inscricao`, `tem_modalidades`), não
deduzidas do tipo: mudar o formato de um evento é UPDATE, não deploy.

As etapas do formulário de inscrição são **nomeadas**, nunca numeradas — com
índice, a etapa 2 seria "Conferir" no congresso e "Pagamento" no JubigDay.

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
--laranja: #D94C1A    --laranja-escuro: #A83A12
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
- [x] Seleção de esportes agrupada por TURNO (manhã/tarde/noite), com vagas por
      modalidade e a opção "vou só de boa" como escolha obrigatória. Mais de uma
      modalidade por turno é permitido; o limite vem de
      `eventos.max_esportes_por_turno` (0 = sem limite)
- [ ] Tela de pagamento: PIX copia e cola, QR, upload do comprovante

### 3. Painel do usuário
- [ ] `/minhas-inscricoes` com status por pessoa e reenvio de comprovante
- [ ] Troca de esporte liberada até X dias antes do evento

### 4. Painel da diretoria
- [x] Visão geral: inscritos, confirmados, a receber, por igreja, ocupação
- [x] Lista de comprovantes pendentes com signed URL da imagem
- [x] Aprovar / recusar com motivo obrigatório
- [x] Exportar CSV por evento e por modalidade
- [x] Criar e editar modalidades (só admin)
- [x] Gerenciar quem tem acesso e com qual nível (só admin)

- [x] Portaria: leitor de QR no site, check-in uma vez só por ingresso
- [x] Avisos por evento, na página e por e-mail (só admin)
- [x] Lista geral de usuários (só admin)
- [x] Dar acesso escolhendo a conta numa lista, não digitando e-mail
- [x] Igrejas por CEP/estado/cidade (IBGE + ViaCEP), coordenada automática (Nominatim)

**Três níveis:** `admin` mexe na estrutura (modalidades, evento, equipe,
igrejas, avisos, usuários), `membro` faz o dia a dia (validar comprovante,
exportar, portaria), usuário comum não enxerga nada da diretoria. O banco
garante que sempre sobre ao menos um admin.

### 6. Pós-confirmação
- [x] Ingresso com QR por pessoa quando a inscrição está `confirmada`
      (página imprimível + PDF). O QR aponta para `/diretoria/ingresso/<uuid>`
      e **não carrega dado nenhum** — só a diretoria vê nome e CPF ao abrir.
- [x] `ingresso` e `checkin_*` só mudam pela diretoria (trigger). Sem isso o
      dono apagaria o próprio check-in e passaria o print para outro entrar.
- [x] Lembretes automáticos D-7 e véspera (Vercel Cron, `CRON_SECRET`
      obrigatório — sem ele a rota recusa tudo)
- [x] Redefinição de senha própria, pelo nosso SMTP. A resposta é **a mesma
      com ou sem conta**: dizer "e-mail não encontrado" deixa qualquer um
      descobrir quem está cadastrado.

### 7. Controle e cancelamento
- [x] `/minhas-inscricoes` filtra por `responsavel_id` **explicitamente**: a RLS
      devolve tudo para a diretoria, então confiar nela mostrava as de todo mundo
- [x] Diretoria > Inscrições: todas, com busca e filtro; detalhe com comprovantes
- [x] Comprovantes continuam visíveis depois de aprovados ou recusados (histórico)
- [x] Cancelamento (`cancelar_inscricao`): o dono cancela a própria **enquanto
      não está paga**; paga, só a diretoria (devolução é manual). Diretoria
      cancelando a de outra pessoa exige motivo e avisa o dono por e-mail.
      Cancelar marca `inscritos.ativo = false`, o que libera a vaga da
      modalidade e o CPF para nova inscrição
- [x] Aviso de pendências no site para a diretoria (selo no menu + faixa), sem e-mail
- [x] Área do admin (Diretoria > Usuários): pendências do sistema, reenviar
      confirmação, confirmar e-mail à mão

- [x] Igreja **só da lista** no cadastro e na inscrição (`igreja_id`). O nome
      gravado sai de `igrejas` no banco, nunca do texto do navegador — texto
      livre dividia "PIB Toledo" e "Primeira Igreja Batista de Toledo" em duas
      no painel. Igreja que falta: a diretoria cadastra em Diretoria > Igrejas
- [x] Aba atual da diretoria marcada (`aria-current`)

### 8. Tudo pela tela, sem código
- [x] Diretoria > Eventos: criar, editar, publicar, apagar (só sem inscrição),
      programação e dúvidas. Prefixo do código é único — dois "JD" gerariam
      dois JD-0001
- [x] Abertura das inscrições: "em breve" (`inscricoes_em_breve`), agendada
      (`inscricoes_de`, com contagem que abre sozinha) ou abertas. O banco
      recusa em `criar_inscricao`, não só a tela
- [x] Contagem regressiva até a abertura e até o dia do evento (`hora_inicio`)
- [x] Diretoria > Site: WhatsApp, Instagram, e-mail, "Quem somos" (tabela
      `configuracoes`). Env antiga vira só valor de reserva
- [x] Instagram na home pela API oficial: chave colada na tela, guardada em
      `segredos` (RLS sem política — nem admin lê), renovada a cada 7 dias
- [x] Diretoria > Pagamentos: esperado, recebido, em análise, sem comprovante,
      a devolver; CSV
- [x] Validação (ex-portaria): câmera → janela com o inscrito → liberar →
      "Próximo ingresso" ou "Sair"
- [x] Meu perfil: nome, igreja, telefone, senha. Trigger `proteger_perfil`
      impede a pessoa de confirmar o próprio e-mail por update direto

### 9. Modalidade é esporte ou oficina
- [x] `esportes.categoria`: `esporte` (JubigDay) ou `oficina` (Congresso,
      com `responsavel` e `descricao`). Oficina é **uma por turno**, sempre
- [x] `esportes.formato` (só esporte): `individual`, `dupla`/`trio` (a pessoa
      escreve os parceiros em `inscritos_esportes.parceiros`) ou
      `time_sorteado` (nota 1–5 de habilidade em `inscritos_esportes.nota`)
- [x] O trigger `conferir_esporte` exige nota/parceiros e limpa o que não se
      aplica; `trocar_escolhas` substitui `trocar_esporte`
- [x] Diretoria > Modalidades > Inscritos: lista, confere se o parceiro também
      se inscreveu e sorteia times equilibrados pela nota (serpentina, nada salvo)

- [x] Modalidade com gente inscrita também se apaga e muda de formato, com
      confirmação que diz quantas pessoas perdem a escolha. Trocar o formato
      limpa a nota/parceiros que deixaram de valer

### 10. Pulseiras (equipes por cor)
- [x] `equipes` por evento (nome, cor) e `inscritos.equipe_id`. JubigDay
      sorteia **na chegada**: `registrar_checkin` chama `sortear_equipe`, que
      põe a pessoa na equipe com menos gente. Congresso usa na gincana
- [x] `equipe_id` protegido pelo mesmo trigger do check-in — sem isso o dono
      escolhia a própria cor. Troca manual só por `mover_para_equipe`
- [x] Pontos são lançamentos (`pontos_equipe`), não um total: erro de
      digitação se apaga sem perder o resto. View `placar` pública; a página
      do evento mostra depois do primeiro ponto
- [x] Diretoria > Pulseiras e placar: placar, lançar pontos, quem está em
      cada equipe (troca por seleção), sortear em lote, cores
- [x] Visão geral e Pulseiras mostram um evento por vez (`?evento=slug`)

**Cota do Gmail:** ~500 destinatários/dia somando tudo. Disparo em massa
(avisos, lembretes) para em 350 para não derrubar os e-mails de inscrição.

### 5. Site público
- [x] Home: hero, atalhos, quem somos, calendário, mapa das igrejas, galeria, contato
- [x] Calendário agrupado por mês, com passado e futuro
- [x] Mapa das igrejas com OpenStreetMap (sem chave de API, sem cartão)
- [x] `/[evento]` com abas conforme o tipo — Modalidades só quando existe
- [x] Galeria com fotos do bucket público
- [x] Cadastro de igrejas em Diretoria > Igrejas

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
