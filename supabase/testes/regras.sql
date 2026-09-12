-- Testa as regras do schema como se fosse o Supabase: troca de role e de
-- auth.uid() a cada bloco. Cada teste imprime "ok" ou estoura.

\set ON_ERROR_STOP on
\timing off

-- Privilégios que o Supabase já dá de fábrica para anon/authenticated.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;
-- o Supabase real também dá usage em auth (é de lá que sai auth.uid())
grant usage on schema auth to anon, authenticated;
grant all on storage.objects to anon, authenticated;

-- Dois usuários: um confirmou o e-mail, o outro não.
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'confirmado@teste.com', now()),
  ('22222222-2222-2222-2222-222222222222', 'pendente@teste.com', null),
  ('33333333-3333-3333-3333-333333333333', 'outro@teste.com', now()),
  ('44444444-4444-4444-4444-444444444444', 'diretor@teste.com', now());

insert into diretoria (user_id, papel) values
  ('44444444-4444-4444-4444-444444444444', 'admin');

update eventos set publicado = true where slug = 'jubigday-2026';

create or replace function espera_erro(p_sql text, p_trecho text, p_nome text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_trecho) in lower(sqlerrm)) > 0 then
      raise notice 'ok    %', p_nome;
      return;
    end if;
    raise exception 'FALHOU % — erro diferente do esperado: %', p_nome, sqlerrm;
  end;
  raise exception 'FALHOU % — devia ter sido recusado e passou', p_nome;
end $$;

-- ============================================================
-- Camada 4: e-mail não confirmado não cria inscrição
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select espera_erro($x$
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Sem Confirmacao","cpf":"52998224725","nascimento":"2000-01-01","igreja":"IB Teste","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'row-level security', 'camada 4 — e-mail nao confirmado recusado pela RLS');

-- ============================================================
-- Caminho feliz
-- ============================================================
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare v_codigo text; v_futsal uuid; v_volei uuid; v_basquete uuid;
begin
  select id into v_futsal from esportes where nome = 'Futsal masculino';
  select id into v_volei from esportes where nome = 'Vôlei misto';

  v_codigo := criar_inscricao('jubigday-2026', 1, jsonb_build_array(
    jsonb_build_object('nome','Bruno Furtado','cpf','529.982.247-25','nascimento','2000-03-10',
                       'igreja','PIB Assis','telefone','+5545999990000','deBoa',false,
                       'esportes', jsonb_build_array(v_futsal)),
    jsonb_build_object('nome','Maria Souza','cpf','16899535009','nascimento','2005-07-22',
                       'igreja','PIB Assis','deBoa',false,
                       'esportes', jsonb_build_array(v_volei))
  ));

  if v_codigo <> 'JD-0001' then
    raise exception 'FALHOU codigo — esperava JD-0001, veio %', v_codigo;
  end if;
  raise notice 'ok    codigo sequencial (%)', v_codigo;

  if (select valor_centavos from inscricoes where codigo = v_codigo) <> 10000 then
    raise exception 'FALHOU valor — duas pessoas a R$50 deviam dar R$100';
  end if;
  raise notice 'ok    valor somado por pessoa';

  if (select count(*) from inscritos where inscricao_id =
      (select id from inscricoes where codigo = v_codigo)) <> 2 then
    raise exception 'FALHOU caravana — deviam ser 2 inscritos';
  end if;
  raise notice 'ok    caravana com 2 pessoas na mesma inscricao';
end $$;

-- ============================================================
-- CPF repetido no mesmo evento
-- ============================================================
select espera_erro($x$
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Bruno Outra Vez","cpf":"52998224725","nascimento":"2000-03-10","igreja":"PIB Assis","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'inscrito_unico_por_evento', 'CPF nao entra duas vezes no mesmo evento');

-- ============================================================
-- Idade mínima conta na data do evento (17/10/2026)
-- ============================================================
select espera_erro($x$
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Novo Demais","cpf":"01234567890","nascimento":"2014-10-18","igreja":"PIB Assis","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'idade_minima', 'faz 12 um dia depois do evento — recusado');

-- Um dia antes passa.
do $$
declare v_codigo text;
begin
  v_codigo := criar_inscricao('jubigday-2026', 1,
    '[{"nome":"No Limite","cpf":"01234567890","nascimento":"2014-10-17","igreja":"PIB Assis","deBoa":true,"esportes":[]}]'::jsonb);
  raise notice 'ok    faz 12 no dia do evento — aceito (%)', v_codigo;
end $$;

-- ============================================================
-- Parcelas acima do que o evento permite (JubigDay: max_parcelas = 1)
-- ============================================================
select espera_erro($x$
  select criar_inscricao('jubigday-2026', 2, '[{"nome":"Quer Parcelar","cpf":"11144477735","nascimento":"2000-01-01","igreja":"PIB Assis","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'parcelas fora do permitido', 'parcelas acima de max_parcelas recusado');

-- ============================================================
-- Conflito de horário: duas modalidades no mesmo horário
-- ============================================================
do $$
declare v_a uuid; v_b uuid;
begin
  select id into v_a from esportes where nome = 'Futsal feminino';
  select id into v_b from esportes where nome = 'Tênis de mesa';  -- mesmo horário 14h00
  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      jsonb_build_array(jsonb_build_object(
        'nome','Dois Horarios','cpf','11144477735','nascimento','2000-01-01',
        'igreja','PIB Assis','deBoa',false,
        'esportes', jsonb_build_array(v_a, v_b)))::text),
    'conflito de horario', 'duas modalidades no mesmo horario recusado');
end $$;

-- ============================================================
-- Modalidade lotada
-- ============================================================
set role postgres;
update esportes set vagas = 1 where nome = 'Xadrez';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare v_xadrez uuid;
begin
  select id into v_xadrez from esportes where nome = 'Xadrez';

  perform criar_inscricao('jubigday-2026', 1, jsonb_build_array(jsonb_build_object(
    'nome','Primeiro Xadrez','cpf','11144477735','nascimento','2000-01-01',
    'igreja','PIB Assis','deBoa',false, 'esportes', jsonb_build_array(v_xadrez))));
  raise notice 'ok    ultima vaga do xadrez ocupada';

  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      jsonb_build_array(jsonb_build_object(
        'nome','Segundo Xadrez','cpf','15350946056','nascimento','2000-01-01',
        'igreja','PIB Assis','deBoa',false,
        'esportes', jsonb_build_array(v_xadrez)))::text),
    'modalidade lotada', 'modalidade lotada recusa o proximo');
end $$;

-- A inscrição que falhou não pode ter deixado sujeira.
do $$
begin
  if exists (select 1 from inscritos where nome = 'Segundo Xadrez') then
    raise exception 'FALHOU transacao — inscrito gravado mesmo com a modalidade lotada';
  end if;
  raise notice 'ok    inscricao recusada nao deixou inscrito orfao';
end $$;

-- ============================================================
-- RLS: ninguém vê a inscrição dos outros
-- ============================================================
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  if (select count(*) from inscricoes) <> 0 then
    raise exception 'FALHOU RLS — outro usuario esta vendo inscricao alheia';
  end if;
  raise notice 'ok    outro usuario nao ve inscricao alheia';

  if (select count(*) from inscritos) <> 0 then
    raise exception 'FALHOU RLS — outro usuario esta vendo inscrito alheio';
  end if;
  raise notice 'ok    outro usuario nao ve inscrito alheio';
end $$;

-- A diretoria vê tudo.
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
begin
  if (select count(*) from inscricoes) < 3 then
    raise exception 'FALHOU RLS — diretoria devia ver todas as inscricoes';
  end if;
  raise notice 'ok    diretoria ve todas as inscricoes';
end $$;

-- ============================================================
-- Comprovante muda o status, e só a diretoria decide
-- ============================================================
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare v_id uuid;
begin
  select id into v_id from inscricoes where codigo = 'JD-0001';

  insert into comprovantes (inscricao_id, parcela, caminho)
  values (v_id, 1, v_id || '/parcela-1-123.jpg');

  if (select status from inscricoes where id = v_id) <> 'em_analise' then
    raise exception 'FALHOU trigger — status devia ter virado em_analise';
  end if;
  raise notice 'ok    comprovante enviado poe a inscricao em analise';
end $$;

-- Dono não confirma a própria inscrição.
do $$
begin
  update inscricoes set status = 'confirmada' where codigo = 'JD-0001';
  if (select status from inscricoes where codigo = 'JD-0001') = 'confirmada' then
    raise exception 'FALHOU RLS — dono conseguiu confirmar a propria inscricao';
  end if;
  raise notice 'ok    dono nao consegue confirmar a propria inscricao';
end $$;

-- Diretoria confirma.
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
begin
  update inscricoes set status = 'confirmada' where codigo = 'JD-0001';
  if (select status from inscricoes where codigo = 'JD-0001') <> 'confirmada' then
    raise exception 'FALHOU RLS — diretoria nao conseguiu confirmar';
  end if;
  raise notice 'ok    diretoria confirma a inscricao';
end $$;

-- ============================================================
-- Prazo de troca de modalidade
-- ============================================================
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare v_inscrito uuid; v_volei uuid; v_queimada uuid;
begin
  select i.id into v_inscrito from inscritos i
    join inscricoes ins on ins.id = i.inscricao_id
   where ins.codigo = 'JD-0001' and i.nome = 'Maria Souza';
  select id into v_queimada from esportes where nome = 'Queimada';

  perform trocar_esporte(v_inscrito, array[v_queimada], false);
  raise notice 'ok    troca de modalidade dentro do prazo';
end $$;

-- Fecha o prazo e tenta de novo.
set role postgres;
update eventos set troca_esporte_ate_dias = 3650 where slug = 'jubigday-2026';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare v_inscrito uuid; v_futsal uuid;
begin
  select i.id into v_inscrito from inscritos i
    join inscricoes ins on ins.id = i.inscricao_id
   where ins.codigo = 'JD-0001' and i.nome = 'Maria Souza';
  select id into v_futsal from esportes where nome = 'Futsal feminino';

  perform espera_erro(
    format($x$ select trocar_esporte(%L::uuid, array[%L::uuid], false) $x$, v_inscrito, v_futsal),
    'row-level security', 'troca fora do prazo recusada');
end $$;

set role postgres;
update eventos set troca_esporte_ate_dias = 7 where slug = 'jubigday-2026';

-- ============================================================
-- Bucket de comprovante privado
-- ============================================================
do $$
begin
  if (select public from storage.buckets where id = 'comprovantes') then
    raise exception 'FALHOU bucket — comprovantes esta publico';
  end if;
  raise notice 'ok    bucket comprovantes privado';

  if not (select public from storage.buckets where id = 'fotos') then
    raise exception 'FALHOU bucket — fotos devia ser publico';
  end if;
  raise notice 'ok    bucket fotos publico';
end $$;

select 'TODOS OS TESTES PASSARAM' as resultado;
