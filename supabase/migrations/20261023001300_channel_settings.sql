-- M12: Discord-style channel settings: slow mode and per-channel permission overrides.

-- ---------------------------------------------------------------------------
-- Slow mode: members wait between messages (managers of messages or channels are exempt).
-- ---------------------------------------------------------------------------

alter table public.channels add column if not exists slowmode_seconds integer not null default 0;
alter table public.channels drop constraint if exists channels_slowmode_range;
alter table public.channels add constraint channels_slowmode_range check (slowmode_seconds between 0 and 21600);

create or replace function public.messages_slowmode_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delay integer;
  last_sent timestamptz;
  wait integer;
begin
  if new.type not in ('default', 'reply') then
    return new;
  end if;
  -- A retry of a message that already went through (sends are idempotent) isn't a new message;
  -- this trigger runs before the insert notices the duplicate id.
  if exists (select 1 from public.messages where id = new.id) then
    return new;
  end if;
  select slowmode_seconds into delay from public.channels where id = new.channel_id;
  if coalesce(delay, 0) = 0 then
    return new;
  end if;
  -- MANAGE_MESSAGES (4) or MANAGE_CHANNELS (16) skip the wait, as in Discord.
  if public.channel_permissions(new.channel_id, new.author_id) & (4 | 16) <> 0 then
    return new;
  end if;
  select max(created_at) into last_sent
  from public.messages
  where channel_id = new.channel_id and author_id = new.author_id and type in ('default', 'reply');
  if last_sent is not null and last_sent > now() - make_interval(secs => delay) then
    wait := ceil(extract(epoch from (last_sent + make_interval(secs => delay) - now())))::integer;
    raise exception 'Slow mode is on. You can send another message in % seconds.', greatest(wait, 1)
      using errcode = 'P0001', hint = 'slowmode:' || greatest(wait, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists messages_slowmode_guard on public.messages;
create trigger messages_slowmode_guard
  before insert on public.messages
  for each row execute function public.messages_slowmode_guard();

-- ---------------------------------------------------------------------------
-- Permission overrides ("overwrites" in Discord's API): per channel, for a role or a member,
-- a set of permissions to allow and a set to deny.
-- ---------------------------------------------------------------------------

create table if not exists public.channel_overwrites (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  role_id uuid references public.roles (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  allow bigint not null default 0,
  deny bigint not null default 0,
  constraint channel_overwrites_one_target check ((role_id is null) <> (user_id is null)),
  constraint channel_overwrites_disjoint check (allow & deny = 0)
);

create unique index if not exists channel_overwrites_role_key
  on public.channel_overwrites (channel_id, role_id) where role_id is not null;
create unique index if not exists channel_overwrites_user_key
  on public.channel_overwrites (channel_id, user_id) where user_id is not null;

alter table public.channel_overwrites enable row level security;

-- Anyone who can see the channel can see its overrides (clients need them to know what they
-- may do). Changes go through the RPCs below.
drop policy if exists "channel viewers see overrides" on public.channel_overwrites;
create policy "channel viewers see overrides"
  on public.channel_overwrites for select to authenticated
  using (exists (select 1 from public.channels c where c.id = channel_overwrites.channel_id));

-- The permissions an override may touch: the ones checked per channel.
-- VIEW 1 | SEND 2 | MANAGE_MESSAGES 4 | ATTACH 4096 | REACT 8192 | CONNECT 16384 | SPEAK 32768
create or replace function public.channel_overwrite_mask()
returns bigint
language sql
immutable
as $$ select 61447::bigint $$;

create or replace function public.set_channel_overwrite(
  p_channel uuid,
  p_role uuid,
  p_user uuid,
  p_allow bigint,
  p_deny bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  srv uuid;
  target public.roles;
  mine bigint;
begin
  select server_id into srv from public.channels
  where id = p_channel and server_id is not null and type <> 'thread';
  if srv is null then
    raise exception 'Channel not found.' using errcode = 'P0002';
  end if;
  perform public.require_permission(srv, 32, 'manage roles');
  if (p_role is null) = (p_user is null) then
    raise exception 'Pick a role or a member.';
  end if;

  if p_role is not null then
    select * into target from public.roles where id = p_role and server_id = srv;
    if not found then
      raise exception 'That role isn''t in this server.';
    end if;
    -- @everyone is fair game for anyone who manages roles; other roles must be below yours.
    if not target.is_default then
      perform public.require_manageable_role(target);
    end if;
  elsif not public.is_server_member(srv, p_user) then
    raise exception 'That person isn''t in this server.';
  end if;

  if (coalesce(p_allow, 0) | coalesce(p_deny, 0)) & ~public.channel_overwrite_mask() <> 0 then
    raise exception 'Those permissions can''t be set per channel.';
  end if;
  if coalesce(p_allow, 0) & coalesce(p_deny, 0) <> 0 then
    raise exception 'A permission can''t be both allowed and denied.';
  end if;
  mine := public.server_permissions(srv);
  if mine <> 2147483647 and coalesce(p_allow, 0) & ~mine <> 0 then
    raise exception 'You can''t allow permissions you don''t have.';
  end if;

  if coalesce(p_allow, 0) = 0 and coalesce(p_deny, 0) = 0 then
    delete from public.channel_overwrites
    where channel_id = p_channel
      and (role_id = p_role or user_id = p_user);
    return;
  end if;

  if p_role is not null then
    insert into public.channel_overwrites (channel_id, role_id, allow, deny)
    values (p_channel, p_role, p_allow, p_deny)
    on conflict (channel_id, role_id) where role_id is not null
    do update set allow = excluded.allow, deny = excluded.deny;
  else
    insert into public.channel_overwrites (channel_id, user_id, allow, deny)
    values (p_channel, p_user, p_allow, p_deny)
    on conflict (channel_id, user_id) where user_id is not null
    do update set allow = excluded.allow, deny = excluded.deny;
  end if;
end;
$$;

revoke execute on function public.set_channel_overwrite(uuid, uuid, uuid, bigint, bigint) from public, anon;
grant execute on function public.set_channel_overwrite(uuid, uuid, uuid, bigint, bigint) to authenticated;

-- Effective permissions for a channel row, now with overrides, in Discord's order:
-- server permissions → @everyone override → the member's role overrides together → the
-- member's own override. Without View Channel nothing else counts.
create or replace function public.channel_row_permissions(
  p_server uuid,
  p_channel uuid,
  p_private boolean,
  p_user uuid default auth.uid()
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  perms bigint;
  ow_allow bigint;
  ow_deny bigint;
begin
  if p_server is null then
    return 0;
  end if;

  perms := public.server_permissions(p_server, p_user);
  if perms = 2147483647 then
    return perms;
  end if;
  if perms & 1 = 0 then -- VIEW_CHANNEL
    return 0;
  end if;

  if p_private and not exists (
    select 1
    from public.channel_role_access a
    join public.roles r on r.id = a.role_id
    where a.channel_id = p_channel
      and (
        r.is_default
        or exists (
          select 1 from public.member_roles mr
          where mr.role_id = r.id and mr.user_id = p_user
        )
      )
  ) then
    return 0;
  end if;

  select o.allow, o.deny into ow_allow, ow_deny
  from public.channel_overwrites o
  join public.roles r on r.id = o.role_id
  where o.channel_id = p_channel and r.is_default;
  if found then
    perms := (perms & ~ow_deny) | ow_allow;
  end if;

  select coalesce(bit_or(o.allow), 0), coalesce(bit_or(o.deny), 0) into ow_allow, ow_deny
  from public.channel_overwrites o
  join public.roles r on r.id = o.role_id and not r.is_default
  join public.member_roles mr on mr.role_id = r.id and mr.user_id = p_user
  where o.channel_id = p_channel;
  perms := (perms & ~ow_deny) | ow_allow;

  select o.allow, o.deny into ow_allow, ow_deny
  from public.channel_overwrites o
  where o.channel_id = p_channel and o.user_id = p_user;
  if found then
    perms := (perms & ~ow_deny) | ow_allow;
  end if;

  if perms & 1 = 0 then
    return 0;
  end if;
  return perms;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.channel_overwrites;
exception when duplicate_object then null;
end;
$$;
