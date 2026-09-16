-- ============================================================
-- JUBIG — esquema
-- Rode inteiro no SQL Editor do Supabase. É idempotente:
-- pode rodar de novo depois de mexer, sem perder dado.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------
do $$ begin
  create type status_inscricao as enum (
    'aguardando_pagamento',
    'em_analise',
    'confirmada',
    'recusada',
    'cancelada'
  );
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------

-- Perfil do usuário (espelha auth.users)
create table if not exists perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  telefone text,                       -- sempre em E.164: +5545999990000
  igreja text,
  -- Preenchido pela nossa confirmação, não pela do Supabase.
  -- Ver "Confirmação de e-mail própria" no fim do arquivo.
  email_confirmado_em timestamptz,
  criado_em timestamptz default now()
);

-- Para bancos criados antes desta coluna existir.
alter table perfis add column if not exists email_confirmado_em timestamptz;

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- jubigday-2026
  prefixo text not null,               -- JD, CC — usado no código da inscrição
  nome text not null,
  descricao text,
  data_evento date not null,
  data_fim date,                       -- eventos de vários dias (Carnaval)
  cidade text not null,
  local_nome text,
  local_endereco text,
  local_mapa_url text,
  valor_centavos int not null,
  idade_minima int not null default 12,
  max_parcelas int not null default 1,
  vagas int,
  inscricoes_ate date,
  troca_esporte_ate_dias int not null default 7,
  pix_chave text,
  pix_nome text,                       -- nome do recebedor no BR Code (máx 25)
  pix_cidade text,                     -- cidade do recebedor no BR Code (máx 15)
  seq_codigo int not null default 0,   -- contador do código, nunca reaproveita
  publicado boolean not null default false,
  criado_em timestamptz default now()
);

create table if not exists esportes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  nome text not null,
  turno text not null,                 -- 'manha' | 'tarde' | 'noite'
  vagas int not null,
  por_equipe boolean not null default false,
  ordem int not null default 0
);
create index if not exists esportes_evento on esportes (evento_id);

/*
 * Era `horario` com texto livre ('14h00'). Virou turno porque é assim que a
 * diretoria monta o dia — e porque horário exato muda até a véspera, enquanto
 * turno não.
 *
 * O de-para roda uma vez em banco já existente; em banco novo não faz nada.
 * Hora abaixo de 12 vira manhã; o resto, tarde.
 */
do $mig$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'esportes' and column_name = 'horario'
  ) then
    alter table esportes rename column horario to turno;

    update esportes set turno = case
      when turno in ('manha', 'tarde', 'noite') then turno
      when turno ~ '^[0-9]{1,2}' and (substring(turno from '^[0-9]{1,2}'))::int < 12 then 'manha'
      else 'tarde'
    end;
  end if;
end $mig$;

alter table esportes drop constraint if exists esportes_turno_valido;
alter table esportes add constraint esportes_turno_valido
  check (turno in ('manha', 'tarde', 'noite'));

/*
 * A mesma tabela serve a dois tipos de atividade:
 *   esporte  — JubigDay: individual, dupla, trio ou time sorteado
 *   oficina  — Congresso: estudo com alguém conduzindo, uma por turno
 *
 * Formato decide o que a pessoa informa ao escolher:
 *   individual     nada
 *   dupla / trio   o nome do(s) parceiro(s) — a própria pessoa monta o grupo
 *   time_sorteado  nota de 1 a 5 da própria habilidade, para a diretoria
 *                  sortear times equilibrados (futebol, vôlei)
 *
 * `formato` nasce do antigo `por_equipe` uma vez só, quando a coluna ainda não
 * existe: equipe virava time sorteado, que é como a JUBIG monta os times.
 */
do $mig$ begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'esportes' and column_name = 'formato'
  ) then
    alter table esportes add column formato text not null default 'individual';
    update esportes set formato = 'time_sorteado' where por_equipe;
  end if;
end $mig$;

alter table esportes add column if not exists categoria text not null default 'esporte';
alter table esportes add column if not exists descricao text;
alter table esportes add column if not exists responsavel text;   -- quem conduz a oficina

alter table esportes drop constraint if exists esportes_categoria_valida;
alter table esportes add constraint esportes_categoria_valida
  check (categoria in ('esporte', 'oficina'));
alter table esportes drop constraint if exists esportes_formato_valido;
alter table esportes add constraint esportes_formato_valido
  check (formato in ('individual', 'dupla', 'trio', 'time_sorteado'));

create table if not exists inscricoes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,         -- JD-0042
  evento_id uuid not null references eventos,
  responsavel_id uuid not null references auth.users,
  status status_inscricao not null default 'aguardando_pagamento',
  parcelas int not null default 1,
  valor_centavos int not null,
  motivo_recusa text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
create index if not exists inscricoes_responsavel on inscricoes (responsavel_id);
create index if not exists inscricoes_evento_status on inscricoes (evento_id, status);

-- Uma inscrição pode ter várias pessoas (caravana da igreja)
create table if not exists inscritos (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references inscricoes on delete cascade,
  evento_id uuid not null references eventos,  -- preenchido por trigger
  nome text not null,
  cpf text not null,                   -- só dígitos
  nascimento date not null,
  telefone text,
  igreja text not null,
  de_boa boolean not null default false,  -- não vai competir
  unique (inscricao_id, cpf)
);
create index if not exists inscritos_inscricao on inscritos (inscricao_id);

/*
 * `ativo` cai para false quando a inscrição é cancelada.
 *
 * Existe porque índice não pode olhar outra tabela: sem esta coluna, o CPF de
 * uma inscrição cancelada continuaria travado e a pessoa não conseguiria se
 * inscrever de novo no mesmo evento.
 */
alter table inscritos add column if not exists ativo boolean not null default true;

-- Mesmo CPF não entra duas vezes no mesmo evento — entre inscrições ativas.
-- Recriado sempre: bancos antigos têm a versão sem o `where ativo`.
drop index if exists inscrito_unico_por_evento;
create unique index inscrito_unico_por_evento
  on inscritos (evento_id, cpf) where ativo;

create table if not exists inscritos_esportes (
  inscrito_id uuid references inscritos on delete cascade,
  esporte_id uuid references esportes on delete cascade,
  primary key (inscrito_id, esporte_id)
);

-- O que a pessoa informou ao escolher (ver "formato" em esportes).
alter table inscritos_esportes add column if not exists nota smallint check (nota between 1 and 5);
alter table inscritos_esportes add column if not exists parceiros text[];

create table if not exists comprovantes (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references inscricoes on delete cascade,
  parcela int not null default 1,
  caminho text not null,               -- chave no bucket privado
  enviado_em timestamptz default now(),
  avaliado_por uuid references auth.users,
  avaliado_em timestamptz,
  aprovado boolean,
  motivo text
);
create index if not exists comprovantes_inscricao on comprovantes (inscricao_id);
create index if not exists comprovantes_pendentes on comprovantes (enviado_em)
  where aprovado is null;

create table if not exists diretoria (
  user_id uuid primary key references auth.users on delete cascade,
  papel text not null default 'membro' -- 'membro' | 'admin'
);

create table if not exists galeria (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos on delete set null,
  caminho text not null,               -- chave no bucket público 'fotos'
  legenda text,
  ordem int not null default 0,
  criado_em timestamptz default now()
);

-- ============================================================
-- Funções de apoio
--
-- security definer porque leem auth.users e a própria diretoria: sem isso a
-- política chamaria a si mesma ou esbarraria em permissão negada.
-- ============================================================

create or replace function eh_diretoria() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from diretoria where user_id = auth.uid())
$fn$;

/*
 * Camada 4 da regra do e-mail confirmado.
 *
 * Olha `perfis.email_confirmado_em`, não `auth.users.email_confirmed_at`: a
 * confirmação é nossa, não do Supabase. Ver o bloco "Confirmação de e-mail
 * própria" no fim deste arquivo.
 */
create or replace function email_confirmado() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from perfis p
    where p.id = auth.uid() and p.email_confirmado_em is not null
  )
$fn$;

-- Código sequencial por evento: JD-0001, CC-0001...
-- Incrementa a linha do evento com lock, então não repete em concorrência
-- nem reaproveita número de inscrição cancelada.
create or replace function gerar_codigo(p_evento_id uuid) returns text
language plpgsql security definer set search_path = public as $fn$
declare v_prefixo text; v_n int;
begin
  update eventos set seq_codigo = seq_codigo + 1
   where id = p_evento_id
   returning prefixo, seq_codigo into v_prefixo, v_n;
  if v_prefixo is null then
    raise exception 'evento % nao encontrado', p_evento_id;
  end if;
  return v_prefixo || '-' || lpad(v_n::text, 4, '0');
end $fn$;

-- Perfil criado junto com a conta.
create or replace function criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- Variáveis soltas, não igrejas%rowtype: a tabela só é criada mais abaixo
  -- neste arquivo, e %rowtype é resolvido na hora de criar a função.
  v_igreja_id uuid;
  v_igreja_nome text;
begin
  -- Igreja vem da lista (ver "Igreja escolhida da lista"). Id que não existe
  -- vira nulo: derrubar o cadastro por isso deixaria a pessoa sem conta e sem
  -- saber por quê — ela escolhe de novo na inscrição.
  if (v_meta ->> 'igrejaId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id, nome || ' (' || cidade || ')' into v_igreja_id, v_igreja_nome
      from igrejas where id = (v_meta ->> 'igrejaId')::uuid and ativa;
  end if;

  insert into perfis (id, nome, telefone, igreja, igreja_id)
  values (
    new.id,
    coalesce(v_meta ->> 'nome', ''),
    v_meta ->> 'telefone',
    v_igreja_nome,
    v_igreja_id
  )
  on conflict (id) do nothing;
  return new;
end $fn$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function criar_perfil();

create or replace function tocar_atualizado_em() returns trigger
language plpgsql as $fn$
begin new.atualizado_em = now(); return new; end $fn$;

drop trigger if exists inscricoes_atualizado_em on inscricoes;
create trigger inscricoes_atualizado_em
  before update on inscricoes
  for each row execute function tocar_atualizado_em();

-- ------------------------------------------------------------
-- Regras que o banco precisa garantir sozinho
-- ------------------------------------------------------------

-- evento_id do inscrito vem sempre da inscrição, nunca do cliente
create or replace function preencher_evento_do_inscrito() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  select i.evento_id into new.evento_id
    from inscricoes i where i.id = new.inscricao_id;
  if new.evento_id is null then
    raise exception 'inscricao % nao encontrada', new.inscricao_id;
  end if;
  return new;
end $fn$;

drop trigger if exists inscritos_evento on inscritos;
create trigger inscritos_evento
  before insert or update of inscricao_id on inscritos
  for each row execute function preencher_evento_do_inscrito();

-- parcelas nunca acima do que o evento permite (regra 6)
create or replace function conferir_parcelas() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_max int;
begin
  select max_parcelas into v_max from eventos where id = new.evento_id;
  if new.parcelas < 1 or new.parcelas > coalesce(v_max, 1) then
    raise exception 'parcelas fora do permitido para este evento (max %)', coalesce(v_max, 1);
  end if;
  return new;
end $fn$;

drop trigger if exists inscricoes_parcelas on inscricoes;
create trigger inscricoes_parcelas
  before insert or update of parcelas on inscricoes
  for each row execute function conferir_parcelas();

-- ============================================================
-- Vaga, e quantas modalidades a pessoa pode pegar no mesmo turno.
--
-- Duas modalidades no mesmo turno eram recusadas como conflito. Agora o
-- limite é configurável por evento: 0 é sem limite, 1 recria o comportamento
-- antigo. O JubigDay e o Congresso não têm o mesmo formato de dia.
--
-- O formulário avisa, o banco decide: a tela pode estar com a contagem de
-- vagas velha, e duas caravanas preenchendo ao mesmo tempo veem a mesma.
-- ============================================================
-- 0 é sem limite; 1 volta ao comportamento antigo, uma modalidade por turno.
alter table eventos add column if not exists max_esportes_por_turno int not null default 0;

create or replace function conferir_esporte() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_vagas int; v_ocupadas int; v_turno text; v_evento uuid;
  v_limite int; v_no_turno int;
  v_categoria text; v_formato text; v_nome text; v_parceiros text[]; v_precisa int;
begin
  -- for update segura a linha até o commit: duas caravanas ao mesmo tempo
  -- não conseguem ocupar a mesma última vaga.
  select vagas, turno, evento_id, categoria, formato, nome
    into v_vagas, v_turno, v_evento, v_categoria, v_formato, v_nome
    from esportes where id = new.esporte_id
    for update;

  if v_vagas is null then
    raise exception 'modalidade nao encontrada';
  end if;

  if (select evento_id from inscritos where id = new.inscrito_id) is distinct from v_evento then
    raise exception 'modalidade nao pertence ao evento da inscricao';
  end if;

  -- O que cada formato exige. O que não se aplica é limpo: oficina não guarda
  -- nota, time sorteado não guarda parceiro.
  if v_categoria = 'oficina' or v_formato = 'individual' then
    new.nota := null;
    new.parceiros := null;
  elsif v_formato = 'time_sorteado' then
    if new.nota is null then
      raise exception 'nota_obrigatoria:%', v_nome;
    end if;
    new.parceiros := null;
  else
    v_precisa := case v_formato when 'dupla' then 1 else 2 end;
    v_parceiros := array(
      select trim(x) from unnest(coalesce(new.parceiros, '{}'::text[])) x where trim(x) <> ''
    );
    if coalesce(array_length(v_parceiros, 1), 0) < v_precisa then
      raise exception 'parceiros_obrigatorios:%', v_nome;
    end if;
    new.parceiros := v_parceiros[1:v_precisa];
    new.nota := null;
  end if;

  -- Oficina ocupa o turno: duas no mesmo turno é estar em dois lugares.
  if v_categoria = 'oficina' and exists (
    select 1 from inscritos_esportes ie
      join esportes e on e.id = ie.esporte_id
     where ie.inscrito_id = new.inscrito_id
       and e.categoria = 'oficina'
       and e.turno = v_turno
       and e.id <> new.esporte_id
  ) then
    raise exception 'oficina_mesmo_turno';
  end if;

  select max_esportes_por_turno into v_limite from eventos where id = v_evento;

  if coalesce(v_limite, 0) > 0 then
    select count(*) into v_no_turno
      from inscritos_esportes ie
      join esportes e on e.id = ie.esporte_id
     where ie.inscrito_id = new.inscrito_id
       and e.turno = v_turno
       and e.id <> new.esporte_id;

    if v_no_turno >= v_limite then
      raise exception 'limite_no_turno:%', v_limite;
    end if;
  end if;

  -- Conta só inscrição ativa: cancelada não segura vaga de ninguém.
  select count(*) into v_ocupadas
    from inscritos_esportes ie
    join inscritos ins on ins.id = ie.inscrito_id
   where ie.esporte_id = new.esporte_id and ins.ativo;
  if v_ocupadas >= v_vagas then
    raise exception 'modalidade lotada';
  end if;

  return new;
end $fn$;

drop trigger if exists inscritos_esportes_regras on inscritos_esportes;
create trigger inscritos_esportes_regras
  before insert on inscritos_esportes
  for each row execute function conferir_esporte();

-- ============================================================
-- Vaga restante por modalidade — contagem pública, sem expor quem se inscreveu.
-- security_invoker desligado de propósito: a view roda como dona e lê
-- inscritos_esportes sem furar a RLS de quem está na lista.
-- ============================================================
drop view if exists vagas_por_esporte;
create view vagas_por_esporte
with (security_invoker = false) as
  select e.id as esporte_id, e.evento_id, e.nome, e.turno, e.por_equipe, e.ordem,
         e.categoria, e.formato, e.descricao, e.responsavel,
         e.vagas,
         count(ie.inscrito_id)::int as ocupadas,
         greatest(e.vagas - count(ie.inscrito_id), 0)::int as restantes
    from esportes e
    join eventos ev on ev.id = e.evento_id
    -- Só escolhas de inscrição ativa ocupam vaga: cancelou, a vaga volta.
    left join inscritos_esportes ie on ie.esporte_id = e.id
      and exists (select 1 from inscritos ins where ins.id = ie.inscrito_id and ins.ativo)
   -- A view roda como dona, então não passa pela RLS da tabela esportes.
   -- Sem este filtro, a modalidade de um evento ainda não publicado
   -- apareceria para qualquer visitante anônimo.
   where ev.publicado or eh_diretoria()
   group by e.id;

grant select on vagas_por_esporte to anon, authenticated;

-- Mesma ideia para a vaga do evento inteiro. Recusada e cancelada não ocupam.
drop view if exists vagas_por_evento;
create view vagas_por_evento
with (security_invoker = false) as
  select e.id as evento_id,
         e.vagas,
         count(i.id) filter (
           where ins.status in ('aguardando_pagamento', 'em_analise', 'confirmada')
         )::int as ocupadas
    from eventos e
    left join inscritos i on i.evento_id = e.id
    left join inscricoes ins on ins.id = i.inscricao_id
   where e.publicado or eh_diretoria()
   group by e.id;

grant select on vagas_por_evento to anon, authenticated;

-- ============================================================
-- RLS — ninguém vê inscrição dos outros; diretoria vê tudo
-- ============================================================
alter table perfis              enable row level security;
alter table eventos             enable row level security;
alter table esportes            enable row level security;
alter table inscricoes          enable row level security;
alter table inscritos           enable row level security;
alter table inscritos_esportes  enable row level security;
alter table comprovantes        enable row level security;
alter table diretoria           enable row level security;
alter table galeria             enable row level security;

drop policy if exists "perfil proprio" on perfis;
create policy "perfil proprio" on perfis
  for all using (id = auth.uid() or eh_diretoria()) with check (id = auth.uid());

drop policy if exists "evento publicado" on eventos;
create policy "evento publicado" on eventos
  for select using (publicado or eh_diretoria());

drop policy if exists "esporte de evento publicado" on esportes;
create policy "esporte de evento publicado" on esportes
  for select using (
    exists (select 1 from eventos e where e.id = evento_id and (e.publicado or eh_diretoria()))
  );

drop policy if exists "minhas inscricoes" on inscricoes;
create policy "minhas inscricoes" on inscricoes
  for select using (responsavel_id = auth.uid() or eh_diretoria());

-- Camada 4 da regra do e-mail confirmado.
drop policy if exists "criar inscricao com email confirmado" on inscricoes;
create policy "criar inscricao com email confirmado" on inscricoes
  for insert with check (responsavel_id = auth.uid() and email_confirmado());

drop policy if exists "diretoria altera status" on inscricoes;
create policy "diretoria altera status" on inscricoes
  for update using (eh_diretoria()) with check (eh_diretoria());

drop policy if exists "meus inscritos" on inscritos;
create policy "meus inscritos" on inscritos
  for all using (
    exists (select 1 from inscricoes i where i.id = inscricao_id
            and (i.responsavel_id = auth.uid() or eh_diretoria()))
  ) with check (
    exists (select 1 from inscricoes i where i.id = inscricao_id
            and i.responsavel_id = auth.uid() and email_confirmado())
  );

drop policy if exists "meus esportes" on inscritos_esportes;
drop policy if exists "ver meus esportes" on inscritos_esportes;
create policy "ver meus esportes" on inscritos_esportes
  for select using (
    exists (select 1 from inscritos ins
             join inscricoes i on i.id = ins.inscricao_id
            where ins.id = inscrito_id
              and (i.responsavel_id = auth.uid() or eh_diretoria()))
  );

/*
 * Escolher e trocar modalidade só até `troca_esporte_ate_dias` antes do
 * evento. A mesma regra vale na criação da inscrição — o que está certo,
 * desde que `inscricoes_ate` seja anterior a esse prazo (no JubigDay:
 * inscrições até 26/09, troca até 10/10). Se alguém inverter isso na tabela
 * de eventos, a inscrição para de funcionar — e é melhor falhar aqui do que
 * aceitar troca depois que a diretoria já fechou as chaves.
 */
drop policy if exists "escolher meus esportes" on inscritos_esportes;
create policy "escolher meus esportes" on inscritos_esportes
  for insert with check (
    exists (select 1 from inscritos ins
             join inscricoes i on i.id = ins.inscricao_id
             join eventos e on e.id = i.evento_id
            where ins.id = inscrito_id
              and i.responsavel_id = auth.uid()
              and current_date <= e.data_evento - e.troca_esporte_ate_dias)
  );

drop policy if exists "desmarcar meus esportes" on inscritos_esportes;
create policy "desmarcar meus esportes" on inscritos_esportes
  for delete using (
    exists (select 1 from inscritos ins
             join inscricoes i on i.id = ins.inscricao_id
             join eventos e on e.id = i.evento_id
            where ins.id = inscrito_id
              and (eh_diretoria()
                   or (i.responsavel_id = auth.uid()
                       and current_date <= e.data_evento - e.troca_esporte_ate_dias)))
  );

drop policy if exists "meus comprovantes" on comprovantes;
create policy "meus comprovantes" on comprovantes
  for select using (
    exists (select 1 from inscricoes i where i.id = inscricao_id
            and (i.responsavel_id = auth.uid() or eh_diretoria()))
  );

drop policy if exists "enviar comprovante proprio" on comprovantes;
create policy "enviar comprovante proprio" on comprovantes
  for insert with check (
    exists (select 1 from inscricoes i where i.id = inscricao_id
            and i.responsavel_id = auth.uid() and email_confirmado())
  );

drop policy if exists "diretoria avalia comprovante" on comprovantes;
create policy "diretoria avalia comprovante" on comprovantes
  for update using (eh_diretoria()) with check (eh_diretoria());

drop policy if exists "ver diretoria" on diretoria;
create policy "ver diretoria" on diretoria
  for select using (user_id = auth.uid() or eh_diretoria());

drop policy if exists "galeria publica" on galeria;
create policy "galeria publica" on galeria for select using (true);

drop policy if exists "diretoria edita galeria" on galeria;
create policy "diretoria edita galeria" on galeria
  for all using (eh_diretoria()) with check (eh_diretoria());

-- ============================================================
-- Storage
-- 'comprovantes' PRIVADO: o arquivo mostra nome, banco e às vezes CPF.
-- 'fotos' público, só para a galeria.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 8388608,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values ('fotos', 'fotos', true, 8388608)
on conflict (id) do update set public = true;

-- O caminho é <inscricao_id>/parcela-N-timestamp, então a primeira pasta
-- identifica a inscrição e é ela que decide quem pode ler e gravar.
drop policy if exists "enviar comprovante do dono" on storage.objects;
create policy "enviar comprovante do dono" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'comprovantes'
    and email_confirmado()
    and exists (
      select 1 from inscricoes i
       where i.id::text = (storage.foldername(name))[1]
         and i.responsavel_id = auth.uid()
    )
  );

drop policy if exists "ler comprovante do dono ou diretoria" on storage.objects;
create policy "ler comprovante do dono ou diretoria" on storage.objects
  for select to authenticated using (
    bucket_id = 'comprovantes'
    and exists (
      select 1 from inscricoes i
       where i.id::text = (storage.foldername(name))[1]
         and (i.responsavel_id = auth.uid() or eh_diretoria())
    )
  );

drop policy if exists "ver fotos" on storage.objects;
create policy "ver fotos" on storage.objects
  for select using (bucket_id = 'fotos');

drop policy if exists "diretoria envia fotos" on storage.objects;
create policy "diretoria envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and eh_diretoria());

-- ============================================================
-- Criação da inscrição em uma transação só.
--
-- Sem isto seriam três inserts separados pelo PostgREST: se a última
-- modalidade lotasse no meio do caminho, ficava uma inscrição com gente
-- dentro e sem esporte, e ninguém para limpar.
--
-- security INVOKER de propósito: roda com a permissão de quem chamou, então a
-- política "criar inscricao com email confirmado" continua valendo aqui — é a
-- camada 4 e ela não pode ser contornada nem por esta função.
-- ============================================================
create or replace function criar_inscricao(
  p_slug text,
  p_parcelas int,
  p_inscritos jsonb
) returns text language plpgsql as $fn$
declare
  v_evento eventos%rowtype;
  v_codigo text;
  v_inscricao uuid;
  v_inscrito uuid;
  v_ocupadas int;
  v_quantos int;
  p jsonb;
  v_item jsonb;
  v_igreja_id uuid;       -- soltas pelo mesmo motivo de criar_perfil
  v_igreja_nome text;
begin
  select * into v_evento from eventos where slug = p_slug and publicado;
  if v_evento.id is null then
    raise exception 'evento_nao_encontrado';
  end if;

  if coalesce(v_evento.inscricoes_ate, v_evento.data_evento) < current_date then
    raise exception 'inscricoes_encerradas';
  end if;

  -- Tour não tem inscrição; sem esta trava, bastava chamar a função direto.
  if not v_evento.tem_inscricao then
    raise exception 'evento_sem_inscricao';
  end if;

  -- "Em breve" e abertura agendada valem aqui também, não só na tela: quem
  -- guardou o link do formulário não entra antes da hora.
  if v_evento.inscricoes_em_breve
     or (v_evento.inscricoes_de is not null and now() < v_evento.inscricoes_de) then
    raise exception 'inscricoes_nao_abertas';
  end if;

  v_quantos := coalesce(jsonb_array_length(p_inscritos), 0);
  if v_quantos < 1 then
    raise exception 'sem_inscritos';
  end if;

  if v_evento.vagas is not null then
    select ocupadas into v_ocupadas from vagas_por_evento where evento_id = v_evento.id;
    if coalesce(v_ocupadas, 0) + v_quantos > v_evento.vagas then
      raise exception 'evento_lotado';
    end if;
  end if;

  v_codigo := gerar_codigo(v_evento.id);

  insert into inscricoes (codigo, evento_id, responsavel_id, parcelas, valor_centavos)
  values (v_codigo, v_evento.id, auth.uid(), p_parcelas,
          v_evento.valor_centavos * v_quantos)
  returning id into v_inscricao;

  for p in select * from jsonb_array_elements(p_inscritos) loop
    if extract(year from age(v_evento.data_evento, (p ->> 'nascimento')::date))
       < v_evento.idade_minima then
      raise exception 'idade_minima:%', p ->> 'nome';
    end if;

    -- Só igreja da lista. O nome gravado sai do cadastro, nunca do que o
    -- navegador mandou: é isso que junta "PIB Toledo" e "Primeira Igreja
    -- Batista de Toledo" numa linha só no painel.
    v_igreja_id := null;
    if (p ->> 'igrejaId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select id, nome || ' (' || cidade || ')' into v_igreja_id, v_igreja_nome
        from igrejas where id = (p ->> 'igrejaId')::uuid and ativa;
    end if;
    if v_igreja_id is null then
      raise exception 'igreja_invalida:%', p ->> 'nome';
    end if;

    insert into inscritos (inscricao_id, nome, cpf, nascimento, telefone, igreja, igreja_id, de_boa)
    values (
      v_inscricao,
      p ->> 'nome',
      regexp_replace(p ->> 'cpf', '\D', '', 'g'),
      (p ->> 'nascimento')::date,
      nullif(p ->> 'telefone', ''),
      v_igreja_nome,
      v_igreja_id,
      coalesce((p ->> 'deBoa')::boolean, false)
    )
    returning id into v_inscrito;

    -- Cada escolha é o id solto (formato antigo) ou {id, nota, parceiros}.
    for v_item in
      select * from jsonb_array_elements(coalesce(p -> 'esportes', '[]'::jsonb))
    loop
      insert into inscritos_esportes (inscrito_id, esporte_id, nota, parceiros)
      values (
        v_inscrito,
        (case when jsonb_typeof(v_item) = 'string' then v_item #>> '{}' else v_item ->> 'id' end)::uuid,
        nullif(v_item ->> 'nota', '')::smallint,
        case when jsonb_typeof(v_item -> 'parceiros') = 'array'
             then array(select jsonb_array_elements_text(v_item -> 'parceiros')) end
      );
    end loop;
  end loop;

  return v_codigo;
end $fn$;

revoke all on function criar_inscricao(text, int, jsonb) from public, anon;
grant execute on function criar_inscricao(text, int, jsonb) to authenticated;

-- ============================================================
-- Comprovante enviado -> inscrição entra em análise.
--
-- Fica no banco porque o dono da inscrição não tem política de update em
-- `inscricoes` (só a diretoria tem). Se o app tentasse mudar o status, a RLS
-- recusaria em silêncio e a inscrição ficaria travada em
-- 'aguardando_pagamento' para sempre.
-- ============================================================
create or replace function ao_enviar_comprovante() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  update inscricoes
     set status = 'em_analise'
   where id = new.inscricao_id
     and status in ('aguardando_pagamento', 'recusada');
  return new;
end $fn$;

drop trigger if exists comprovante_muda_status on comprovantes;
create trigger comprovante_muda_status
  after insert on comprovantes
  for each row execute function ao_enviar_comprovante();

-- ============================================================
-- Troca de modalidade, também em uma transação só.
--
-- Feito por fora seriam um delete e vários inserts separados: se a modalidade
-- nova estivesse lotada, a pessoa perdia a escolha antiga e ficava sem nada.
--
-- security INVOKER: o prazo de troca, a vaga e o conflito de horário continuam
-- sendo decididos pela política e pelo trigger, com a permissão de quem chamou.
-- ============================================================
create or replace function trocar_esporte(
  p_inscrito uuid,
  p_esportes uuid[],
  p_de_boa boolean
) returns void language plpgsql as $fn$
declare v_esporte uuid;
begin
  delete from inscritos_esportes where inscrito_id = p_inscrito;

  foreach v_esporte in array coalesce(p_esportes, '{}'::uuid[]) loop
    insert into inscritos_esportes (inscrito_id, esporte_id) values (p_inscrito, v_esporte);
  end loop;

  update inscritos set de_boa = coalesce(p_de_boa, false) where id = p_inscrito;

  if not found then
    raise exception 'inscrito_nao_encontrado';
  end if;
end $fn$;

revoke all on function trocar_esporte(uuid, uuid[], boolean) from public, anon;
grant execute on function trocar_esporte(uuid, uuid[], boolean) to authenticated;

-- ============================================================
-- Conteúdo da página do evento: a diretoria edita direto no painel do
-- Supabase, sem precisar de deploy.
-- ============================================================
create table if not exists programacao (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  horario text not null,               -- '08h30'
  titulo text not null,
  descricao text,
  ordem int not null default 0
);
create index if not exists programacao_evento on programacao (evento_id);

create table if not exists duvidas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos on delete cascade,  -- null = vale para todos
  pergunta text not null,
  resposta text not null,
  ordem int not null default 0
);

alter table programacao enable row level security;
alter table duvidas     enable row level security;

drop policy if exists "programacao de evento publicado" on programacao;
create policy "programacao de evento publicado" on programacao
  for select using (
    exists (select 1 from eventos e where e.id = evento_id and (e.publicado or eh_diretoria()))
  );

drop policy if exists "diretoria edita programacao" on programacao;
create policy "diretoria edita programacao" on programacao
  for all using (eh_diretoria()) with check (eh_diretoria());

drop policy if exists "duvidas publicas" on duvidas;
create policy "duvidas publicas" on duvidas for select using (true);

drop policy if exists "diretoria edita duvidas" on duvidas;
create policy "diretoria edita duvidas" on duvidas
  for all using (eh_diretoria()) with check (eh_diretoria());

-- ============================================================
-- Confirmação de e-mail própria.
--
-- O Supabase fica com "Confirm email" DESLIGADO. A confirmação dele barra o
-- login de quem não confirmou — e aí a faixa de aviso, que deveria aparecer
-- em toda página logada desde o primeiro login, nunca chega a aparecer. Com a
-- confirmação nossa, a pessoa entra, usa o site e só não consegue se
-- inscrever, que é a regra do projeto.
--
-- Some junto a dependência do SMTP e do template do painel do Supabase: o
-- e-mail sai pelo mesmo caminho dos outros quatro, com o mesmo Juca.
-- ============================================================

create table if not exists confirmacoes_email (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '24 hours',
  usado_em timestamptz
);
create index if not exists confirmacoes_usuario on confirmacoes_email (user_id, criado_em desc);

-- RLS ligada e sem política nenhuma: ninguém lê nem escreve com a chave
-- anônima. Só o service role, pelas rotas do servidor, toca nesta tabela —
-- quem alcançasse um token de outra pessoa confirmaria a conta dela.
alter table confirmacoes_email enable row level security;

/*
 * Consome o token e confirma. Em uma transação só, porque duas abas abrindo o
 * mesmo link ao mesmo tempo poderiam usar o token duas vezes.
 *
 * Devolve o motivo em vez de estourar: a tela precisa saber diferenciar link
 * vencido de link já usado — no segundo caso a conta já está confirmada e não
 * há nada de errado a dizer para a pessoa.
 */
create or replace function confirmar_email(p_token uuid) returns text
language plpgsql security definer set search_path = public as $fn$
declare v_usuario uuid; v_expira timestamptz; v_usado timestamptz;
begin
  select user_id, expira_em, usado_em into v_usuario, v_expira, v_usado
    from confirmacoes_email where token = p_token for update;

  if v_usuario is null then return 'invalido'; end if;
  if v_usado is not null then return 'ja_usado'; end if;
  if v_expira < now() then return 'expirado'; end if;

  update confirmacoes_email set usado_em = now() where token = p_token;
  update perfis set email_confirmado_em = coalesce(email_confirmado_em, now())
   where id = v_usuario;

  -- Os tokens antigos da mesma pessoa perdem a validade junto.
  update confirmacoes_email set usado_em = now()
   where user_id = v_usuario and usado_em is null;

  return 'ok';
end $fn$;

revoke all on function confirmar_email(uuid) from public, anon, authenticated;

-- ============================================================
-- Níveis de acesso
--
-- Três papéis, não dois:
--   admin   — mexe na estrutura: modalidades, evento, e quem entra na equipe
--   membro  — o trabalho do dia a dia: validar comprovante e exportar lista
--   demais  — usuário comum, não enxerga nada da diretoria
--
-- A separação existe porque validar comprovante é tarefa de várias pessoas,
-- mas apagar uma modalidade com gente inscrita dentro não pode ser.
-- ============================================================

alter table diretoria drop constraint if exists diretoria_papel_valido;
alter table diretoria add constraint diretoria_papel_valido
  check (papel in ('admin', 'membro'));

create or replace function eh_admin() returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from diretoria where user_id = auth.uid() and papel = 'admin')
$fn$;

/*
 * Impede ficar sem nenhum admin.
 *
 * Sem isto, o último admin se rebaixa por engano e ninguém mais consegue
 * mexer na equipe nem nas modalidades — só com acesso direto ao banco.
 */
create or replace function proteger_ultimo_admin() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_restantes int;
begin
  select count(*) into v_restantes from diretoria
   where papel = 'admin' and user_id <> coalesce(old.user_id, new.user_id);

  if v_restantes = 0 and (tg_op = 'DELETE' or new.papel <> 'admin') then
    raise exception 'ultimo_admin';
  end if;
  return coalesce(new, old);
end $fn$;

drop trigger if exists diretoria_ultimo_admin on diretoria;
create trigger diretoria_ultimo_admin
  before update or delete on diretoria
  for each row when (old.papel = 'admin')
  execute function proteger_ultimo_admin();

-- Só admin mexe em quem é da equipe.
drop policy if exists "admin gerencia diretoria" on diretoria;
create policy "admin gerencia diretoria" on diretoria
  for all using (eh_admin()) with check (eh_admin());

-- Só admin cria e apaga modalidade; a diretoria inteira apenas lê.
drop policy if exists "admin gerencia esportes" on esportes;
create policy "admin gerencia esportes" on esportes
  for all using (eh_admin()) with check (eh_admin());

drop policy if exists "admin edita evento" on eventos;
create policy "admin edita evento" on eventos
  for update using (eh_admin()) with check (eh_admin());

-- ============================================================
-- Painel: números do evento sem expor quem se inscreveu.
--
-- View como dona, igual às de vaga: a diretoria enxerga tudo pela RLS, mas
-- contar aqui evita puxar a lista inteira de inscritos só para somar.
-- ============================================================
drop view if exists painel_evento;
create view painel_evento
with (security_invoker = false) as
  select
    e.id as evento_id,
    e.slug,
    e.nome,
    e.data_evento,
    e.publicado,
    e.valor_centavos,
    count(distinct i.id) filter (where i.status <> 'cancelada')                  as inscricoes,
    count(distinct i.id) filter (where i.status = 'confirmada')                  as confirmadas,
    count(distinct i.id) filter (where i.status = 'em_analise')                  as em_analise,
    count(distinct i.id) filter (where i.status = 'aguardando_pagamento')        as aguardando,
    count(distinct i.id) filter (where i.status = 'recusada')                    as recusadas,
    count(distinct ins.id) filter (where i.status <> 'cancelada')                as pessoas,
    count(distinct ins.id) filter (where i.status = 'confirmada')                as pessoas_confirmadas,
    count(distinct ins.igreja) filter (where i.status <> 'cancelada')            as igrejas,
    coalesce(sum(i.valor_centavos) filter (where i.status = 'confirmada'), 0)    as recebido_centavos,
    coalesce(sum(i.valor_centavos) filter (
      where i.status in ('aguardando_pagamento', 'em_analise')), 0)              as a_receber_centavos
  from eventos e
  left join inscricoes i on i.evento_id = e.id
  left join inscritos ins on ins.inscricao_id = i.id
  -- A view roda como dona, então precisa filtrar sozinha: sem isto, qualquer
  -- pessoa logada lia o faturamento do evento pela API.
  where eh_diretoria()
  group by e.id;

revoke all on painel_evento from anon, authenticated;
grant select on painel_evento to authenticated;

-- Quantas pessoas por igreja, para a diretoria saber de onde vem a caravana.
drop view if exists painel_igrejas;
create view painel_igrejas
with (security_invoker = false) as
  select i.evento_id, ins.igreja, count(*)::int as pessoas
    from inscritos ins
    join inscricoes i on i.id = ins.inscricao_id
   where i.status <> 'cancelada' and eh_diretoria()
   group by i.evento_id, ins.igreja;

revoke all on painel_igrejas from anon, authenticated;
grant select on painel_igrejas to authenticated;

-- ============================================================
-- Tipos de evento
--
-- Três formatos diferentes, e tratar todos como JubigDay era o erro:
--   jubigday   — um dia, com modalidades e inscrição paga
--   congresso  — vários dias, inscrição paga, SEM modalidades
--   tour       — visita a uma igreja, sem inscrição; entra só na agenda
--
-- As duas capacidades são colunas separadas, não deduzidas do tipo. Um
-- congresso que um dia resolva ter modalidades vira um UPDATE, não um deploy.
-- ============================================================

alter table eventos add column if not exists tipo text not null default 'jubigday';
alter table eventos drop constraint if exists eventos_tipo_valido;
alter table eventos add constraint eventos_tipo_valido
  check (tipo in ('jubigday', 'congresso', 'tour'));

alter table eventos add column if not exists tem_inscricao boolean not null default true;
alter table eventos add column if not exists tem_modalidades boolean not null default true;

/*
 * Abertura das inscrições, controlada pelo painel:
 *   inscricoes_em_breve = true      "Em breve", sem data
 *   inscricoes_de no futuro         abre sozinha na data e hora, com contagem
 *   nenhum dos dois                 abertas até inscricoes_ate
 */
alter table eventos add column if not exists inscricoes_de timestamptz;
alter table eventos add column if not exists inscricoes_em_breve boolean not null default false;
-- Hora de início, para a contagem regressiva chegar no minuto certo.
alter table eventos add column if not exists hora_inicio time;

-- ============================================================
-- Igrejas da união
--
-- Servem ao mapa da home e ao JubigTour, que acontece dentro de uma delas.
-- Latitude e longitude ficam nulas até alguém preencher: o mapa mostra só
-- quem tem coordenada, e a lista mostra todas.
-- ============================================================
create table if not exists igrejas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text not null,
  estado text not null default 'PR',
  endereco text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  responsavel text,
  telefone text,                       -- E.164, como todo telefone aqui
  instagram text,
  ativa boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz default now()
);
create index if not exists igrejas_cidade on igrejas (cidade);

-- O tour acontece numa igreja; os outros eventos não têm igreja anfitriã.
alter table eventos add column if not exists igreja_id uuid references igrejas on delete set null;

alter table igrejas enable row level security;

drop policy if exists "igrejas publicas" on igrejas;
create policy "igrejas publicas" on igrejas
  for select using (ativa or eh_diretoria());

drop policy if exists "admin gerencia igrejas" on igrejas;
create policy "admin gerencia igrejas" on igrejas
  for all using (eh_admin()) with check (eh_admin());

/*
 * Agenda pública: todo evento publicado, passado e futuro.
 *
 * `eventos` já é legível por quem é do público, mas a home precisa da contagem
 * de inscritos junto — e essa não pode sair da tabela `inscritos`, que é
 * privada. Por isso a view roda como dona e devolve só o número.
 */
drop view if exists agenda;
create view agenda
with (security_invoker = false) as
  select
    e.id,
    e.slug,
    e.tipo,
    e.nome,
    e.descricao,
    e.data_evento,
    e.data_fim,
    e.cidade,
    e.local_nome,
    e.valor_centavos,
    e.tem_inscricao,
    e.tem_modalidades,
    e.inscricoes_ate,
    e.inscricoes_de,
    e.inscricoes_em_breve,
    e.hora_inicio,
    i.nome as igreja_nome,
    count(distinct ins.id) filter (
      where insc.status in ('aguardando_pagamento', 'em_analise', 'confirmada')
    )::int as pessoas
  from eventos e
  left join igrejas i on i.id = e.igreja_id
  left join inscricoes insc on insc.evento_id = e.id
  left join inscritos ins on ins.inscricao_id = insc.id
  where e.publicado
  group by e.id, i.nome;

grant select on agenda to anon, authenticated;

-- ============================================================
-- Ingresso e check-in
--
-- Um ingresso por pessoa, não por inscrição: numa caravana de 15, cada um
-- entra com o próprio QR. O código é um uuid aleatório — o QR aponta para
-- /diretoria/ingresso/<uuid>, e só quem é da diretoria abre essa página.
-- Quem fotografar o QR de outra pessoa não vê nome, CPF nem nada.
-- ============================================================
alter table inscritos add column if not exists ingresso uuid not null default gen_random_uuid();
create unique index if not exists inscritos_ingresso on inscritos (ingresso);
alter table inscritos add column if not exists checkin_em timestamptz;
alter table inscritos add column if not exists checkin_por uuid references auth.users;

/*
 * Ingresso e check-in só mudam pela diretoria.
 *
 * A política "meus inscritos" deixa o dono atualizar a própria linha — sem
 * esta trava, ele apagaria o `checkin_em` depois de entrar e passaria o print
 * do QR para um amigo usar de novo na porta.
 */
/*
 * SECURITY INVOKER de propósito. Em `security definer`, `current_user` vira o
 * dono da função (postgres) e a lista abaixo liberava todo mundo — o teste
 * pegou o dono apagando o próprio check-in. Rodando como quem chamou, o
 * usuário comum aparece como `authenticated` e é barrado; `registrar_checkin`,
 * que é definer, aparece como postgres e passa.
 */
create or replace function proteger_ingresso() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or eh_diretoria() then
    return new;
  end if;
  if new.ingresso is distinct from old.ingresso
     or new.checkin_em is distinct from old.checkin_em
     or new.checkin_por is distinct from old.checkin_por then
    raise exception 'ingresso_protegido';
  end if;
  return new;
end $fn$;

drop trigger if exists inscritos_protege_ingresso on inscritos;
create trigger inscritos_protege_ingresso
  before update on inscritos
  for each row execute function proteger_ingresso();

/*
 * Registra a entrada. Uma vez só, e só com a inscrição confirmada.
 *
 * Em transação com `for update`: dois leitores na porta escaneando o mesmo QR
 * no mesmo segundo não registram duas entradas. Devolve o motivo em vez de
 * estourar, porque a tela da portaria precisa dizer "já entrou às 19h04",
 * não "erro".
 */
create or replace function registrar_checkin(p_ingresso uuid) returns text
language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_checkin timestamptz; v_status status_inscricao;
begin
  if not eh_diretoria() then return 'sem_permissao'; end if;

  select ins.id, ins.checkin_em, i.status into v_id, v_checkin, v_status
    from inscritos ins
    join inscricoes i on i.id = ins.inscricao_id
   where ins.ingresso = p_ingresso
   for update of ins;

  if v_id is null then return 'nao_encontrado'; end if;
  if v_status <> 'confirmada' then return 'nao_confirmada'; end if;
  if v_checkin is not null then return 'ja_entrou'; end if;

  update inscritos set checkin_em = now(), checkin_por = auth.uid() where id = v_id;
  return 'ok';
end $fn$;

revoke all on function registrar_checkin(uuid) from public, anon;
grant execute on function registrar_checkin(uuid) to authenticated;

-- ============================================================
-- Endereço das igrejas em partes
--
-- `endereco` continua existindo como texto pronto para exibir; as partes
-- servem ao formulário (CEP preenche o resto) e à busca da coordenada.
-- ============================================================
alter table igrejas add column if not exists cep text;
alter table igrejas add column if not exists logradouro text;
alter table igrejas add column if not exists numero text;
alter table igrejas add column if not exists complemento text;
alter table igrejas add column if not exists bairro text;

-- ============================================================
-- Redefinição de senha própria
--
-- Mesmo motivo da confirmação de e-mail: o e-mail do Supabase não passa pelo
-- nosso SMTP nem pelo nosso template. Token de 1 hora, uso único, e tabela
-- sem política de RLS — só o service role alcança.
-- ============================================================
create table if not exists redefinicoes_senha (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '1 hour',
  usado_em timestamptz
);
create index if not exists redefinicoes_usuario on redefinicoes_senha (user_id, criado_em desc);
alter table redefinicoes_senha enable row level security;

/*
 * Acha a conta pelo e-mail sem listar todos os usuários.
 *
 * `auth.admin.listUsers` pagina de 1000 em 1000 e traz tudo — para achar um
 * e-mail, ler a base inteira. Aqui é uma consulta indexada. Só o service role
 * executa: exposta ao público, viraria um jeito de testar quem tem conta.
 */
create or replace function usuario_por_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $fn$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$fn$;

revoke all on function usuario_por_email(text) from public, anon, authenticated;

/*
 * Valida e consome o token numa tacada, devolvendo de quem é.
 * Se a troca de senha falhar depois, a rota devolve o token (usado_em = null).
 */
create or replace function consumir_redefinicao(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare v_usuario uuid;
begin
  update redefinicoes_senha
     set usado_em = now()
   where token = p_token and usado_em is null and expira_em > now()
  returning user_id into v_usuario;
  return v_usuario;
end $fn$;

revoke all on function consumir_redefinicao(uuid) from public, anon, authenticated;

-- ============================================================
-- Avisos e lembretes
--
-- Aviso: a diretoria escreve uma atualização do evento, que aparece na página
-- dele e vai por e-mail para cada responsável de inscrição ativa.
--
-- Lembrete: e-mail automático perto da data. A tabela de enviados impede o
-- mesmo lembrete de sair duas vezes se a rotina rodar de novo no mesmo dia.
-- ============================================================
create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  titulo text not null,
  mensagem text not null,
  criado_por uuid references auth.users,
  criado_em timestamptz not null default now(),
  enviados int not null default 0
);
create index if not exists avisos_evento on avisos (evento_id, criado_em desc);

alter table avisos enable row level security;

drop policy if exists "avisos de evento publicado" on avisos;
create policy "avisos de evento publicado" on avisos
  for select using (
    exists (select 1 from eventos e where e.id = evento_id and (e.publicado or eh_diretoria()))
  );

drop policy if exists "admin publica avisos" on avisos;
create policy "admin publica avisos" on avisos
  for all using (eh_admin()) with check (eh_admin());

create table if not exists lembretes_enviados (
  evento_id uuid not null references eventos on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('semana', 'vespera')),
  enviado_em timestamptz not null default now(),
  primary key (evento_id, user_id, tipo)
);
alter table lembretes_enviados enable row level security;

-- ============================================================
-- Cancelamento
--
-- Quem pode cancelar:
--   dono      — enquanto não pagou (aguardando, em análise, recusada)
--   diretoria — qualquer uma, com motivo obrigatório quando não é dela
--
-- Dono não cancela inscrição confirmada porque ali tem dinheiro pago e
-- devolução é manual: cancelar sozinho tiraria a vaga sem ninguém da
-- diretoria saber que precisa devolver o PIX.
-- ============================================================
alter table inscricoes add column if not exists cancelada_em timestamptz;
alter table inscricoes add column if not exists cancelada_por uuid references auth.users;
alter table inscricoes add column if not exists motivo_cancelamento text;

-- Inscrições canceladas antes desta coluna existir.
update inscritos ins set ativo = false
  from inscricoes i
 where i.id = ins.inscricao_id and i.status = 'cancelada' and ins.ativo;

create or replace function cancelar_inscricao(p_codigo text, p_motivo text) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid; v_dono uuid; v_status status_inscricao; v_diretoria boolean;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select id, responsavel_id, status into v_id, v_dono, v_status
    from inscricoes where codigo = upper(trim(p_codigo))
    for update;

  v_diretoria := eh_diretoria();

  -- Inscrição de outra pessoa responde igual à inexistente: não confirma
  -- para quem não é da diretoria que aquele código existe.
  if v_id is null or (not v_diretoria and v_dono <> auth.uid()) then
    return 'nao_encontrada';
  end if;

  if v_status = 'cancelada' then return 'ja_cancelada'; end if;

  if not v_diretoria and v_status = 'confirmada' then
    return 'fale_com_diretoria';
  end if;

  if v_diretoria and v_dono <> auth.uid() and (v_motivo is null or length(v_motivo) < 5) then
    return 'motivo_obrigatorio';
  end if;

  update inscricoes
     set status = 'cancelada',
         cancelada_em = now(),
         cancelada_por = auth.uid(),
         motivo_cancelamento = v_motivo
   where id = v_id;

  update inscritos set ativo = false where inscricao_id = v_id;

  return 'ok';
end $fn$;

revoke all on function cancelar_inscricao(text, text) from public, anon;
grant execute on function cancelar_inscricao(text, text) to authenticated;

-- ============================================================
-- Igreja escolhida da lista
--
-- Com texto livre, a mesma igreja chegava como "PIB Toledo" e "Primeira Igreja
-- Batista de Toledo", e o painel por igreja contava duas. Agora perfil e
-- inscrito apontam para `igrejas`; a coluna `igreja` continua com o nome
-- pronto, "Nome (Cidade)", para CSV, ingresso e portaria, que já leem texto.
--
-- Quem se cadastrou antes fica com igreja_id nulo e o texto que digitou.
-- ============================================================
alter table perfis add column if not exists igreja_id uuid references igrejas on delete set null;
alter table inscritos add column if not exists igreja_id uuid references igrejas on delete set null;

-- ============================================================
-- Painel de administração do site
--
-- O que antes só mudava no código ou em variável de ambiente (WhatsApp,
-- Instagram, texto do "Quem somos", criação de evento) passa a ser editado
-- em Diretoria > Site e Diretoria > Eventos.
-- ============================================================

-- Admin cria e apaga evento pela tela. Apagar evento com inscrição falha na
-- chave estrangeira — de propósito: inscrição paga não some.
drop policy if exists "admin cria evento" on eventos;
create policy "admin cria evento" on eventos
  for insert with check (eh_admin());

drop policy if exists "admin apaga evento" on eventos;
create policy "admin apaga evento" on eventos
  for delete using (eh_admin());

-- Configurações do site: uma linha só (id = 1).
create table if not exists configuracoes (
  id int primary key default 1 check (id = 1),
  whatsapp text,                       -- só dígitos, com DDI: 5545999990000
  instagram text,                      -- sem @
  email_contato text,
  quem_somos text,
  atualizado_em timestamptz default now(),
  atualizado_por uuid references auth.users on delete set null
);
insert into configuracoes (id) values (1) on conflict (id) do nothing;

alter table configuracoes enable row level security;

drop policy if exists "configuracoes publicas" on configuracoes;
create policy "configuracoes publicas" on configuracoes
  for select using (true);

drop policy if exists "admin edita configuracoes" on configuracoes;
create policy "admin edita configuracoes" on configuracoes
  for update using (eh_admin()) with check (eh_admin());

/*
 * Segredos que o site precisa guardar (hoje, a chave do Instagram).
 *
 * RLS ligada e nenhuma política: ninguém logado lê, nem admin. Só o servidor,
 * com a service role. A chave dá acesso à conta do Instagram — não pode
 * aparecer em resposta de API nem no navegador de ninguém.
 */
create table if not exists segredos (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz default now()
);
alter table segredos enable row level security;

-- Últimas postagens do Instagram, guardadas para a home não chamar a API a
-- cada visita. Também só pelo servidor.
create table if not exists instagram_cache (
  id int primary key default 1 check (id = 1),
  usuario text,
  postagens jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz,
  token_renovado_em timestamptz,
  token_expira_em timestamptz,
  erro text
);
insert into instagram_cache (id) values (1) on conflict (id) do nothing;
alter table instagram_cache enable row level security;

-- ============================================================
-- Perfil editado pela própria pessoa (Meu perfil)
--
-- A política "perfil proprio" deixa o dono atualizar a própria linha — e isso
-- incluía `email_confirmado_em`. Bastava um update pelo navegador para pular a
-- confirmação e cair direto na camada 4 aberta. Agora só o servidor mexe
-- nesse campo: a função de confirmação (security definer) e o admin (service
-- role).
--
-- SECURITY INVOKER de propósito, como em proteger_ingresso: dentro de uma
-- função definer, current_user vira o dono dela; aqui precisamos ver quem
-- chamou de verdade.
--
-- De carona: com igreja_id preenchido, o nome da igreja sai sempre do
-- cadastro — ninguém grava "PIB Toledo" à mão com o id de outra igreja.
-- ============================================================
create or replace function proteger_perfil() returns trigger
language plpgsql as $fn$
begin
  if current_user in ('authenticated', 'anon')
     and new.email_confirmado_em is distinct from old.email_confirmado_em then
    raise exception 'email_confirmado_em_protegido';
  end if;

  if new.igreja_id is not null then
    select nome || ' (' || cidade || ')' into new.igreja
      from igrejas where id = new.igreja_id;
  end if;

  return new;
end $fn$;

drop trigger if exists perfil_protegido on perfis;
create trigger perfil_protegido
  before update on perfis
  for each row execute function proteger_perfil();

-- ============================================================
-- Troca de modalidade com os detalhes da escolha (nota, parceiros).
--
-- Substitui trocar_esporte, que só recebia ids. Mesma transação única:
-- se a escolha nova for recusada, a antiga continua lá.
-- ============================================================
create or replace function trocar_escolhas(
  p_inscrito uuid,
  p_escolhas jsonb,
  p_de_boa boolean
) returns void language plpgsql as $fn$
declare v_item jsonb;
begin
  delete from inscritos_esportes where inscrito_id = p_inscrito;

  for v_item in select * from jsonb_array_elements(coalesce(p_escolhas, '[]'::jsonb)) loop
    insert into inscritos_esportes (inscrito_id, esporte_id, nota, parceiros)
    values (
      p_inscrito,
      (v_item ->> 'id')::uuid,
      nullif(v_item ->> 'nota', '')::smallint,
      case when jsonb_typeof(v_item -> 'parceiros') = 'array'
           then array(select jsonb_array_elements_text(v_item -> 'parceiros')) end
    );
  end loop;

  update inscritos set de_boa = coalesce(p_de_boa, false) where id = p_inscrito;
  if not found then
    raise exception 'inscrito_nao_encontrado';
  end if;
end $fn$;

revoke all on function trocar_escolhas(uuid, jsonb, boolean) from public, anon;
grant execute on function trocar_escolhas(uuid, jsonb, boolean) to authenticated;
