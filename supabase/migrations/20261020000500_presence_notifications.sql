-- M5: private user settings (the chosen status moves off the public profile), notification
-- and mute settings, "mark as read" helpers, and authorization for the global presence topic.

-- ---------------------------------------------------------------------------
-- User settings (only the owner can read them)
-- ---------------------------------------------------------------------------

-- The chosen status was readable by everyone on profiles, which would reveal who's Invisible.
-- Live status comes from Realtime presence; the choice itself is private.
create table public.user_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  status public.user_status not null default 'online',
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "users read their own settings"
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users create their own settings"
  on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "users update their own settings"
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into public.user_settings (user_id, status)
select id, status from public.profiles
on conflict (user_id) do nothing;

alter table public.profiles drop column status;

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
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification settings: per server or per channel
-- ---------------------------------------------------------------------------

create type public.notification_level as enum ('all', 'mentions', 'nothing');

create table public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  server_id uuid references public.servers (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete cascade,
  -- null inherits (channel → server → default "mentions").
  level public.notification_level,
  -- 'infinity' means muted until turned back on.
  muted_until timestamptz,
  constraint notification_settings_one_target check ((server_id is null) <> (channel_id is null)),
  constraint notification_settings_unique unique nulls not distinct (user_id, server_id, channel_id)
);

alter table public.notification_settings enable row level security;

create policy "users read their own notification settings"
  on public.notification_settings for select to authenticated
  using (user_id = (select auth.uid()));

-- Upserts one server's or channel's settings. Pass p_clear_mute to unmute.
create or replace function public.set_notification_settings(
  p_server uuid default null,
  p_channel uuid default null,
  p_level public.notification_level default null,
  p_muted_until timestamptz default null,
  p_clear_level boolean default false,
  p_clear_mute boolean default false
)
returns public.notification_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_ public.notification_settings;
begin
  if (p_server is null) = (p_channel is null) then
    raise exception 'Choose a server or a channel.';
  end if;
  if p_server is not null and not public.is_server_member(p_server) then
    raise exception 'You''re not a member of that server.';
  end if;
  if p_channel is not null and not public.can_view_channel(p_channel) then
    raise exception 'You can''t see that channel.';
  end if;

  insert into public.notification_settings (user_id, server_id, channel_id, level, muted_until)
  values (auth.uid(), p_server, p_channel, p_level, p_muted_until)
  on conflict (user_id, server_id, channel_id) do update set
    level = case when p_clear_level then null else coalesce(excluded.level, public.notification_settings.level) end,
    muted_until = case when p_clear_mute then null else coalesce(excluded.muted_until, public.notification_settings.muted_until) end
  returning * into row_;
  return row_;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark as read
-- ---------------------------------------------------------------------------

create or replace function public.mark_channel_read(p_channel uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  last_id uuid;
begin
  select last_message_id into last_id from public.channel_activity where channel_id = p_channel;
  if last_id is not null then
    perform public.mark_read(p_channel, last_id);
  end if;
end;
$$;

-- Marks every channel the user can see in a server as read.
create or replace function public.mark_server_read(p_server uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.read_states (user_id, channel_id, last_read_message_id, last_read_at)
  select auth.uid(), a.channel_id, a.last_message_id, a.last_message_at
  from public.channel_activity a
  join public.channels c on c.id = a.channel_id
  where c.server_id = p_server and public.can_view_channel(c.id)
  on conflict (user_id, channel_id) do update
    set last_read_message_id = excluded.last_read_message_id,
        last_read_at = greatest(public.read_states.last_read_at, excluded.last_read_at);
$$;

-- ---------------------------------------------------------------------------
-- Grants, Realtime
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.set_notification_settings(uuid, uuid, public.notification_level, timestamptz, boolean, boolean)',
    'public.mark_channel_read(uuid)',
    'public.mark_server_read(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

alter publication supabase_realtime add table public.user_settings, public.notification_settings;

-- Every signed-in user shares one presence topic (fine for small communities; see README).
create policy "signed-in users join global presence"
  on realtime.messages for select to authenticated
  using (realtime.topic() = 'presence:global');

create policy "signed-in users publish global presence"
  on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'presence:global');
