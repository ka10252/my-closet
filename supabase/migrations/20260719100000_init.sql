-- ===================================================================
-- 나만의 옷장 (my-closet) — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
-- ===================================================================

-- 1) 옷 테이블 ------------------------------------------------------
create table if not exists public.clothes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text,
  category    text not null default 'other',   -- top / bottom / activewear / outerwear / shoes / accessory / other
  subcategory text,                             -- 예: pants / skirt / short-sleeve ...
  image_url   text not null,                    -- 누끼 딴 투명 PNG (Storage public URL)
  color       text,
  season      text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists clothes_user_idx on public.clothes (user_id, created_at desc);

-- 2) RLS (본인 데이터만 접근) ---------------------------------------
alter table public.clothes enable row level security;

drop policy if exists "own rows - select" on public.clothes;
drop policy if exists "own rows - insert" on public.clothes;
drop policy if exists "own rows - update" on public.clothes;
drop policy if exists "own rows - delete" on public.clothes;

create policy "own rows - select" on public.clothes
  for select using (auth.uid() = user_id);
create policy "own rows - insert" on public.clothes
  for insert with check (auth.uid() = user_id);
create policy "own rows - update" on public.clothes
  for update using (auth.uid() = user_id);
create policy "own rows - delete" on public.clothes
  for delete using (auth.uid() = user_id);

-- 3) Storage 버킷 (옷 이미지) --------------------------------------
insert into storage.buckets (id, name, public)
values ('clothes', 'clothes', true)
on conflict (id) do nothing;

-- 버킷 접근 정책: 본인 폴더(user_id/…)에만 업로드/삭제, 조회는 공개
drop policy if exists "clothes read" on storage.objects;
drop policy if exists "clothes write" on storage.objects;
drop policy if exists "clothes delete" on storage.objects;

create policy "clothes read" on storage.objects
  for select using (bucket_id = 'clothes');

create policy "clothes write" on storage.objects
  for insert with check (
    bucket_id = 'clothes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "clothes delete" on storage.objects
  for delete using (
    bucket_id = 'clothes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
