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
  criado_em timestamptz default now()
);

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
  horario text not null,               -- '14h00' — agrupa e detecta conflito
  vagas int not null,
  por_equipe boolean not null default false,
  ordem int not null default 0
);
create index if not exists esportes_evento on esportes (evento_id);

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

-- Mesmo CPF não entra duas vezes no mesmo evento.
-- Índice simples sobre coluna: subquery dentro de índice o Postgres recusa.
create unique index if not exists inscrito_unico_por_evento
  on inscritos (evento_id, cpf);

create table if not exists inscritos_esportes (
  inscrito_id uuid references inscritos on delete cascade,
  esporte_id uuid references esportes on delete cascade,
  primary key (inscrito_id, esporte_id)
);

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

-- Esta é a camada 4 da regra do e-mail confirmado.
create or replace function email_confirmado() returns boolean
language sql stable security definer set search_path = public, auth as $fn$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
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
begin
  insert into perfis (id, nome, telefone, igreja)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.raw_user_meta_data ->> 'telefone',
    new.raw_user_meta_data ->> 'igreja'
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

-- vaga de modalidade e conflito de horário: o formulário avisa, o banco decide
create or replace function conferir_esporte() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_vagas int; v_ocupadas int; v_horario text; v_evento uuid; v_conflito text;
begin
  -- for update segura a linha até o commit: duas caravanas ao mesmo tempo
  -- não conseguem ocupar a mesma última vaga.
  select vagas, horario, evento_id into v_vagas, v_horario, v_evento
    from esportes where id = new.esporte_id
    for update;

  if v_vagas is null then
    raise exception 'modalidade nao encontrada';
  end if;

  if (select evento_id from inscritos where id = new.inscrito_id) is distinct from v_evento then
    raise exception 'modalidade nao pertence ao evento da inscricao';
  end if;

  select e.nome into v_conflito
    from inscritos_esportes ie
    join esportes e on e.id = ie.esporte_id
   where ie.inscrito_id = new.inscrito_id
     and e.horario = v_horario
     and e.id <> new.esporte_id
   limit 1;
  if v_conflito is not null then
    raise exception 'conflito de horario com %', v_conflito;
  end if;

  select count(*) into v_ocupadas from inscritos_esportes where esporte_id = new.esporte_id;
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
  select e.id as esporte_id, e.evento_id, e.nome, e.horario, e.por_equipe, e.ordem,
         e.vagas,
         count(ie.inscrito_id)::int as ocupadas,
         greatest(e.vagas - count(ie.inscrito_id), 0)::int as restantes
    from esportes e
    left join inscritos_esportes ie on ie.esporte_id = e.id
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
create policy "meus esportes" on inscritos_esportes
  for all using (
    exists (select 1 from inscritos ins
             join inscricoes i on i.id = ins.inscricao_id
            where ins.id = inscrito_id
              and (i.responsavel_id = auth.uid() or eh_diretoria()))
  ) with check (
    exists (select 1 from inscritos ins
             join inscricoes i on i.id = ins.inscricao_id
            where ins.id = inscrito_id and i.responsavel_id = auth.uid())
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
