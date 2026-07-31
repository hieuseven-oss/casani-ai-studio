alter table public.generation_outputs
add column if not exists role text;

comment on column public.generation_outputs.role is
'Semantic role of the generated visual, e.g. left_three_quarter, right_three_quarter, hero_close, front, catalog, lifestyle.';
