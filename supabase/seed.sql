-- ============================================================
-- JUBIG — dados iniciais
-- Rode DEPOIS do schema.sql. Pode rodar de novo: atualiza em vez de duplicar.
--
-- AJUSTE ANTES DE RODAR:
--   - pix_chave / pix_nome / pix_cidade  (sem isso a tela de pagamento não
--     mostra QR nem copia e cola)
--   - vagas de cada modalidade
--   - publicado = true só quando quiser abrir para o público
-- ============================================================

insert into eventos (
  slug, prefixo, nome, descricao,
  data_evento, cidade, local_nome, local_endereco,
  valor_centavos, idade_minima, max_parcelas, vagas,
  inscricoes_ate, troca_esporte_ate_dias,
  pix_chave, pix_nome, pix_cidade, publicado
) values (
  'jubigday-2026', 'JD', 'JubigDay 2026',
  'Um dia inteiro de esporte, música e comunhão com a juventude batista do oeste do Paraná.',
  '2026-10-17', 'Assis Chateaubriand', null, null,
  5000, 12, 1, null,
  '2026-09-26', 7,
  null, 'JUVENTUDE BATISTA', 'ASSIS CHATEAUBRIAND', false
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  data_evento = excluded.data_evento,
  cidade = excluded.cidade,
  valor_centavos = excluded.valor_centavos,
  idade_minima = excluded.idade_minima,
  max_parcelas = excluded.max_parcelas,
  inscricoes_ate = excluded.inscricoes_ate,
  troca_esporte_ate_dias = excluded.troca_esporte_ate_dias;

insert into eventos (
  slug, prefixo, nome, descricao,
  data_evento, data_fim, cidade,
  valor_centavos, idade_minima, max_parcelas,
  inscricoes_ate, publicado
) values (
  'congresso-carnaval-2027', 'CC', 'Congresso de Carnaval 2027',
  'Quatro dias de congresso em Medianeira.',
  '2027-02-06', '2027-02-09', 'Medianeira',
  0, 12, 2,
  null, false
)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- Modalidades do JubigDay.
-- O horário é o que agrupa na tela e o que bloqueia conflito — modalidades
-- com o mesmo texto de horário viram um grupo de escolha única.
-- ------------------------------------------------------------
with e as (select id from eventos where slug = 'jubigday-2026')
insert into esportes (evento_id, nome, horario, vagas, por_equipe, ordem)
select e.id, d.nome, d.horario, d.vagas, d.por_equipe, d.ordem
  from e, (values
    ('Futsal masculino',    '14h00', 60, true,  1),
    ('Futsal feminino',     '14h00', 40, true,  2),
    ('Vôlei misto',         '14h00', 48, true,  3),
    ('Tênis de mesa',       '14h00', 16, false, 4),
    ('Basquete 3x3',        '16h00', 36, true,  1),
    ('Queimada',            '16h00', 60, true,  2),
    ('Xadrez',              '16h00', 16, false, 3),
    ('Dominó',              '16h00', 24, false, 4)
  ) as d(nome, horario, vagas, por_equipe, ordem)
 where not exists (
   select 1 from esportes s where s.evento_id = e.id and s.nome = d.nome
 );

-- ------------------------------------------------------------
-- Dúvidas que valem para qualquer evento (evento_id nulo).
-- ------------------------------------------------------------
insert into duvidas (evento_id, pergunta, resposta, ordem)
select null, d.pergunta, d.resposta, d.ordem
  from (values
    ('Posso inscrever a caravana inteira da igreja?',
     'Pode. Na mesma inscrição você adiciona quantas pessoas quiser, e o valor é somado no fim. O comprovante do PIX é um só.', 1),
    ('Como funciona o pagamento?',
     'Por PIX. A tela da inscrição mostra o QR Code e o copia e cola. Depois de pagar, você envia a foto do comprovante pelo próprio site e a diretoria confere.', 2),
    ('Minha vaga está garantida assim que me inscrevo?',
     'Ainda não. A vaga só é confirmada depois que a diretoria aprova o comprovante — você recebe um e-mail avisando.', 3),
    ('Dá para trocar de modalidade depois?',
     'Dá, até alguns dias antes do evento. O prazo aparece na página Minhas inscrições.', 4),
    ('E se eu não quiser competir?',
     'Marque "vou só de boa" na etapa de esportes. Você participa de tudo, só não entra nas chaves.', 5),
    ('Não recebi o e-mail de confirmação. E agora?',
     'Confira o spam e a aba Promoções. Se não estiver lá, use o botão de reenviar na tela de confirmação.', 6)
  ) as d(pergunta, resposta, ordem)
 where not exists (select 1 from duvidas x where x.pergunta = d.pergunta);

-- ------------------------------------------------------------
-- Diretoria: troque pelo e-mail de quem valida comprovante.
-- A pessoa precisa ter criado a conta no site antes.
-- ------------------------------------------------------------
-- insert into diretoria (user_id, papel)
-- select id, 'admin' from auth.users where email = 'voce@exemplo.com'
-- on conflict (user_id) do update set papel = excluded.papel;
