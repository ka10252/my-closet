-- 옷별 위아래 위치 조정값(px, 음수=위로 / 양수=아래로, 0=기본)
alter table public.clothes
  add column if not exists offset_y real not null default 0;
