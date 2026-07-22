-- 누끼 원본(테두리 없는 투명 컷아웃)을 따로 보관 → 나중에 누끼 편집 가능
alter table public.clothes
  add column if not exists cutout_url text;
