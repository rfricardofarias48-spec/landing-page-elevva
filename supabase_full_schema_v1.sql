-- ============================================================================
-- Elevva Recrutamento — Schema completo (v1)
-- Gerado a partir do banco de produção original (VeloRH) em 2026-07-12.
-- Cole este arquivo inteiro no SQL Editor do projeto Supabase NOVO e execute.
-- Idempotente: pode rodar mais de uma vez sem quebrar (usa IF NOT EXISTS).
--
-- Não inclui: tabelas de SDR (sdr_leads/sdr_conversations/sdr_demo_slots/
-- sdr_generation_log) — não existiam nem no banco original, e a
-- funcionalidade comercial/SDR foi removida do app. Também não inclui as
-- views chips_pool_summary / salesperson_commission_summary, usadas só
-- pelas telas de Vendas/Vendedores que também foram removidas.
-- ============================================================================

-- ── 1. profiles (extensão de auth.users) ────────────────────────────────────
create table if not exists public.profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  email                     text not null,
  name                      text,
  phone                     text,
  role                      text not null default 'USER',
  status                    text default 'ACTIVE',
  plan                      text not null default 'MENSAL',
  job_limit                 integer default 1,
  resume_limit              integer default 20,
  resume_usage              integer default 0,
  subscription_status       text default 'active',
  current_period_end        timestamptz,
  plan_price                numeric,
  salesperson               text,
  instancia_evolution       varchar(255),
  telefone_agente           varchar(50),
  status_automacao          boolean default false,
  evolution_instance        text,
  evolution_token           text,
  whatsapp_number           text,
  onboarded_at              timestamptz,
  welcome_sent              boolean default false,
  google_calendar_id        text,
  google_refresh_token      text,
  has_calendar_integration  boolean default false,
  chatwoot_account_id       integer,
  chatwoot_token            text,
  chatwoot_inbox_id         integer,
  chatwoot_user_id          integer,
  chatwoot_user_token       text,
  api_token                 text unique,
  portal_code               varchar(8) unique,
  sale_id                   uuid,
  created_at                timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- ── 2. niches ────────────────────────────────────────────────────────────
create table if not exists public.niches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  name       text not null,
  order_pos  integer default 0,
  is_pinned  boolean default false,
  created_at timestamptz default now()
);
alter table public.niches enable row level security;
drop policy if exists "niches_own" on public.niches;
create policy "niches_own" on public.niches for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 3. jobs ──────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles(id),
  title        text not null,
  description  text,
  criteria     text,
  short_code   text,
  is_pinned    boolean not null default false,
  is_paused    boolean default false,
  auto_analyze boolean default false,
  niche_id     uuid references public.niches(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.jobs enable row level security;
drop policy if exists "jobs_own" on public.jobs;
create policy "jobs_own" on public.jobs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Leitura pública por short_code (link de vaga compartilhável)
drop policy if exists "jobs_public_by_short_code" on public.jobs;
create policy "jobs_public_by_short_code" on public.jobs for select
  using (short_code is not null);

-- ── 4. candidates ────────────────────────────────────────────────────────
create table if not exists public.candidates (
  id                        uuid primary key default gen_random_uuid(),
  job_id                    uuid not null references public.jobs(id) on delete cascade,
  user_id                   uuid default auth.uid(),
  file_name                 text,
  filename                  text,
  file_path                 text,
  status                    text not null,
  analysis_result           jsonb,
  match_score               numeric,
  "WhatsApp com DDD"        text,
  "Nome Completo"           text,
  chatwoot_conversation_id  text,
  is_selected               boolean not null default false,
  created_at                timestamptz not null default now()
);
alter table public.candidates enable row level security;
drop policy if exists "candidates_via_job_owner" on public.candidates;
create policy "candidates_via_job_owner" on public.candidates for all
  using (exists (select 1 from public.jobs where jobs.id = candidates.job_id and jobs.user_id = auth.uid()))
  with check (exists (select 1 from public.jobs where jobs.id = candidates.job_id and jobs.user_id = auth.uid()));
-- Inserção pública (candidato envia currículo sem estar logado)
drop policy if exists "candidates_public_insert" on public.candidates;
create policy "candidates_public_insert" on public.candidates for insert
  with check (true);

-- ── 5. availability_slots (horários de entrevista do recrutador) ──────────
create table if not exists public.availability_slots (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  slot_date            date not null,
  slot_time            time not null,
  interviewer_name     text,
  format               text not null default 'ONLINE',
  location             text,
  is_booked            boolean default false,
  booked_interview_id  uuid, -- FK adicionada depois que "interviews" existir
  created_at           timestamptz default now()
);
alter table public.availability_slots enable row level security;
drop policy if exists "availability_slots_own" on public.availability_slots;
create policy "availability_slots_own" on public.availability_slots for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Leitura pública dos horários livres (portal do candidato)
drop policy if exists "availability_slots_public_read" on public.availability_slots;
create policy "availability_slots_public_read" on public.availability_slots for select
  using (is_booked = false);

-- ── 6. interviews ────────────────────────────────────────────────────────
create table if not exists public.interviews (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid references public.candidates(id) on delete cascade,
  job_id                 uuid references public.jobs(id) on delete cascade,
  slot_id                uuid references public.availability_slots(id) on delete set null,
  status                 text default 'AGUARDANDO_RESPOSTA',
  lembrete_enviado       boolean default false,
  google_event_id        text,
  interviewer_name       text,
  slot_date              date,
  slot_time              time,
  meeting_link           text,
  opcoes_reagendamento   text,
  scheduling_token       text unique,
  created_at             timestamptz default timezone('utc'::text, now())
);
alter table public.interviews enable row level security;
drop policy if exists "interviews_via_job_owner" on public.interviews;
create policy "interviews_via_job_owner" on public.interviews for all
  using (exists (select 1 from public.jobs where jobs.id = interviews.job_id and jobs.user_id = auth.uid()))
  with check (exists (select 1 from public.jobs where jobs.id = interviews.job_id and jobs.user_id = auth.uid()));

-- Agora que interviews existe, fecha o FK circular de availability_slots
alter table public.availability_slots
  drop constraint if exists availability_slots_booked_interview_id_fkey;
alter table public.availability_slots
  add constraint availability_slots_booked_interview_id_fkey
  foreign key (booked_interview_id) references public.interviews(id) on delete set null;

-- ── 6b. interview_slots (legado — mantido por compatibilidade) ────────────
create table if not exists public.interview_slots (
  id                uuid default gen_random_uuid() primary key,
  job_id            uuid references public.jobs(id) on delete cascade,
  format            text not null check (format in ('ONLINE', 'PRESENCIAL')),
  location          text,
  interviewer_name  text,
  slot_date         date not null,
  slot_time         time not null,
  is_booked         boolean default false,
  created_at        timestamptz default timezone('utc'::text, now())
);
alter table public.interview_slots enable row level security;
drop policy if exists "interview_slots_via_job_owner" on public.interview_slots;
create policy "interview_slots_via_job_owner" on public.interview_slots for all
  using (exists (select 1 from public.jobs where jobs.id = interview_slots.job_id and jobs.user_id = auth.uid()))
  with check (exists (select 1 from public.jobs where jobs.id = job_id and jobs.user_id = auth.uid()));

-- ── 7. agent_conversations (estado do agente Bento por candidato) ─────────
create table if not exists public.agent_conversations (
  id                        uuid primary key default gen_random_uuid(),
  phone                     text not null,
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  job_id                    uuid references public.jobs(id) on delete set null,
  state                     text not null default 'NOVO',
  context                   jsonb not null default '{}'::jsonb,
  human_takeover            boolean default false,
  chatwoot_conversation_id  integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (phone, user_id)
);
alter table public.agent_conversations enable row level security;
drop policy if exists "agent_conversations_own" on public.agent_conversations;
create policy "agent_conversations_own" on public.agent_conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 8. admissions (documentos de admissão do aprovado) ─────────────────────
create table if not exists public.admissions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  job_id           uuid references public.jobs(id) on delete cascade,
  candidate_id     uuid references public.candidates(id) on delete cascade,
  token            uuid not null default gen_random_uuid() unique,
  required_docs    jsonb not null default '[]'::jsonb,
  submitted_docs   jsonb default '[]'::jsonb,
  status           text not null default 'PENDING',
  created_at       timestamptz default timezone('utc'::text, now()),
  submitted_at     timestamptz,
  expires_at       timestamptz,
  expiry_notified  boolean default false
);
alter table public.admissions enable row level security;
drop policy if exists "admissions_own" on public.admissions;
create policy "admissions_own" on public.admissions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Acesso público via token (portal de admissão do aprovado)
drop policy if exists "admissions_public_by_token" on public.admissions;
create policy "admissions_public_by_token" on public.admissions for select
  using (true);

-- ── 9. mensagens_bento (histórico de chat do agente com o candidato) ──────
create table if not exists public.mensagens_bento (
  id             uuid primary key default gen_random_uuid(),
  entrevista_id  uuid references public.interviews(id) on delete cascade,
  remetente      text not null,
  mensagem       text not null,
  created_at     timestamptz default timezone('utc'::text, now())
);
alter table public.mensagens_bento enable row level security;
drop policy if exists "mensagens_bento_via_interview_owner" on public.mensagens_bento;
create policy "mensagens_bento_via_interview_owner" on public.mensagens_bento for all
  using (
    exists (
      select 1 from public.interviews i
      join public.jobs j on j.id = i.job_id
      where i.id = mensagens_bento.entrevista_id and j.user_id = auth.uid()
    )
  );

-- ── 10. salespeople + sales + chips_pool ───────────────────────────────────
-- Mantidas só porque profiles.sale_id referencia sales, e chips_pool é o
-- pool de números WhatsApp usado no onboarding — nada disso aparece mais
-- na UI (aba Comercial removida), mas o onboarding automático ainda insere
-- nessas tabelas ao criar uma conta nova.
create table if not exists public.salespeople (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  email              text not null unique,
  phone              text,
  commission_pct     numeric not null default 15.00,
  asaas_wallet_id    text,
  asaas_customer_id  text,
  status             text not null default 'active',
  password_hash      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.salespeople enable row level security;

create table if not exists public.sales (
  id                  uuid primary key default gen_random_uuid(),
  salesperson_id      uuid references public.salespeople(id) on delete set null,
  client_name         text not null,
  client_email        text not null,
  client_phone        text not null,
  plan                text not null,
  amount              numeric not null,
  commission_amount   numeric not null,
  billing             text not null default 'mensal',
  asaas_payment_id    text,
  asaas_link_url      text,
  status              text not null default 'pending',
  paid_at             timestamptz,
  onboarding_status   text not null default 'aguardando',
  onboarding_step     integer default 0,
  onboarding_context  jsonb default '{}'::jsonb,
  client_user_id      uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.sales enable row level security;

alter table public.profiles
  drop constraint if exists profiles_sale_id_fkey;
alter table public.profiles
  add constraint profiles_sale_id_fkey foreign key (sale_id) references public.sales(id) on delete set null;

create table if not exists public.chips_pool (
  id                  uuid primary key default gen_random_uuid(),
  phone_number        text not null unique,
  evolution_instance  text not null unique,
  display_name        text,
  status              text not null default 'disponivel',
  assigned_to         uuid references auth.users(id) on delete set null,
  assigned_at         timestamptz,
  assigned_sale_id    uuid references public.sales(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.chips_pool enable row level security;
drop policy if exists "chips_pool_service_only" on public.chips_pool;
create policy "chips_pool_service_only" on public.chips_pool for all
  to service_role using (true);

-- ── 11. slot_requests (candidato pede novo horário) ─────────────────────
create table if not exists public.slot_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  interview_id    uuid unique references public.interviews(id) on delete cascade,
  job_id          uuid references public.jobs(id) on delete cascade,
  candidate_name  text,
  job_title       text,
  profile_id      uuid references public.profiles(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'handled'))
);
alter table public.slot_requests enable row level security;
drop policy if exists "slot_requests_select_own" on public.slot_requests;
create policy "slot_requests_select_own" on public.slot_requests for select
  to authenticated using (profile_id = auth.uid());
drop policy if exists "slot_requests_update_own" on public.slot_requests;
create policy "slot_requests_update_own" on public.slot_requests for update
  to authenticated using (profile_id = auth.uid());
drop policy if exists "slot_requests_service_all" on public.slot_requests;
create policy "slot_requests_service_all" on public.slot_requests for all
  to service_role using (true);

-- ── 12. system_prompts (prompt do agente configurável via admin) ──────────
create table if not exists public.system_prompts (
  id          text primary key,
  prompt      text not null,
  updated_at  timestamptz default now()
);
alter table public.system_prompts enable row level security;
drop policy if exists "system_prompts_service_only" on public.system_prompts;
create policy "system_prompts_service_only" on public.system_prompts for all
  to service_role using (true);
drop policy if exists "system_prompts_read_all" on public.system_prompts;
create policy "system_prompts_read_all" on public.system_prompts for select
  to authenticated using (true);

-- ── 13. announcements (avisos no dashboard, se usado) ──────────────────────
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  link_url      text,
  image_path    text not null,
  is_active     boolean default true,
  target_plans  text[] default '{FREE,MENSAL,TRIMESTRAL,ANUAL}',
  created_at    timestamptz default now()
);
alter table public.announcements enable row level security;
drop policy if exists "announcements_read_all" on public.announcements;
create policy "announcements_read_all" on public.announcements for select
  to authenticated using (is_active = true);

-- ── Índices de performance ──────────────────────────────────────────────
create index if not exists idx_jobs_user_id on public.jobs(user_id);
create index if not exists idx_candidates_job_id on public.candidates(job_id);
create index if not exists idx_interviews_job_id on public.interviews(job_id);
create index if not exists idx_interviews_candidate_id on public.interviews(candidate_id);
create index if not exists idx_interviews_slot_id on public.interviews(slot_id);
create index if not exists idx_availability_slots_user_booked on public.availability_slots (user_id, is_booked, slot_date, slot_time);
create index if not exists idx_interview_slots_job_id on public.interview_slots(job_id);
create index if not exists idx_agent_conversations_phone on public.agent_conversations(phone);

-- ── Realtime (o app escuta mudanças em interviews/availability_slots) ─────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;
alter publication supabase_realtime add table public.interviews;
alter publication supabase_realtime add table public.availability_slots;

-- ============================================================================
-- Fim. Depois de rodar isto, o banco novo tem a mesma estrutura do original
-- (VeloRH), sem as tabelas de SDR/Vendedores (removidas junto com a aba
-- Comercial). Falta só: (1) apontar as env vars da Vercel pra este projeto
-- (já feito), (2) reapontar Evolution/Chatwoot pra infra viva, (3) criar
-- seu próprio perfil em profiles ao logar pela primeira vez.
-- ============================================================================
