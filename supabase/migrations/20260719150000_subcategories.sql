-- 세부 카테고리 (예: 상의 → 민소매/반팔/긴팔)
create table if not exists public.subcategories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  parent     text not null,   -- 상위 카테고리 id (기본 슬러그 또는 커스텀 uuid)
  label      text not null,
  created_at timestamptz not null default now()
);

create index if not exists subcategories_user_parent_idx
  on public.subcategories (user_id, parent, created_at);

alter table public.subcategories enable row level security;

drop policy if exists "sub - select" on public.subcategories;
drop policy if exists "sub - insert" on public.subcategories;
drop policy if exists "sub - update" on public.subcategories;
drop policy if exists "sub - delete" on public.subcategories;

create policy "sub - select" on public.subcategories
  for select using (auth.uid() = user_id);
create policy "sub - insert" on public.subcategories
  for insert with check (auth.uid() = user_id);
create policy "sub - update" on public.subcategories
  for update using (auth.uid() = user_id);
create policy "sub - delete" on public.subcategories
  for delete using (auth.uid() = user_id);
