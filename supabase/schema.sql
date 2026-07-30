create extension if not exists "pgcrypto";
create table if not exists products(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,sku text,name text not null,category text,material text,color text,image_url text,created_at timestamptz default now());
create table if not exists projects(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,product_id uuid references products(id) on delete set null,space text,style text,mood text,aspect_ratio text,status text default 'draft',created_at timestamptz default now());
create table if not exists generations(id uuid primary key default gen_random_uuid(),project_id uuid references projects(id) on delete cascade,prompt text,model text,status text default 'queued',created_at timestamptz default now());
create table if not exists generation_outputs(id uuid primary key default gen_random_uuid(),generation_id uuid references generations(id) on delete cascade,image_url text,approved boolean default false,shortlisted boolean not null default false,shortlist_rank integer,shortlist_note text,finalist boolean not null default false,created_at timestamptz default now());
alter table products enable row level security;alter table projects enable row level security;
create policy "products own rows" on products for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "projects own rows" on projects for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do nothing;
