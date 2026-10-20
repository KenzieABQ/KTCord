-- Minimal stand-ins for the parts of Supabase the migrations depend on, so they can be
-- applied and exercised in PGlite (Postgres in WASM) without Docker or a hosted project.
-- Mirrors Supabase's conventions: auth.uid() reads the JWT "sub" claim from a setting,
-- clients run as `authenticated`, and service_role bypasses RLS.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema extensions;
create schema storage;
create schema realtime;

grant usage on schema public, auth, storage, realtime to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant execute on function auth.uid() to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated, service_role;

create function storage.foldername(name text) returns text[]
language sql immutable
as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  extension text not null default 'broadcast',
  payload jsonb
);
alter table realtime.messages enable row level security;
grant all on realtime.messages to anon, authenticated;

create function realtime.topic() returns text
language sql stable
as $$ select current_setting('realtime.topic', true) $$;

create publication supabase_realtime;

-- Supabase grants table and function access to the API roles; RLS does the restricting.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
