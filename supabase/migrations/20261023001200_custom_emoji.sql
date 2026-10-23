-- M11: custom server emoji, like Discord's.
--
-- New permission bit (mirrored in src/lib/permissions.ts):
--   MANAGE_EXPRESSIONS 65536   (1 << 16)
-- Administrators and owners already have every bit.
--
-- Messages and reactions refer to a custom emoji as <:name:id> (or <a:name:id> when animated).
-- Images live in the public "emojis" bucket at the path {id}, so any client can draw an emoji
-- from the token alone, even one from a server it isn't in.

create table if not exists public.server_emojis (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null,
  animated boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint server_emojis_name_format check (name ~ '^[A-Za-z0-9_]{2,32}$'),
  constraint server_emojis_unique_name unique (server_id, name)
);

create index if not exists server_emojis_server_idx on public.server_emojis (server_id);

alter table public.server_emojis enable row level security;

drop policy if exists "members see their servers' emoji" on public.server_emojis;
create policy "members see their servers' emoji"
  on public.server_emojis for select to authenticated
  using (public.is_server_member(server_id));

drop policy if exists "expression managers remove emoji" on public.server_emojis;
create policy "expression managers remove emoji"
  on public.server_emojis for delete to authenticated
  using (public.has_server_permission(server_id, 65536));

-- Adding goes through an RPC so the permission check and the 50-emoji limit happen together.
create or replace function public.create_server_emoji(p_server uuid, p_name text, p_animated boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.has_server_permission(p_server, 65536) then
    raise exception 'You need the Manage Expressions permission to add emoji.' using errcode = '42501';
  end if;
  if (select count(*) from public.server_emojis where server_id = p_server) >= 50 then
    raise exception 'This server already has 50 emoji. Remove one to add another.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.server_emojis where server_id = p_server and lower(name) = lower(p_name)) then
    raise exception 'This server already has an emoji called :%:.', p_name using errcode = '23505';
  end if;
  insert into public.server_emojis (server_id, name, animated, created_by)
  values (p_server, p_name, coalesce(p_animated, false), auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.rename_server_emoji(p_emoji uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select id, server_id into target from public.server_emojis where id = p_emoji;
  if not found or not public.has_server_permission(target.server_id, 65536) then
    raise exception 'You need the Manage Expressions permission to rename emoji.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.server_emojis
    where server_id = target.server_id and lower(name) = lower(p_name) and id <> p_emoji
  ) then
    raise exception 'This server already has an emoji called :%:.', p_name using errcode = '23505';
  end if;
  update public.server_emojis set name = p_name where id = p_emoji;
end;
$$;

revoke execute on function public.create_server_emoji(uuid, text, boolean) from public, anon;
revoke execute on function public.rename_server_emoji(uuid, text) from public, anon;
grant execute on function public.create_server_emoji(uuid, text, boolean) to authenticated;
grant execute on function public.rename_server_emoji(uuid, text) to authenticated;

-- A custom emoji token is longer than 64 characters (<a:name:uuid> is up to 73).
alter table public.reactions drop constraint if exists reactions_emoji_length;
alter table public.reactions add constraint reactions_emoji_length check (char_length(emoji) between 1 and 100);

-- ---------------------------------------------------------------------------
-- Emoji images: public read; uploaded once, by the person who created the emoji row.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('emojis', 'emojis', true, 262144, array['image/png', 'image/gif', 'image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "emojis: creators upload the image" on storage.objects;
create policy "emojis: creators upload the image"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'emojis'
    and exists (
      select 1 from public.server_emojis e
      where e.id::text = storage.objects.name
        and e.created_by = (select auth.uid())
        and public.has_server_permission(e.server_id, 65536)
    )
  );

drop policy if exists "emojis: expression managers delete images" on storage.objects;
create policy "emojis: expression managers delete images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'emojis'
    and exists (
      select 1 from public.server_emojis e
      where e.id::text = storage.objects.name
        and public.has_server_permission(e.server_id, 65536)
    )
  );

-- Uploading with the Storage API reads the new object back, so uploaders need to see it.
drop policy if exists "emojis: anyone signed in can read" on storage.objects;
create policy "emojis: anyone signed in can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'emojis');
