-- M2: servers, members, roles, channels, invites, bans, permission helpers and RPCs.
--
-- Permission bits (mirrored in src/lib/permissions.ts; keep them in sync):
--   VIEW_CHANNEL      1      MANAGE_SERVER     64      MODERATE_MEMBERS  2048
--   SEND_MESSAGES     2      KICK_MEMBERS     128      ATTACH_FILES      4096
--   MANAGE_MESSAGES   4      BAN_MEMBERS      256      ADD_REACTIONS     8192
--   MENTION_EVERYONE  8      ADMINISTRATOR    512      CONNECT          16384
--   MANAGE_CHANNELS  16      CREATE_INVITE   1024      SPEAK            32768
--   MANAGE_ROLES     32
-- ALL = 2147483647 (every bit that fits in a signed 32-bit int, so JS bit ops stay safe).
-- @everyone default = VIEW | SEND | CREATE_INVITE | ATTACH_FILES | ADD_REACTIONS | CONNECT | SPEAK = 62467

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint servers_name_length check (char_length(trim(name)) between 2 and 100)
);

create trigger servers_set_updated_at
  before update on public.servers
  for each row execute function public.set_updated_at();

-- Every table that can emit Realtime DELETE events has an opaque uuid key:
-- DELETE events skip RLS and carry only the primary key, so nothing meaningful leaks.
create table public.server_members (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  nickname text,
  joined_at timestamptz not null default now(),
  timeout_until timestamptz,
  constraint server_members_unique unique (server_id, user_id),
  constraint server_members_nickname_length
    check (nickname is null or char_length(nickname) between 1 and 32)
);

create index server_members_user_idx on public.server_members (user_id);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null,
  color text,
  -- Higher is more powerful. @everyone is always 0.
  position integer not null default 1,
  permissions bigint not null default 0,
  is_default boolean not null default false,
  hoist boolean not null default false,
  mentionable boolean not null default false,
  created_at timestamptz not null default now(),
  constraint roles_name_length check (char_length(trim(name)) between 1 and 100),
  constraint roles_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint roles_permissions_range check (permissions between 0 and 2147483647)
);

create unique index roles_one_default_per_server on public.roles (server_id) where is_default;
create index roles_server_idx on public.roles (server_id);

create table public.member_roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null,
  user_id uuid not null,
  role_id uuid not null references public.roles (id) on delete cascade,
  constraint member_roles_unique unique (user_id, role_id),
  constraint member_roles_member_fk foreign key (server_id, user_id)
    references public.server_members (server_id, user_id) on delete cascade
);

create index member_roles_server_user_idx on public.member_roles (server_id, user_id);
create index member_roles_role_idx on public.member_roles (role_id);

create type public.channel_type as enum ('text', 'voice', 'category', 'thread', 'dm', 'group_dm');

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references public.servers (id) on delete cascade,
  type public.channel_type not null,
  -- The category a text/voice channel sits in. Deleting a category un-nests its channels.
  parent_id uuid references public.channels (id) on delete set null,
  name text,
  topic text,
  position integer not null,
  is_private boolean not null default false,
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint channels_name_length check (name is null or char_length(name) between 1 and 100),
  constraint channels_topic_length check (topic is null or char_length(topic) <= 1024),
  constraint channels_server_types check (
    (type in ('text', 'voice', 'category', 'thread') and server_id is not null and name is not null)
    or (type in ('dm', 'group_dm') and server_id is null)
  )
);

create index channels_server_idx on public.channels (server_id);
create index channels_parent_idx on public.channels (parent_id);

create table public.channel_role_access (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  constraint channel_role_access_unique unique (channel_id, role_id)
);

create index channel_role_access_role_idx on public.channel_role_access (role_id);

create table public.invites (
  code text primary key,
  server_id uuid not null references public.servers (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  max_uses integer,
  uses integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invites_code_format check (code ~ '^[A-Za-z0-9]{8}$'),
  constraint invites_max_uses_positive check (max_uses is null or max_uses > 0)
);

create index invites_server_idx on public.invites (server_id);

create table public.bans (
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  banned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (server_id, user_id),
  constraint bans_reason_length check (reason is null or char_length(reason) <= 512)
);

-- ---------------------------------------------------------------------------
-- Permission helpers. SECURITY DEFINER so RLS policies can call them without recursion.
-- ---------------------------------------------------------------------------

create or replace function public.is_server_member(p_server uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.server_members
    where server_id = p_server and user_id = p_user
  );
$$;

create or replace function public.server_permissions(p_server uuid, p_user uuid default auth.uid())
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  perms bigint;
begin
  if p_user is null or p_server is null then
    return 0;
  end if;
  if exists (select 1 from public.servers where id = p_server and owner_id = p_user) then
    return 2147483647;
  end if;
  if not public.is_server_member(p_server, p_user) then
    return 0;
  end if;

  select coalesce(bit_or(r.permissions), 0) into perms
  from public.roles r
  where r.server_id = p_server
    and (
      r.is_default
      or exists (
        select 1 from public.member_roles mr
        where mr.role_id = r.id and mr.user_id = p_user
      )
    );

  if perms & 512 <> 0 then -- ADMINISTRATOR
    return 2147483647;
  end if;
  return perms;
end;
$$;

create or replace function public.has_server_permission(p_server uuid, p_perm bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.server_permissions(p_server) & p_perm) = p_perm;
$$;

-- Effective permissions for a channel given its row values: server permissions, zeroed when
-- the channel is private and none of the user's roles has access. Administrators see
-- everything. Taking the row's columns (instead of re-reading the channel) lets RLS policies
-- evaluate rows that aren't visible yet, e.g. INSERT ... RETURNING.
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

  return perms;
end;
$$;

-- The same, looked up by channel id.
create or replace function public.channel_permissions(p_channel uuid, p_user uuid default auth.uid())
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.channel_row_permissions(c.server_id, c.id, c.is_private, p_user)
     from public.channels c where c.id = p_channel),
    0
  );
$$;

create or replace function public.can_view_channel(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.channel_permissions(p_channel) & 1 <> 0;
$$;

-- Role hierarchy: the position of a member's highest role (owners outrank everyone).
create or replace function public.member_top_position(p_server uuid, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.servers where id = p_server and owner_id = p_user)
      then 2147483647
    else coalesce((
      select max(r.position)
      from public.member_roles mr
      join public.roles r on r.id = mr.role_id
      where mr.server_id = p_server and mr.user_id = p_user
    ), 0)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function public.servers_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.name := trim(new.name);
  return new;
end;
$$;

create trigger servers_guard
  before update on public.servers
  for each row execute function public.servers_guard();

-- Normalizes names, assigns a position, and keeps the category tree valid.
create or replace function public.channels_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.server_id := old.server_id;
    new.type := old.type;
    new.created_at := old.created_at;
  end if;

  if new.type = 'text' then
    -- Text channel names are lowercase with dashes, like Discord.
    new.name := trim(both '-' from regexp_replace(lower(trim(new.name)), '[\s-]+', '-', 'g'));
  elsif new.name is not null then
    new.name := trim(new.name);
  end if;
  if new.type in ('text', 'voice', 'category') and coalesce(new.name, '') = '' then
    raise exception 'Give the channel a name.';
  end if;

  if new.type = 'category' and new.parent_id is not null then
    raise exception 'Categories can''t be nested.';
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.channels
    where id = new.parent_id and server_id = new.server_id and type = 'category'
  ) then
    raise exception 'That category isn''t in this server.';
  end if;

  if tg_op = 'INSERT' and new.position is null then
    select coalesce(max(position), -1) + 1 into new.position
    from public.channels where server_id = new.server_id;
  end if;
  return new;
end;
$$;

create trigger channels_guard
  before insert or update on public.channels
  for each row execute function public.channels_guard();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.roles enable row level security;
alter table public.member_roles enable row level security;
alter table public.channels enable row level security;
alter table public.channel_role_access enable row level security;
alter table public.invites enable row level security;
alter table public.bans enable row level security;

-- Servers: members see them; MANAGE_SERVER edits; only the owner deletes. Creation is an RPC.
create policy "members see their servers"
  on public.servers for select to authenticated
  using (public.is_server_member(id));

create policy "managers edit servers"
  on public.servers for update to authenticated
  using (public.has_server_permission(id, 64))
  with check (public.has_server_permission(id, 64));

create policy "owners delete servers"
  on public.servers for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Members: visible to fellow members. Joining, leaving and moderation go through RPCs.
create policy "members see fellow members"
  on public.server_members for select to authenticated
  using (public.is_server_member(server_id));

create policy "members see roles"
  on public.roles for select to authenticated
  using (public.is_server_member(server_id));

create policy "members see role assignments"
  on public.member_roles for select to authenticated
  using (public.is_server_member(server_id));

-- Channels: visible per channel_permissions; MANAGE_CHANNELS creates, edits and deletes.
create policy "members see channels they can view"
  on public.channels for select to authenticated
  using (
    server_id is not null
    and public.channel_row_permissions(server_id, id, is_private) & 1 <> 0
  );

create policy "channel managers create channels"
  on public.channels for insert to authenticated
  with check (
    server_id is not null
    and type in ('text', 'voice', 'category')
    and public.has_server_permission(server_id, 16)
  );

create policy "channel managers edit channels"
  on public.channels for update to authenticated
  using (server_id is not null and public.has_server_permission(server_id, 16))
  with check (server_id is not null and public.has_server_permission(server_id, 16));

create policy "channel managers delete channels"
  on public.channels for delete to authenticated
  using (
    server_id is not null
    and type in ('text', 'voice', 'category')
    and public.has_server_permission(server_id, 16)
  );

create policy "members see channel access rules"
  on public.channel_role_access for select to authenticated
  using (exists (
    select 1 from public.channels c
    where c.id = channel_id and public.is_server_member(c.server_id)
  ));

create policy "channel managers set channel access"
  on public.channel_role_access for all to authenticated
  using (exists (
    select 1 from public.channels c
    where c.id = channel_id and public.has_server_permission(c.server_id, 16)
  ))
  with check (exists (
    select 1 from public.channels c
    join public.roles r on r.id = role_id and r.server_id = c.server_id
    where c.id = channel_id and public.has_server_permission(c.server_id, 16)
  ));

-- Invites: listed for people who manage the server; created through create_invite().
create policy "managers see invites"
  on public.invites for select to authenticated
  using (public.has_server_permission(server_id, 64) or created_by = (select auth.uid()));

create policy "managers and creators revoke invites"
  on public.invites for delete to authenticated
  using (public.has_server_permission(server_id, 64) or created_by = (select auth.uid()));

create policy "ban managers see bans"
  on public.bans for select to authenticated
  using (public.has_server_permission(server_id, 256));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates a server with the default structure, the @everyone role and the owner's membership.
create or replace function public.create_server(p_name text, p_icon_url text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  text_cat uuid;
  voice_cat uuid;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 100 then
    raise exception 'Server names need 2 to 100 characters.';
  end if;

  insert into public.servers (name, icon_url, owner_id)
  values (trim(p_name), p_icon_url, uid)
  returning id into sid;

  insert into public.roles (server_id, name, position, permissions, is_default)
  values (sid, '@everyone', 0, 62467, true);

  insert into public.server_members (server_id, user_id) values (sid, uid);

  insert into public.channels (server_id, type, name, position)
  values (sid, 'category', 'Text Channels', 0)
  returning id into text_cat;
  insert into public.channels (server_id, type, name, parent_id, position)
  values (sid, 'text', 'general', text_cat, 1);

  insert into public.channels (server_id, type, name, position)
  values (sid, 'category', 'Voice Channels', 2)
  returning id into voice_cat;
  insert into public.channels (server_id, type, name, parent_id, position)
  values (sid, 'voice', 'General', voice_cat, 3);

  return sid;
end;
$$;

-- Generates an 8-character invite code. max_age_seconds = null means it never expires.
create or replace function public.create_invite(
  p_server uuid,
  p_max_age_seconds integer default 604800,
  p_max_uses integer default null
)
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  new_code text;
  inv public.invites;
begin
  if not public.has_server_permission(p_server, 1024) then
    raise exception 'You don''t have permission to create invites here.';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'Max uses must be at least 1.';
  end if;

  loop
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      into new_code
    from generate_series(1, 8);
    exit when not exists (select 1 from public.invites where code = new_code);
  end loop;

  insert into public.invites (code, server_id, created_by, max_uses, expires_at)
  values (
    new_code,
    p_server,
    auth.uid(),
    p_max_uses,
    case when p_max_age_seconds is null or p_max_age_seconds <= 0 then null
         else now() + make_interval(secs => p_max_age_seconds) end
  )
  returning * into inv;
  return inv;
end;
$$;

-- Invite preview for the /invite page. Callable while signed out.
create or replace function public.get_invite(p_code text)
returns table (
  code text,
  server_id uuid,
  server_name text,
  server_icon_url text,
  member_count bigint,
  expires_at timestamptz,
  is_valid boolean,
  is_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.code,
    s.id,
    s.name,
    s.icon_url,
    (select count(*) from public.server_members m where m.server_id = s.id),
    i.expires_at,
    (i.expires_at is null or i.expires_at > now()) and (i.max_uses is null or i.uses < i.max_uses),
    public.is_server_member(s.id)
  from public.invites i
  join public.servers s on s.id = i.server_id
  where i.code = p_code;
$$;

create or replace function public.join_server_by_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.invites;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;

  select * into inv from public.invites where code = p_code for update;
  if not found then
    raise exception 'This invite is invalid or has been revoked.';
  end if;

  if public.is_server_member(inv.server_id, uid) then
    return inv.server_id;
  end if;
  if inv.expires_at is not null and inv.expires_at <= now() then
    raise exception 'This invite has expired.';
  end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then
    raise exception 'This invite has reached its maximum number of uses.';
  end if;
  if exists (select 1 from public.bans where server_id = inv.server_id and user_id = uid) then
    raise exception 'You''re banned from this server.';
  end if;

  insert into public.server_members (server_id, user_id) values (inv.server_id, uid);
  update public.invites set uses = uses + 1 where code = p_code;
  return inv.server_id;
end;
$$;

create or replace function public.leave_server(p_server uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.servers where id = p_server and owner_id = auth.uid()) then
    raise exception 'Owners can''t leave their own server. Delete it or transfer ownership first.';
  end if;
  delete from public.server_members where server_id = p_server and user_id = auth.uid();
end;
$$;

-- Moves channels and categories in one transaction.
-- p_items: [{ "id": uuid, "position": int, "parent_id": uuid | null }, ...]
create or replace function public.reorder_channels(p_server uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
begin
  if not public.has_server_permission(p_server, 16) then
    raise exception 'You don''t have permission to manage channels.';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    update public.channels
    set position = (item ->> 'position')::int,
        parent_id = public.try_uuid(item ->> 'parent_id')
    where id = public.try_uuid(item ->> 'id')
      and server_id = p_server
      and type in ('text', 'voice', 'category');
  end loop;
end;
$$;

revoke execute on function public.create_server(text, text) from public, anon;
revoke execute on function public.create_invite(uuid, integer, integer) from public, anon;
revoke execute on function public.join_server_by_invite(text) from public, anon;
revoke execute on function public.leave_server(uuid) from public, anon;
revoke execute on function public.reorder_channels(uuid, jsonb) from public, anon;
grant execute on function public.create_server(text, text) to authenticated;
grant execute on function public.create_invite(uuid, integer, integer) to authenticated;
grant execute on function public.join_server_by_invite(text) to authenticated;
grant execute on function public.leave_server(uuid) to authenticated;
grant execute on function public.reorder_channels(uuid, jsonb) to authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Server icons: public read; MANAGE_SERVER writes inside {server_id}/.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'server-icons',
  'server-icons',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "server-icons: managers can list"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'server-icons'
    and public.has_server_permission(public.try_uuid((storage.foldername(name))[1]), 64)
  );

create policy "server-icons: managers can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'server-icons'
    and public.has_server_permission(public.try_uuid((storage.foldername(name))[1]), 64)
  );

create policy "server-icons: managers can replace"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'server-icons'
    and public.has_server_permission(public.try_uuid((storage.foldername(name))[1]), 64)
  );

create policy "server-icons: managers can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'server-icons'
    and public.has_server_permission(public.try_uuid((storage.foldername(name))[1]), 64)
  );

-- ---------------------------------------------------------------------------
-- Realtime: RLS-filtered change events for the structural tables.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.profiles,
  public.servers,
  public.server_members,
  public.roles,
  public.member_roles,
  public.channels,
  public.channel_role_access;
