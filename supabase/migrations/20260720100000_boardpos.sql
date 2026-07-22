-- 전체 뷰에서 드래그로 옮긴 스티커 위치(보드 대비 0~1 비율, null=자동 배치)
alter table public.clothes
  add column if not exists board_x real,
  add column if not exists board_y real;
