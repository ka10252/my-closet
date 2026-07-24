-- ===================================================================
-- 룩북: 저장한 코디 (옷 id 배열로 구성 보관)
-- ===================================================================

create table if not exists public.lookbooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default '내 코디',
  item_ids   text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists lookbooks_user_idx
  on public.lookbooks (user_id, created_at desc);

alter table public.lookbooks enable row level security;

drop policy if exists "look - select" on public.lookbooks;
drop policy if exists "look - insert" on public.lookbooks;
drop policy if exists "look - update" on public.lookbooks;
drop policy if exists "look - delete" on public.lookbooks;

create policy "look - select" on public.lookbooks
  for select using (auth.uid() = user_id);
create policy "look - insert" on public.lookbooks
  for insert with check (auth.uid() = user_id);
create policy "look - update" on public.lookbooks
  for update using (auth.uid() = user_id);
create policy "look - delete" on public.lookbooks
  for delete using (auth.uid() = user_id);
