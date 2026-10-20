-- M1: user profiles, signup trigger, username availability, avatar storage.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create type public.user_status as enum ('online', 'idle', 'dnd', 'invisible');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Always lowercase, so a plain unique index is case-insensitive in practice.
  username text not null unique,
  display_name text,
  avatar_url text,
  banner_color text not null default '#5865f2',
  bio text not null default '',
  -- The status the user chose. Live online/offline comes from Realtime presence.
  status public.user_status not null default 'online',
  custom_status_text text,
  custom_status_emoji text,
  custom_status_expires_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_format
    check (username ~ '^[a-z0-9_.]{2,32}$' and username !~ '\.\.'),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 32),
  constraint profiles_bio_length check (char_length(bio) <= 190),
  constraint profiles_banner_color_format check (banner_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint profiles_custom_status_length
    check (custom_status_text is null or char_length(custom_status_text) <= 128)
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Any signed-in user can see profiles (needed for chat, member lists and friend requests).
create policy "profiles are visible to signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Users can't change their id or created_at through the API.
create or replace function public.profiles_guard_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.username := lower(new.username);
  return new;
end;
$$;

create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_columns();

-- ---------------------------------------------------------------------------
-- Create a profile when an auth user signs up.
-- The username and display name come from signUp({ options: { data } }).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if wanted !~ '^[a-z0-9_.]{2,32}$' or wanted ~ '\.\.' then
    wanted := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    wanted,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 32), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Username availability (callable before sign-up, so anon may use it).
-- ---------------------------------------------------------------------------

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where username = lower(trim(p_username))
      and id is distinct from auth.uid()
  );
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Avatar storage: public read; users write only inside their own {uid}/ folder.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "avatars: owners can list their files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars: owners can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars: owners can replace"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars: owners can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
