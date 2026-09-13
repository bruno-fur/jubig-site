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
-- Mais de uma modalidade no mesmo turno
-- ============================================================
do $$
declare v_a uuid; v_b uuid; v_codigo text;
begin
  select id into v_a from esportes where nome = 'Futsal feminino';   -- manha
  select id into v_b from esportes where nome = 'Tênis de mesa';     -- manha

  v_codigo := criar_inscricao('jubigday-2026', 1, jsonb_build_array(jsonb_build_object(
    'nome','Dois No Mesmo Turno','cpf','00000010073','nascimento','2000-01-01',
    'igreja','PIB Assis','deBoa',false,
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
        'igreja','PIB Assis','deBoa',false,
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
    '[{"nome":"Depois De Confirmar","cpf":"15350946056","nascimento":"2000-01-01","igreja":"PIB Assis","deBoa":true,"esportes":[]}]'::jsonb);
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
    '[{"nome":"Vai No Congresso","cpf":"00000017400","nascimento":"2000-01-01","igreja":"PIB Assis","deBoa":true,"esportes":[]}]'::jsonb);
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

select 'TODOS OS TESTES PASSARAM' as resultado;
