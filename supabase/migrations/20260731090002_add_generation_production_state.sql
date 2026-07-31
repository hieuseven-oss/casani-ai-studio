alter table public.generations
add column if not exists production_ready boolean not null default false;

alter table public.generations
add column if not exists production_ready_at timestamptz;

comment on column public.generations.production_ready is
'Whether this generation/version is approved as a production-ready visual set.';

comment on column public.generations.production_ready_at is
'Timestamp when this generation/version was marked production ready.';
