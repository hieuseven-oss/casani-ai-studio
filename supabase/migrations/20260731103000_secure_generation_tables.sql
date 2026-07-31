-- =========================================================
-- V15C Image V1 security hardening
-- Protect generations and generation_outputs by project owner.
-- =========================================================

alter table public.generations
enable row level security;

alter table public.generation_outputs
enable row level security;


-- =========================================================
-- GENERATIONS
-- A signed-in user may access a generation only when
-- its parent project belongs to that user.
-- =========================================================

drop policy if exists
  "generations own project"
on public.generations;

create policy
  "generations own project"
on public.generations
for all
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = generations.project_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = generations.project_id
      and projects.user_id = auth.uid()
  )
);


-- =========================================================
-- GENERATION OUTPUTS
-- Access is inherited:
-- output -> generation -> project -> user
-- =========================================================

drop policy if exists
  "generation outputs own project"
on public.generation_outputs;

create policy
  "generation outputs own project"
on public.generation_outputs
for all
to authenticated
using (
  exists (
    select 1
    from public.generations
    join public.projects
      on projects.id = generations.project_id
    where generations.id =
      generation_outputs.generation_id
      and projects.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.generations
    join public.projects
      on projects.id = generations.project_id
    where generations.id =
      generation_outputs.generation_id
      and projects.user_id = auth.uid()
  )
);
