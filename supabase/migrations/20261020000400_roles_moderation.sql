-- M4: role management with hierarchy, member role assignment, moderation (kick, ban, timeout)
-- and private channel access. Every write goes through a SECURITY DEFINER RPC that checks
-- the caller's permissions and position, so roles/member_roles/bans have no write policies.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_server_owner(p_server uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.servers where id = p_server and owner_id = p_user);
$$;

-- Raises unless the caller has every bit in p_perm on the server.
create or replace function public.require_permission(p_server uuid, p_perm bigint, p_action text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_server_permission(p_server, p_perm) then
    raise exception 'You don''t have permission to %.', p_action;
  end if;
end;
$$;

-- True when the caller sits above the target in the role hierarchy (owners always do;
-- nobody outranks the owner or themselves).
create or replace function public.outranks(p_server uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is distinct from p_target
    and not public.is_server_owner(p_server, p_target)
    and (
      public.is_server_owner(p_server)
      or public.member_top_position(p_server, auth.uid()) > public.member_top_position(p_server, p_target)
    );
$$;

-- Raises unless the caller may edit or assign this role: MANAGE_ROLES and the role sits
-- below the caller's highest role.
create or replace function public.require_manageable_role(p_role public.roles)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_permission(p_role.server_id, 32, 'manage roles');
  if not public.is_server_owner(p_role.server_id)
     and p_role.position >= public.member_top_position(p_role.server_id, auth.uid()) then
    raise exception 'You can only manage roles below your highest role.';
  end if;
end;
$$;

-- Non-owners can't hand out permissions they don't have themselves.
create or replace function public.require_grantable(p_server uuid, p_added bigint)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_added & ~public.server_permissions(p_server) <> 0 then
    raise exception 'You can''t grant permissions you don''t have.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- New roles go to the bottom (just above @everyone), like Discord.
create or replace function public.create_role(
  p_server uuid,
  p_name text,
  p_color text default null,
  p_permissions bigint default 0,
  p_hoist boolean default false,
  p_mentionable boolean default false
)
returns public.roles
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.roles;
begin
  perform public.require_permission(p_server, 32, 'manage roles');
  perform public.require_grantable(p_server, coalesce(p_permissions, 0));

  update public.roles set position = position + 1
  where server_id = p_server and not is_default;

  insert into public.roles (server_id, name, color, permissions, hoist, mentionable, position)
  values (p_server, coalesce(nullif(trim(p_name), ''), 'new role'), p_color,
          coalesce(p_permissions, 0), p_hoist, p_mentionable, 1)
  returning * into r;
  return r;
end;
$$;

-- Updates any subset of a role's fields. @everyone keeps its name and position.
create or replace function public.update_role(
  p_role uuid,
  p_name text default null,
  p_color text default null,
  p_clear_color boolean default false,
  p_permissions bigint default null,
  p_hoist boolean default null,
  p_mentionable boolean default null
)
returns public.roles
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.roles;
begin
  select * into r from public.roles where id = p_role;
  if not found then
    raise exception 'That role no longer exists.';
  end if;
  perform public.require_manageable_role(r);
  if p_permissions is not null then
    perform public.require_grantable(r.server_id, p_permissions & ~r.permissions);
  end if;

  update public.roles set
    name = case when r.is_default or p_name is null then name else coalesce(nullif(trim(p_name), ''), name) end,
    color = case when p_clear_color then null else coalesce(p_color, color) end,
    permissions = coalesce(p_permissions, permissions),
    hoist = case when r.is_default then false else coalesce(p_hoist, hoist) end,
    mentionable = coalesce(p_mentionable, mentionable)
  where id = p_role
  returning * into r;
  return r;
end;
$$;

create or replace function public.delete_role(p_role uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.roles;
begin
  select * into r from public.roles where id = p_role;
  if not found then
    return;
  end if;
  if r.is_default then
    raise exception 'The @everyone role can''t be deleted.';
  end if;
  perform public.require_manageable_role(r);

  delete from public.roles where id = p_role;
  update public.roles set position = position - 1
  where server_id = r.server_id and not is_default and position > r.position;
end;
$$;

-- p_role_ids: every non-default role, highest first. Roles the caller can't manage must
-- keep their current position.
create or replace function public.reorder_roles(p_server uuid, p_role_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total int := coalesce(array_length(p_role_ids, 1), 0);
  my_top int := public.member_top_position(p_server, auth.uid());
  is_owner boolean := public.is_server_owner(p_server);
  r public.roles;
  new_position int;
begin
  perform public.require_permission(p_server, 32, 'manage roles');
  if total <> (select count(*) from public.roles where server_id = p_server and not is_default)
     or total <> (select count(*) from public.roles where server_id = p_server and not is_default and id = any (p_role_ids)) then
    raise exception 'The role list is out of date. Refresh and try again.';
  end if;

  for i in 1..total loop
    select * into r from public.roles where id = p_role_ids[i];
    new_position := total - i + 1;
    if not is_owner and new_position <> r.position and (r.position >= my_top or new_position >= my_top) then
      raise exception 'You can only move roles below your highest role.';
    end if;
    update public.roles set position = new_position where id = r.id and position <> new_position;
  end loop;
end;
$$;

-- Replaces a member's roles. Only roles below the caller's top role can be added or removed.
create or replace function public.set_member_roles(p_server uuid, p_user uuid, p_role_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_owner boolean := public.is_server_owner(p_server);
  my_top int := public.member_top_position(p_server, auth.uid());
  changed uuid[];
begin
  perform public.require_permission(p_server, 32, 'manage roles');
  if not public.is_server_member(p_server, p_user) then
    raise exception 'That person isn''t a member of this server.';
  end if;
  if p_user <> auth.uid() and not public.outranks(p_server, p_user) and not is_owner then
    raise exception 'You can''t change roles for someone at or above your highest role.';
  end if;

  -- Roles being added or removed.
  select array_agg(id) into changed from (
    (select unnest(coalesce(p_role_ids, '{}')) as id
     except
     select role_id from public.member_roles where server_id = p_server and user_id = p_user)
    union
    (select role_id from public.member_roles where server_id = p_server and user_id = p_user
     except
     select unnest(coalesce(p_role_ids, '{}')))
  ) diff;

  if exists (
    select 1 from unnest(coalesce(changed, '{}')) as c(id)
    left join public.roles r on r.id = c.id
    where r.id is null or r.server_id <> p_server or r.is_default
       or (not is_owner and r.position >= my_top)
  ) then
    raise exception 'You can only assign roles below your highest role.';
  end if;

  delete from public.member_roles
  where server_id = p_server and user_id = p_user and role_id <> all (coalesce(p_role_ids, '{}'));

  insert into public.member_roles (server_id, user_id, role_id)
  select p_server, p_user, unnest(coalesce(p_role_ids, '{}'))
  on conflict (user_id, role_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

create or replace function public.require_moderatable(p_server uuid, p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user = auth.uid() then
    raise exception 'You can''t do that to yourself.';
  end if;
  if public.is_server_owner(p_server, p_user) then
    raise exception 'The server owner can''t be moderated.';
  end if;
  if public.is_server_member(p_server, p_user) and not public.outranks(p_server, p_user) then
    raise exception 'You can only moderate members below your highest role.';
  end if;
end;
$$;

create or replace function public.kick_member(p_server uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission(p_server, 128, 'kick members');
  perform public.require_moderatable(p_server, p_user);
  delete from public.server_members where server_id = p_server and user_id = p_user;
end;
$$;

-- Bans (and removes) a user. p_delete_seconds > 0 also deletes their recent messages.
create or replace function public.ban_member(
  p_server uuid,
  p_user uuid,
  p_reason text default null,
  p_delete_seconds integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission(p_server, 256, 'ban members');
  perform public.require_moderatable(p_server, p_user);

  insert into public.bans (server_id, user_id, reason, banned_by)
  values (p_server, p_user, nullif(trim(p_reason), ''), auth.uid())
  on conflict (server_id, user_id) do update
    set reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();

  delete from public.server_members where server_id = p_server and user_id = p_user;

  if coalesce(p_delete_seconds, 0) > 0 then
    delete from public.messages m
    using public.channels c
    where c.id = m.channel_id
      and c.server_id = p_server
      and m.author_id = p_user
      and m.created_at > now() - make_interval(secs => least(p_delete_seconds, 604800));
  end if;
end;
$$;

create or replace function public.unban_member(p_server uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission(p_server, 256, 'ban members');
  delete from public.bans where server_id = p_server and user_id = p_user;
end;
$$;

-- Times a member out until p_until (null clears it). Max 28 days, as in Discord.
create or replace function public.timeout_member(p_server uuid, p_user uuid, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission(p_server, 2048, 'time out members');
  perform public.require_moderatable(p_server, p_user);
  if p_until is not null and p_until > now() + interval '28 days' then
    raise exception 'Timeouts can last at most 28 days.';
  end if;
  update public.server_members
  set timeout_until = case when p_until is null or p_until <= now() then null else p_until end
  where server_id = p_server and user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private channels
-- ---------------------------------------------------------------------------

-- Makes a channel public, or private to the given roles, in one step. Non-admins must keep
-- one of their own roles in the list so they don't lock themselves out.
create or replace function public.set_channel_access(p_channel uuid, p_private boolean, p_role_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.channels;
begin
  select * into ch from public.channels where id = p_channel;
  if not found or ch.server_id is null or ch.type not in ('text', 'voice', 'category') then
    raise exception 'That channel can''t be made private.';
  end if;
  perform public.require_permission(ch.server_id, 16, 'manage channels');

  if exists (
    select 1 from unnest(coalesce(p_role_ids, '{}')) as x(id)
    left join public.roles r on r.id = x.id
    where r.id is null or r.server_id <> ch.server_id
  ) then
    raise exception 'Pick roles from this server.';
  end if;

  if p_private
     and public.server_permissions(ch.server_id) <> 2147483647
     and not exists (
       select 1 from public.member_roles mr
       where mr.server_id = ch.server_id and mr.user_id = auth.uid()
         and mr.role_id = any (coalesce(p_role_ids, '{}'))
     ) then
    raise exception 'Include one of your own roles so you keep access to this channel.';
  end if;

  update public.channels set is_private = p_private where id = p_channel;
  delete from public.channel_role_access where channel_id = p_channel;
  if p_private then
    insert into public.channel_role_access (channel_id, role_id)
    select p_channel, unnest(coalesce(p_role_ids, '{}'))
    on conflict do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_role(uuid, text, text, bigint, boolean, boolean)',
    'public.update_role(uuid, text, text, boolean, bigint, boolean, boolean)',
    'public.delete_role(uuid)',
    'public.reorder_roles(uuid, uuid[])',
    'public.set_member_roles(uuid, uuid, uuid[])',
    'public.kick_member(uuid, uuid)',
    'public.ban_member(uuid, uuid, text, integer)',
    'public.unban_member(uuid, uuid)',
    'public.timeout_member(uuid, uuid, timestamptz)',
    'public.set_channel_access(uuid, boolean, uuid[])'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- bans stays out of the Realtime publication: its key is (server_id, user_id), and DELETE
-- events skip RLS, so unbans would reveal who was banned to every subscriber.
