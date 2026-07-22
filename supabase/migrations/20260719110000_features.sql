-- ===================================================================
-- 기능 추가: 즐겨찾기, 패킹 체크리스트, 커스텀 카테고리
-- ===================================================================

-- 1) clothes 에 즐겨찾기 / 패킹 여부 컬럼 -----------------------------
alter table public.clothes
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_packed   boolean not null default false;

-- 2) 커스텀 카테고리 테이블 ------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null,
  emoji      text not null default '🏷️',
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx
  on public.categories (user_id, created_at);

alter table public.categories enable row level security;

drop policy if exists "cat - select" on public.categories;
drop policy if exists "cat - insert" on public.categories;
drop policy if exists "cat - update" on public.categories;
drop policy if exists "cat - delete" on public.categories;

create policy "cat - select" on public.categories
  for select using (auth.uid() = user_id);
create policy "cat - insert" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "cat - update" on public.categories
  for update using (auth.uid() = user_id);
create policy "cat - delete" on public.categories
  for delete using (auth.uid() = user_id);
