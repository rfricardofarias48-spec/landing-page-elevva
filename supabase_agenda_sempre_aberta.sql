-- ============================================================================
-- Agenda "sempre aberta" — horário de funcionamento + bloqueios
-- Cole no SQL Editor do projeto Supabase (fifplbuzkvrurajjqgwp) e execute.
-- Idempotente.
-- ============================================================================

-- Horário de funcionamento padrão da conta (Seg-Sex, 9h às 18h).
-- days: 0=Domingo ... 6=Sábado (mesmo padrão do JS Date.getDay()).
alter table public.profiles
  add column if not exists working_hours jsonb not null default '{"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb;

-- Bloqueios pontuais (dia inteiro ou horário específico) — equivalente ao
-- blocked_slots do app de atendimento.
create table if not exists public.blocked_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  all_day     boolean not null default true,
  start_time  time,
  end_time    time,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists blocked_slots_user_date_idx on public.blocked_slots(user_id, date);

alter table public.blocked_slots enable row level security;
drop policy if exists "blocked_slots_own" on public.blocked_slots;
create policy "blocked_slots_own" on public.blocked_slots for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Limpa os availability_slots de teste (a partir de agora a disponibilidade
-- é calculada em tempo real a partir do horário de funcionamento + bloqueios;
-- linhas de availability_slots passam a existir só no momento em que um
-- horário é efetivamente reservado por um candidato).
delete from public.availability_slots where is_booked = false;
