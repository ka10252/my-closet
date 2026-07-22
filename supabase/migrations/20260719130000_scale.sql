-- 옷별 표시 크기 배율 (+/- 로 조절, 1 = 기본)
alter table public.clothes
  add column if not exists scale real not null default 1;
