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

-- A confirmacao e nossa: quem confirmou tem perfis.email_confirmado_em.
-- O trigger ao_criar_usuario ja criou a linha em perfis.
update perfis set email_confirmado_em = now() where id in (
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

insert into diretoria (user_id, papel) values
  ('44444444-4444-4444-4444-444444444444', 'admin');

update eventos set publicado = true where slug = 'jubigday-2026';

-- Igreja fixa para os testes: a inscrição só aceita igreja da lista.
insert into igrejas (id, nome, cidade) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'PIB Assis', 'Assis Chateaubriand');

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
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Sem Confirmacao","cpf":"52998224725","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb)
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
                       'igrejaId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','telefone','+5545999990000','deBoa',false,
                       'esportes', jsonb_build_array(v_futsal)),
    jsonb_build_object('nome','Maria Souza','cpf','16899535009','nascimento','2005-07-22',
                       'igrejaId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','deBoa',false,
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
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Bruno Outra Vez","cpf":"52998224725","nascimento":"2000-03-10","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'inscrito_unico_por_evento', 'CPF nao entra duas vezes no mesmo evento');

-- ============================================================
-- Idade mínima conta na data do evento (17/10/2026)
-- ============================================================
select espera_erro($x$
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Novo Demais","cpf":"01234567890","nascimento":"2014-10-18","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'idade_minima', 'faz 12 um dia depois do evento — recusado');

-- Um dia antes passa.
do $$
declare v_codigo text;
begin
  v_codigo := criar_inscricao('jubigday-2026', 1,
    '[{"nome":"No Limite","cpf":"01234567890","nascimento":"2014-10-17","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb);
  raise notice 'ok    faz 12 no dia do evento — aceito (%)', v_codigo;
end $$;

-- ============================================================
-- Parcelas acima do que o evento permite (JubigDay: max_parcelas = 1)
-- ============================================================
select espera_erro($x$
  select criar_inscricao('jubigday-2026', 2, '[{"nome":"Quer Parcelar","cpf":"11144477735","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'parcelas fora do permitido', 'parcelas acima de max_parcelas recusado');

-- ============================================================
-- Mais de uma modalidade no mesmo turno
-- ============================================================
do $$
declare v_a uuid; v_b uuid; v_codigo text;
begin
  select id into v_a from esportes where nome = 'Futsal feminino';   -- manha
  select id into v_b from esportes where nome = 'Tênis de mesa';     -- manha

  v_codigo := criar_inscricao('jubigday-2026', 1, jsonb_build_array(jsonb_build_object(
    'nome','Dois No Mesmo Turno','cpf','00000010073','nascimento','2000-01-01',
    'igrejaId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','deBoa',false,
    'esportes', jsonb_build_array(v_a, v_b))));
  raise notice 'ok    duas modalidades no mesmo turno sao aceitas (%)', v_codigo;
end $$;

-- Com o limite em 1, volta a recusar.
set role postgres;
update eventos set max_esportes_por_turno = 1 where slug = 'jubigday-2026';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare v_a uuid; v_b uuid;
begin
  select id into v_a from esportes where nome = 'Futsal feminino';
  select id into v_b from esportes where nome = 'Tênis de mesa';
  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      jsonb_build_array(jsonb_build_object(
        'nome','Passou Do Limite','cpf','00000013765','nascimento','2000-01-01',
        'igrejaId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','deBoa',false,
        'esportes', jsonb_build_array(v_a, v_b)))::text),
    'limite_no_turno', 'limite de 1 por turno recusa a segunda');
end $$;

set role postgres;
update eventos set max_esportes_por_turno = 0 where slug = 'jubigday-2026';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

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
    'igrejaId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','deBoa',false, 'esportes', jsonb_build_array(v_xadrez))));
  raise notice 'ok    ultima vaga do xadrez ocupada';

  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      jsonb_build_array(jsonb_build_object(
        'nome','Segundo Xadrez','cpf','15350946056','nascimento','2000-01-01',
        'igrejaId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','deBoa',false,
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

-- ============================================================
-- Confirmacao de e-mail propria
-- ============================================================
set role postgres;

do $$
declare v_token uuid; v_r text; v_usuario uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- o pendente ainda nao confirmou
  if (select email_confirmado_em from perfis where id = v_usuario) is not null then
    raise exception 'FALHOU — pendente ja aparece confirmado';
  end if;

  insert into confirmacoes_email (user_id) values (v_usuario) returning token into v_token;

  v_r := confirmar_email(v_token);
  if v_r <> 'ok' then raise exception 'FALHOU confirmacao — veio %', v_r; end if;
  raise notice 'ok    token valido confirma a conta';

  if (select email_confirmado_em from perfis where id = v_usuario) is null then
    raise exception 'FALHOU — confirmou mas nao gravou em perfis';
  end if;
  raise notice 'ok    perfis.email_confirmado_em preenchido';

  -- o mesmo token nao serve duas vezes
  v_r := confirmar_email(v_token);
  if v_r <> 'ja_usado' then raise exception 'FALHOU reuso — veio %', v_r; end if;
  raise notice 'ok    token nao serve duas vezes';

  -- token que nunca existiu
  v_r := confirmar_email(gen_random_uuid());
  if v_r <> 'invalido' then raise exception 'FALHOU token inexistente — veio %', v_r; end if;
  raise notice 'ok    token inexistente recusado';

  -- token vencido
  insert into confirmacoes_email (user_id, expira_em)
  values (v_usuario, now() - interval '1 hour') returning token into v_token;
  v_r := confirmar_email(v_token);
  if v_r <> 'expirado' then raise exception 'FALHOU token vencido — veio %', v_r; end if;
  raise notice 'ok    token vencido recusado';
end $$;

-- Agora que confirmou, o mesmo usuario consegue se inscrever.
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  perform criar_inscricao('jubigday-2026', 1,
    '[{"nome":"Depois De Confirmar","cpf":"15350946056","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb);
  raise notice 'ok    confirmado passa a conseguir se inscrever';
end $$;

-- A tabela de tokens nao e visivel para ninguem pela chave anonima.
do $$
begin
  perform espera_erro('select count(*) from confirmacoes_email',
    'permission denied', 'tabela de tokens fechada para o usuario comum');
exception when others then
  if (select count(*) from confirmacoes_email) = 0 then
    raise notice 'ok    tabela de tokens nao devolve nada para o usuario comum';
  else
    raise exception 'FALHOU — usuario comum enxerga token de confirmacao';
  end if;
end $$;

-- ============================================================
-- Níveis de acesso: admin, membro, usuário comum
-- ============================================================
set role postgres;
-- 3 vira membro da diretoria; 4 já é admin.
insert into diretoria (user_id, papel)
values ('33333333-3333-3333-3333-333333333333', 'membro')
on conflict (user_id) do update set papel = 'membro';

set role authenticated;

-- --- membro ---
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  if not eh_diretoria() then raise exception 'FALHOU — membro nao e reconhecido como diretoria'; end if;
  raise notice 'ok    membro conta como diretoria';

  if eh_admin() then raise exception 'FALHOU — membro aparece como admin'; end if;
  raise notice 'ok    membro nao e admin';
end $$;

do $$
declare v_evento uuid;
begin
  select id into v_evento from eventos where slug = 'jubigday-2026';
  perform espera_erro(
    format($x$ insert into esportes (evento_id, nome, turno, vagas) values (%L, 'Teste Membro', 'tarde', 10) $x$, v_evento),
    'row-level security', 'membro nao cria modalidade');
end $$;

do $$
begin
  perform espera_erro(
    $x$ insert into diretoria (user_id, papel) values ('22222222-2222-2222-2222-222222222222', 'admin') $x$,
    'row-level security', 'membro nao mexe na equipe');
end $$;

-- Mas o trabalho do dia a dia continua sendo dele.
do $$
begin
  update inscricoes set status = 'confirmada' where codigo = 'JD-0001';
  if (select status from inscricoes where codigo = 'JD-0001') <> 'confirmada' then
    raise exception 'FALHOU — membro nao consegue validar inscricao';
  end if;
  raise notice 'ok    membro valida inscricao';
end $$;

-- --- admin ---
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
declare v_evento uuid; v_novo uuid;
begin
  if not eh_admin() then raise exception 'FALHOU — admin nao e reconhecido'; end if;
  raise notice 'ok    admin reconhecido';

  select id into v_evento from eventos where slug = 'jubigday-2026';
  insert into esportes (evento_id, nome, turno, vagas, por_equipe, ordem)
  values (v_evento, 'Peteca', 'tarde', 12, false, 9) returning id into v_novo;
  raise notice 'ok    admin cria modalidade';

  update esportes set vagas = 20 where id = v_novo;
  raise notice 'ok    admin altera modalidade';

  delete from esportes where id = v_novo;
  raise notice 'ok    admin apaga modalidade';

  update eventos set max_esportes_por_turno = 0 where id = v_evento;
  raise notice 'ok    admin edita o evento';
end $$;

-- --- usuário comum ---
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare v_evento uuid;
begin
  if eh_diretoria() then raise exception 'FALHOU — usuario comum aparece como diretoria'; end if;
  raise notice 'ok    usuario comum nao e diretoria';

  select id into v_evento from eventos where slug = 'jubigday-2026';
  perform espera_erro(
    format($x$ insert into esportes (evento_id, nome, turno, vagas) values (%L, 'Teste Comum', 'tarde', 10) $x$, v_evento),
    'row-level security', 'usuario comum nao cria modalidade');
end $$;

-- --- o último admin não pode sumir ---
set role postgres;
do $$
declare v_admins int;
begin
  select count(*) into v_admins from diretoria where papel = 'admin';
  if v_admins <> 1 then
    raise exception 'teste mal montado: esperava 1 admin, ha %', v_admins;
  end if;

  begin
    delete from diretoria where user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FALHOU — apagou o ultimo admin';
  exception when others then
    if position('ultimo_admin' in sqlerrm) = 0 then raise; end if;
    raise notice 'ok    nao da para apagar o ultimo admin';
  end;

  begin
    update diretoria set papel = 'membro' where user_id = '44444444-4444-4444-4444-444444444444';
    raise exception 'FALHOU — rebaixou o ultimo admin';
  exception when others then
    if position('ultimo_admin' in sqlerrm) = 0 then raise; end if;
    raise notice 'ok    nao da para rebaixar o ultimo admin';
  end;
end $$;

-- ============================================================
-- Formatos de evento: jubigday, congresso, tour
-- ============================================================
set role postgres;
update eventos set publicado = true
 where slug in ('congresso-carnaval-2027', 'jubigtour-toledo-2026');

do $$
begin
  if (select tem_modalidades from eventos where slug = 'congresso-carnaval-2027') then
    raise exception 'FALHOU — congresso nao deveria ter modalidades';
  end if;
  raise notice 'ok    congresso sem modalidades';

  if not (select tem_inscricao from eventos where slug = 'congresso-carnaval-2027') then
    raise exception 'FALHOU — congresso deveria ter inscricao';
  end if;
  raise notice 'ok    congresso com inscricao';

  if (select tem_inscricao from eventos where slug = 'jubigtour-toledo-2026') then
    raise exception 'FALHOU — tour nao deveria ter inscricao';
  end if;
  raise notice 'ok    tour sem inscricao';

  if (select igreja_id from eventos where slug = 'jubigtour-toledo-2026') is null then
    raise exception 'FALHOU — tour deveria apontar para uma igreja';
  end if;
  raise notice 'ok    tour ligado a uma igreja anfitria';
end $$;

-- Tipo fora da lista é recusado pelo banco, não só pela tela.
do $$
begin
  perform espera_erro(
    $x$ update eventos set tipo = 'festa' where slug = 'jubigday-2026' $x$,
    'eventos_tipo_valido', 'tipo invalido recusado');
end $$;

-- Inscrição no congresso funciona, e sem esporte nenhum.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare v_codigo text;
begin
  v_codigo := criar_inscricao('congresso-carnaval-2027', 2,
    '[{"nome":"Vai No Congresso","cpf":"00000017400","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb);
  if v_codigo !~ '^CC-' then
    raise exception 'FALHOU — codigo do congresso deveria comecar com CC, veio %', v_codigo;
  end if;
  raise notice 'ok    inscricao no congresso com prefixo proprio (%)', v_codigo;
end $$;

-- A agenda mostra os três, com a contagem de gente.
set role postgres;
do $$
declare v_linhas int; v_tour int;
begin
  select count(*) into v_linhas from agenda;
  if v_linhas < 3 then
    raise exception 'FALHOU agenda — esperava ao menos 3 eventos publicados, veio %', v_linhas;
  end if;
  raise notice 'ok    agenda lista os % eventos publicados', v_linhas;

  select pessoas into v_tour from agenda where slug = 'jubigtour-toledo-2026';
  if v_tour <> 0 then
    raise exception 'FALHOU — tour nao tem inscricao, deveria contar 0 pessoas';
  end if;
  raise notice 'ok    agenda conta 0 pessoas no tour';

  if (select igreja_nome from agenda where slug = 'jubigtour-toledo-2026') is null then
    raise exception 'FALHOU — agenda deveria trazer o nome da igreja anfitria';
  end if;
  raise notice 'ok    agenda traz a igreja anfitria do tour';
end $$;

-- ============================================================
-- Igrejas
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  if (select count(*) from igrejas) = 0 then
    raise exception 'FALHOU — usuario comum deveria ver as igrejas ativas';
  end if;
  raise notice 'ok    igrejas ativas sao publicas';

  perform espera_erro(
    $x$ insert into igrejas (nome, cidade) values ('Teste', 'Toledo') $x$,
    'row-level security', 'usuario comum nao cadastra igreja');
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform espera_erro(
    $x$ insert into igrejas (nome, cidade) values ('Teste Membro', 'Toledo') $x$,
    'row-level security', 'membro da diretoria nao cadastra igreja');
end $$;

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
declare v_id uuid;
begin
  insert into igrejas (nome, cidade, latitude, longitude)
  values ('IB Teste Admin', 'Cascavel', -24.955, -53.455) returning id into v_id;
  raise notice 'ok    admin cadastra igreja';

  delete from igrejas where id = v_id;
  raise notice 'ok    admin apaga igreja sem evento';
end $$;

set role postgres;
update eventos set publicado = false
 where slug in ('congresso-carnaval-2027', 'jubigtour-toledo-2026');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- ============================================================
-- Ingresso e check-in
-- ============================================================
set role postgres;
do $$
declare v_ing uuid; v_outro uuid;
begin
  select ingresso into v_ing from inscritos where nome = 'Bruno Furtado';
  select ingresso into v_outro from inscritos where nome = 'Maria Souza';
  if v_ing is null or v_ing = v_outro then
    raise exception 'FALHOU — cada inscrito deveria ter ingresso proprio';
  end if;
  raise notice 'ok    cada pessoa da caravana tem ingresso proprio';
end $$;

-- O dono não mexe no próprio check-in.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  perform espera_erro(
    $x$ update inscritos set checkin_em = now() where nome = 'Bruno Furtado' $x$,
    'ingresso_protegido', 'dono nao registra a propria entrada');
  perform espera_erro(
    $x$ update inscritos set ingresso = gen_random_uuid() where nome = 'Bruno Furtado' $x$,
    'ingresso_protegido', 'dono nao troca o proprio ingresso');
end $$;

-- Usuário comum não faz check-in de ninguém.
do $$
declare v_ing uuid; v_r text;
begin
  select ingresso into v_ing from inscritos where nome = 'Bruno Furtado';
  v_r := registrar_checkin(v_ing);
  if v_r <> 'sem_permissao' then raise exception 'FALHOU — usuario comum fez checkin: %', v_r; end if;
  raise notice 'ok    usuario comum nao faz checkin';
end $$;

-- Membro da diretoria faz, uma vez só.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare v_ing uuid; v_r text;
begin
  select ingresso into v_ing from inscritos where nome = 'Bruno Furtado';

  v_r := registrar_checkin(v_ing);
  if v_r <> 'ok' then raise exception 'FALHOU checkin — veio %', v_r; end if;
  raise notice 'ok    diretoria registra a entrada';

  v_r := registrar_checkin(v_ing);
  if v_r <> 'ja_entrou' then raise exception 'FALHOU — segunda leitura deveria ser ja_entrou, veio %', v_r; end if;
  raise notice 'ok    o mesmo ingresso nao entra duas vezes';

  v_r := registrar_checkin(gen_random_uuid());
  if v_r <> 'nao_encontrado' then raise exception 'FALHOU — ingresso inventado veio %', v_r; end if;
  raise notice 'ok    ingresso inventado recusado';
end $$;

-- Inscrição não confirmada não entra.
do $$
declare v_ing uuid; v_r text;
begin
  select ins.ingresso into v_ing
    from inscritos ins join inscricoes i on i.id = ins.inscricao_id
   where i.status <> 'confirmada' limit 1;
  if v_ing is null then
    raise notice 'ok    (sem inscricao pendente no cenario para testar nao_confirmada)';
    return;
  end if;
  v_r := registrar_checkin(v_ing);
  if v_r <> 'nao_confirmada' then raise exception 'FALHOU — pendente entrou: %', v_r; end if;
  raise notice 'ok    inscricao nao confirmada nao entra';
end $$;

-- ============================================================
-- Redefinição de senha
-- ============================================================
set role postgres;
do $$
declare v_token uuid; v_usuario uuid;
begin
  if usuario_por_email('  CONFIRMADO@teste.com ') <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'FALHOU — usuario_por_email deveria ignorar caixa e espaco';
  end if;
  raise notice 'ok    acha a conta pelo e-mail sem diferenciar maiuscula';

  if usuario_por_email('ninguem@teste.com') is not null then
    raise exception 'FALHOU — e-mail inexistente deveria voltar nulo';
  end if;
  raise notice 'ok    e-mail inexistente volta nulo';

  insert into redefinicoes_senha (user_id) values ('11111111-1111-1111-1111-111111111111')
  returning token into v_token;

  v_usuario := consumir_redefinicao(v_token);
  if v_usuario <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'FALHOU — token valido deveria devolver o usuario';
  end if;
  raise notice 'ok    token valido devolve o dono';

  if consumir_redefinicao(v_token) is not null then
    raise exception 'FALHOU — token usado duas vezes';
  end if;
  raise notice 'ok    token de senha nao serve duas vezes';

  insert into redefinicoes_senha (user_id, expira_em)
  values ('11111111-1111-1111-1111-111111111111', now() - interval '1 minute')
  returning token into v_token;
  if consumir_redefinicao(v_token) is not null then
    raise exception 'FALHOU — token vencido aceito';
  end if;
  raise notice 'ok    token de senha vencido recusado';
end $$;

-- Ninguém de fora chama as funções de conta.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  perform espera_erro($x$ select usuario_por_email('confirmado@teste.com') $x$,
    'permission denied', 'usuario_por_email fechada para usuario comum');
  perform espera_erro($x$ select consumir_redefinicao(gen_random_uuid()) $x$,
    'permission denied', 'consumir_redefinicao fechada para usuario comum');
end $$;

-- ============================================================
-- Avisos
-- ============================================================
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare v_evento uuid;
begin
  select id into v_evento from eventos where slug = 'jubigday-2026';
  perform espera_erro(
    format($x$ insert into avisos (evento_id, titulo, mensagem) values (%L, 'x', 'y') $x$, v_evento),
    'row-level security', 'membro nao publica aviso');
end $$;

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
declare v_evento uuid;
begin
  select id into v_evento from eventos where slug = 'jubigday-2026';
  insert into avisos (evento_id, titulo, mensagem) values (v_evento, 'Mudou o local', 'Agora e no ginasio');
  raise notice 'ok    admin publica aviso';
end $$;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  if (select count(*) from avisos) = 0 then
    raise exception 'FALHOU — aviso de evento publicado deveria ser visivel';
  end if;
  raise notice 'ok    aviso de evento publicado visivel para todos';
end $$;

-- ============================================================
-- Cancelamento
-- ============================================================
set role authenticated;

-- Outra pessoa não cancela, e nem descobre que o código existe.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare r text;
begin
  r := cancelar_inscricao('JD-0002', null);
  if r <> 'nao_encontrada' then raise exception 'FALHOU — outro usuario cancelou inscricao alheia: %', r; end if;
  raise notice 'ok    outra pessoa nao cancela inscricao alheia';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Dono não cancela a que já foi paga e confirmada.
do $$
declare r text;
begin
  r := cancelar_inscricao('JD-0001', 'desisti');
  if r <> 'fale_com_diretoria' then raise exception 'FALHOU — dono cancelou inscricao paga: %', r; end if;
  raise notice 'ok    dono nao cancela inscricao ja paga';
end $$;

-- Dono cancela a pendente; a vaga da modalidade e o CPF voltam.
do $$
declare v_codigo text; r text; v_restantes int;
begin
  select i.codigo into v_codigo
    from inscricoes i join inscritos ins on ins.inscricao_id = i.id
   where ins.nome = 'Primeiro Xadrez';

  r := cancelar_inscricao(v_codigo, null);
  if r <> 'ok' then raise exception 'FALHOU — dono nao cancelou a propria pendente: %', r; end if;
  raise notice 'ok    dono cancela a propria inscricao pendente';

  if (select ativo from inscritos where nome = 'Primeiro Xadrez') then
    raise exception 'FALHOU — inscrito continuou ativo depois de cancelar';
  end if;
  raise notice 'ok    inscritos da inscricao cancelada ficam inativos';

  select restantes into v_restantes from vagas_por_esporte where nome = 'Xadrez';
  if v_restantes <> 1 then raise exception 'FALHOU — vaga do xadrez nao voltou (restantes=%)', v_restantes; end if;
  raise notice 'ok    vaga da modalidade volta ao cancelar';

  r := cancelar_inscricao(v_codigo, null);
  if r <> 'ja_cancelada' then raise exception 'FALHOU — segundo cancelamento veio %', r; end if;
  raise notice 'ok    cancelar duas vezes responde ja_cancelada';
end $$;

do $$
declare v_xadrez uuid; v_codigo text;
begin
  select id into v_xadrez from esportes where nome = 'Xadrez';
  v_codigo := criar_inscricao('jubigday-2026', 1, jsonb_build_array(jsonb_build_object(
    'nome','Primeiro Xadrez De Novo','cpf','11144477735','nascimento','2000-01-01',
    'igrejaId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','deBoa',false,'esportes', jsonb_build_array(v_xadrez))));
  raise notice 'ok    mesmo CPF se inscreve de novo depois de cancelar, na mesma vaga (%)', v_codigo;
end $$;

-- Diretoria cancela a de outra pessoa, mas precisa dizer por quê.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare r text;
begin
  r := cancelar_inscricao('JD-0002', '  ');
  if r <> 'motivo_obrigatorio' then raise exception 'FALHOU — diretoria cancelou sem motivo: %', r; end if;
  raise notice 'ok    diretoria precisa de motivo para cancelar a de outra pessoa';

  r := cancelar_inscricao('jd-0002', 'Pediu cancelamento pelo WhatsApp');
  if r <> 'ok' then raise exception 'FALHOU — diretoria nao cancelou: %', r; end if;
  raise notice 'ok    diretoria cancela inscricao de outra pessoa com motivo';

  if (select motivo_cancelamento from inscricoes where codigo = 'JD-0002') is null then
    raise exception 'FALHOU — motivo do cancelamento nao ficou gravado';
  end if;
  raise notice 'ok    motivo e autor do cancelamento ficam gravados';
end $$;

-- ============================================================
-- Igreja só da lista
-- ============================================================
set role postgres;
insert into igrejas (id, nome, cidade, ativa) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'IB Fechada', 'Cascavel', false);

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select espera_erro($x$
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Igreja Inventada","cpf":"39053344705","nascimento":"2000-01-01","igrejaId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'igreja_invalida', 'igreja fora da lista recusada');

select espera_erro($x$
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Igreja Digitada","cpf":"39053344705","nascimento":"2000-01-01","igreja":"PIB Toledo","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'igreja_invalida', 'igreja digitada em texto recusada');

select espera_erro($x$
  select criar_inscricao('jubigday-2026', 1, '[{"nome":"Igreja Fechada","cpf":"39053344705","nascimento":"2000-01-01","igrejaId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'igreja_invalida', 'igreja desativada recusada');

do $$
begin
  if (select igreja from inscritos where nome = 'Bruno Furtado') is distinct from 'PIB Assis (Assis Chateaubriand)'
     or (select igreja_id from inscritos where nome = 'Bruno Furtado') is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'FALHOU — nome da igreja deveria vir do cadastro: %',
      (select igreja from inscritos where nome = 'Bruno Furtado');
  end if;
  raise notice 'ok    nome da igreja gravado a partir do cadastro';
end $$;

set role postgres;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'comigreja@teste.com', now(), '{"nome":"Com Igreja","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'),
  ('66666666-6666-6666-6666-666666666666', 'igrejalixo@teste.com', now(), '{"nome":"Igreja Lixo","igrejaId":"nao-e-uuid"}');

do $$
begin
  if (select igreja_id from perfis where id = '55555555-5555-5555-5555-555555555555') is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then
    raise exception 'FALHOU — perfil deveria guardar a igreja escolhida no cadastro';
  end if;
  raise notice 'ok    cadastro guarda a igreja escolhida';

  if not exists (select 1 from perfis where id = '66666666-6666-6666-6666-666666666666' and igreja_id is null) then
    raise exception 'FALHOU — igreja invalida no cadastro deveria virar nulo sem derrubar a conta';
  end if;
  raise notice 'ok    igreja invalida no cadastro nao derruba a conta';
end $$;

-- ============================================================
-- Eventos criados pelo painel e abertura das inscrições
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select espera_erro($x$
  insert into eventos (slug, prefixo, nome, data_evento, cidade, valor_centavos)
  values ('membro-cria', 'MC', 'Membro Cria', current_date + 30, 'Toledo', 1000)
$x$, 'row-level security', 'membro nao cria evento');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into eventos (slug, prefixo, nome, data_evento, cidade, valor_centavos, publicado, inscricoes_em_breve)
values ('teste-abertura', 'TA', 'Teste Abertura', current_date + 30, 'Toledo', 1000, true, true);
do $$ begin raise notice 'ok    admin cria evento'; end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select espera_erro($x$
  select criar_inscricao('teste-abertura', 1, '[{"nome":"Cedo Demais","cpf":"39053344705","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'inscricoes_nao_abertas', 'inscricoes em breve recusam inscricao');

set role postgres;
update eventos set inscricoes_em_breve = false, inscricoes_de = now() + interval '1 day'
 where slug = 'teste-abertura';
set role authenticated;

select espera_erro($x$
  select criar_inscricao('teste-abertura', 1, '[{"nome":"Antes Da Hora","cpf":"39053344705","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'inscricoes_nao_abertas', 'inscricao antes da hora de abertura recusada');

set role postgres;
update eventos set inscricoes_de = now() - interval '1 minute' where slug = 'teste-abertura';
set role authenticated;

do $$
declare v text;
begin
  v := criar_inscricao('teste-abertura', 1, '[{"nome":"Na Hora Certa","cpf":"39053344705","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb);
  raise notice 'ok    passada a hora de abertura a inscricao entra (%)', v;
end $$;

set role postgres;
update eventos set tem_inscricao = false where slug = 'teste-abertura';
set role authenticated;

select espera_erro($x$
  select criar_inscricao('teste-abertura', 1, '[{"nome":"Tour Sem Inscricao","cpf":"52998224725","nascimento":"2000-01-01","igrejaId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","deBoa":true,"esportes":[]}]'::jsonb)
$x$, 'evento_sem_inscricao', 'evento sem inscricao recusa inscricao direto no banco');

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select espera_erro($x$
  delete from eventos where slug = 'teste-abertura'
$x$, 'foreign key', 'evento com inscricao nao e apagado');

insert into eventos (slug, prefixo, nome, data_evento, cidade, valor_centavos)
values ('teste-apagar', 'AP', 'Teste Apagar', current_date + 30, 'Toledo', 0);
delete from eventos where slug = 'teste-apagar';
do $$
begin
  if exists (select 1 from eventos where slug = 'teste-apagar') then
    raise exception 'FALHOU — admin deveria apagar evento sem inscricao';
  end if;
  raise notice 'ok    admin apaga evento sem inscricao';
end $$;

-- ============================================================
-- Configurações do site e segredos
-- ============================================================
set role anon;
do $$
begin
  if not exists (select 1 from configuracoes where id = 1) then
    raise exception 'FALHOU — configuracoes do site deveriam ser publicas';
  end if;
  raise notice 'ok    configuracoes do site sao publicas';
end $$;

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
update configuracoes set instagram = 'invasor' where id = 1;
do $$
begin
  if (select instagram from configuracoes where id = 1) is not distinct from 'invasor' then
    raise exception 'FALHOU — membro alterou as configuracoes do site';
  end if;
  raise notice 'ok    membro nao altera configuracoes do site';
end $$;

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
update configuracoes set instagram = 'jubigoficial', whatsapp = '5545998112434' where id = 1;
do $$
begin
  if (select instagram from configuracoes where id = 1) is distinct from 'jubigoficial' then
    raise exception 'FALHOU — admin deveria alterar as configuracoes do site';
  end if;
  raise notice 'ok    admin altera configuracoes do site';
end $$;

set role postgres;
insert into segredos (chave, valor) values ('instagram_token', 'segredo-de-teste')
on conflict (chave) do nothing;
set role authenticated;
do $$
begin
  if exists (select 1 from segredos) then
    raise exception 'FALHOU — segredos visiveis para admin logado';
  end if;
  if exists (select 1 from instagram_cache) then
    raise exception 'FALHOU — cache do instagram visivel pelo navegador';
  end if;
  raise notice 'ok    segredos e cache do instagram fechados ate para o admin logado';
end $$;

set role postgres;

-- ============================================================
-- Meu perfil: a pessoa edita os próprios dados, não a confirmação
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select espera_erro($x$
  update perfis set email_confirmado_em = now() where id = '22222222-2222-2222-2222-222222222222'
$x$, 'email_confirmado_em_protegido', 'pessoa nao confirma o proprio e-mail pelo navegador');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update perfis
   set nome = 'Bruno Editado', igreja = 'Texto Qualquer', igreja_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 where id = '11111111-1111-1111-1111-111111111111';

do $$
begin
  if (select nome from perfis where id = '11111111-1111-1111-1111-111111111111') <> 'Bruno Editado' then
    raise exception 'FALHOU — pessoa deveria editar o proprio nome';
  end if;
  raise notice 'ok    pessoa edita o proprio perfil';

  if (select igreja from perfis where id = '11111111-1111-1111-1111-111111111111') <> 'PIB Assis (Assis Chateaubriand)' then
    raise exception 'FALHOU — nome da igreja deveria vir do cadastro, nao do texto enviado';
  end if;
  raise notice 'ok    nome da igreja no perfil vem do cadastro';

  if (select email_confirmado_em from perfis where id = '11111111-1111-1111-1111-111111111111') is null then
    raise exception 'FALHOU — editar o perfil nao pode desconfirmar o e-mail';
  end if;
  raise notice 'ok    editar o perfil mantem a confirmacao do e-mail';
end $$;

set role postgres;

-- ============================================================
-- Formatos de modalidade: oficina, dupla, trio e time sorteado
-- ============================================================
set role postgres;
update eventos set max_esportes_por_turno = 0 where slug = 'jubigday-2026';

insert into esportes (evento_id, nome, turno, vagas, categoria, formato, responsavel)
select ev.id, x.nome, x.turno, 20, x.categoria, x.formato, x.resp
  from eventos ev, (values
    ('Oficina Financas', 'manha', 'oficina', 'individual', 'Thais'),
    ('Oficina Louvor',   'manha', 'oficina', 'individual', null),
    ('Volei Sorteado',   'tarde', 'esporte', 'time_sorteado', null),
    ('Volei de Dupla',   'tarde', 'esporte', 'dupla', null),
    ('Basquete Trio',    'noite', 'esporte', 'trio', null)
  ) as x(nome, turno, categoria, formato, resp)
 where ev.slug = 'jubigday-2026';

create or replace function pessoa_teste(p_nome text, p_cpf text, p_esportes jsonb) returns jsonb
language sql as $f$
  select jsonb_build_array(jsonb_build_object(
    'nome', p_nome, 'cpf', p_cpf, 'nascimento', '2000-01-01',
    'igrejaId', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'deBoa', false, 'esportes', p_esportes))
$f$;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_sort uuid; v_dupla uuid; v_trio uuid; v_of1 uuid; v_of2 uuid; v_cod text;
begin
  select id into v_sort  from esportes where nome = 'Volei Sorteado';
  select id into v_dupla from esportes where nome = 'Volei de Dupla';
  select id into v_trio  from esportes where nome = 'Basquete Trio';
  select id into v_of1   from esportes where nome = 'Oficina Financas';
  select id into v_of2   from esportes where nome = 'Oficina Louvor';

  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      pessoa_teste('Sem Nota', '71428793860', jsonb_build_array(v_sort))::text),
    'nota_obrigatoria', 'time sorteado sem nota de habilidade recusado');

  v_cod := criar_inscricao('jubigday-2026', 1, pessoa_teste('Com Nota', '71428793860',
    jsonb_build_array(jsonb_build_object('id', v_sort, 'nota', 4))));
  if (select ie.nota from inscritos_esportes ie join inscritos i on i.id = ie.inscrito_id
       where i.nome = 'Com Nota') is distinct from 4::smallint then
    raise exception 'FALHOU — nota de habilidade nao ficou gravada';
  end if;
  raise notice 'ok    time sorteado grava a nota de habilidade (%)', v_cod;

  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      pessoa_teste('Dupla Sozinha', '83674281059',
        jsonb_build_array(jsonb_build_object('id', v_dupla, 'parceiros', jsonb_build_array('  '))))::text),
    'parceiros_obrigatorios', 'dupla sem parceiro recusada');

  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      pessoa_teste('Trio Incompleto', '83674281059',
        jsonb_build_array(jsonb_build_object('id', v_trio, 'parceiros', jsonb_build_array('Ana Lima'))))::text),
    'parceiros_obrigatorios', 'trio com um parceiro so recusado');

  v_cod := criar_inscricao('jubigday-2026', 1, pessoa_teste('Dupla Completa', '83674281059',
    jsonb_build_array(jsonb_build_object('id', v_dupla, 'parceiros', jsonb_build_array(' Ana Lima ', 'Sobrando')))));
  if (select ie.parceiros from inscritos_esportes ie join inscritos i on i.id = ie.inscrito_id
       where i.nome = 'Dupla Completa') is distinct from array['Ana Lima'] then
    raise exception 'FALHOU — dupla deveria gravar so um parceiro, limpo';
  end if;
  raise notice 'ok    dupla grava o nome do parceiro (%)', v_cod;

  perform espera_erro(
    format($x$ select criar_inscricao('jubigday-2026', 1, %L::jsonb) $x$,
      pessoa_teste('Duas Oficinas', '62648716050', jsonb_build_array(v_of1, v_of2))::text),
    'oficina_mesmo_turno', 'duas oficinas no mesmo turno recusadas');

  v_cod := criar_inscricao('jubigday-2026', 1, pessoa_teste('Uma Oficina', '62648716050',
    jsonb_build_array(jsonb_build_object('id', v_of1, 'nota', 5))));
  if (select ie.nota from inscritos_esportes ie join inscritos i on i.id = ie.inscrito_id
       where i.nome = 'Uma Oficina') is not null then
    raise exception 'FALHOU — oficina nao deveria guardar nota';
  end if;
  raise notice 'ok    oficina entra e descarta nota (%)', v_cod;

  perform espera_erro(
    format($x$ select trocar_escolhas(%L::uuid, %L::jsonb, false) $x$,
      (select id from inscritos where nome = 'Uma Oficina'),
      jsonb_build_array(jsonb_build_object('id', v_sort))::text),
    'nota_obrigatoria', 'troca para time sorteado sem nota recusada');

  if not exists (select 1 from inscritos_esportes ie join inscritos i on i.id = ie.inscrito_id
                  where i.nome = 'Uma Oficina' and ie.esporte_id = v_of1) then
    raise exception 'FALHOU — troca recusada apagou a escolha antiga';
  end if;
  raise notice 'ok    troca recusada mantem a escolha antiga';

  perform trocar_escolhas((select id from inscritos where nome = 'Uma Oficina'),
    jsonb_build_array(jsonb_build_object('id', v_sort, 'nota', 2)), false);
  if (select ie.nota from inscritos_esportes ie join inscritos i on i.id = ie.inscrito_id
       where i.nome = 'Uma Oficina' and ie.esporte_id = v_sort) is distinct from 2::smallint then
    raise exception 'FALHOU — troca com nota deveria gravar';
  end if;
  raise notice 'ok    troca para time sorteado com nota grava';
end $$;

set role postgres;

select 'TODOS OS TESTES PASSARAM' as resultado;
