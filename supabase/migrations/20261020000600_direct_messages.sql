-- M6: direct messages (1:1 and group DMs of up to 10 people) and friends.
-- DMs are channels with no server; their recipients live in channel_recipients.

-- ---------------------------------------------------------------------------
-- Recipients
-- ---------------------------------------------------------------------------

-- "low:high" user ids for a 1:1 DM, so each pair has exactly one.
alter table public.channels add column dm_key text unique;

create table public.channel_recipients (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- "Close DM" hides it from the list until a new message arrives.
  hidden boolean not null default false,
  joined_at timestamptz not null default now(),
  constraint channel_recipients_unique unique (channel_id, user_id)
);

create index channel_recipients_user_idx on public.channel_recipients (user_id);

create or replace function public.is_channel_recipient(p_channel uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channel_recipients where channel_id = p_channel and user_id = p_user
  );
$$;

-- DMs: recipients can view, send, attach and react (VIEW | SEND | ATTACH_FILES | ADD_REACTIONS).
create or replace function public.channel_permissions(p_channel uuid, p_user uuid default auth.uid())
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when c.server_id is null then
        case when c.type in ('dm', 'group_dm') and public.is_channel_recipient(c.id, p_user)
             then 1 | 2 | 4096 | 8192 else 0 end
      else public.channel_row_permissions(c.server_id, c.id, c.is_private, p_user)
    end
    from public.channels c where c.id = p_channel
  ), 0);
$$;

create or replace function public.can_send(p_channel uuid, p_user uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ch record;
begin
  select id, server_id, type into ch from public.channels where id = p_channel;
  if not found then
    return false;
  end if;
  if ch.type in ('dm', 'group_dm') then
    return public.is_channel_recipient(p_channel, p_user);
  end if;
  if ch.type not in ('text', 'thread') then
    return false;
  end if;
  if public.channel_permissions(p_channel, p_user) & 2 = 0 then -- SEND_MESSAGES
    return false;
  end if;
  return not exists (
    select 1 from public.server_members
    where server_id = ch.server_id and user_id = p_user and timeout_until > now()
  );
end;
$$;

alter table public.channel_recipients enable row level security;

create policy "recipients see their DM channels"
  on public.channels for select to authenticated
  using (server_id is null and public.is_channel_recipient(id));

create policy "recipients see each other"
  on public.channel_recipients for select to authenticated
  using (public.is_channel_recipient(channel_id));

-- Reopen hidden DMs when someone writes in them.
create or replace function public.messages_unhide_dm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.channel_recipients set hidden = false
  where channel_id = new.channel_id and hidden;
  return null;
end;
$$;

create trigger messages_unhide_dm
  after insert on public.messages
  for each row execute function public.messages_unhide_dm();

-- ---------------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------------

create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "people see their own friendships"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(p_a, p_b)
      and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
  );
$$;

create or replace function public.shares_server(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.server_members a
    join public.server_members b on b.server_id = a.server_id
    where a.user_id = p_a and b.user_id = p_b
  );
$$;

-- Sends a request by username. If they already asked you, this accepts it instead.
create or replace function public.send_friend_request(p_username text)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  them uuid;
  existing public.friendships;
begin
  select id into them from public.profiles where username = lower(trim(p_username));
  if them is null then
    raise exception 'Hm, didn''t work. Double check that the username is correct.';
  end if;
  if them = me then
    raise exception 'You can''t add yourself as a friend.';
  end if;

  select * into existing from public.friendships
  where least(requester_id, addressee_id) = least(me, them)
    and greatest(requester_id, addressee_id) = greatest(me, them);

  if found then
    if existing.status = 'accepted' then
      raise exception 'You''re already friends with that user!';
    end if;
    if existing.requester_id = me then
      raise exception 'You''ve already sent them a friend request.';
    end if;
    update public.friendships set status = 'accepted', accepted_at = now()
    where id = existing.id
    returning * into existing;
    return existing;
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (me, them)
  returning * into existing;
  return existing;
end;
$$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
    where id = p_request and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
    where id = p_request and status = 'pending' and auth.uid() in (requester_id, addressee_id);
  end if;
end;
$$;

-- Removes a friend, or cancels/ignores a pending request, in either direction.
create or replace function public.remove_friend(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
  where least(requester_id, addressee_id) = least(auth.uid(), p_user)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
$$;

-- ---------------------------------------------------------------------------
-- DM RPCs
-- ---------------------------------------------------------------------------

-- Opens (or reuses) the 1:1 DM with a user. Allowed with friends, people you share a server
-- with, or anyone you already have a DM with.
create or replace function public.open_dm(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  key text;
  cid uuid;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  if p_user = me then
    raise exception 'You can''t message yourself.';
  end if;
  key := least(me, p_user)::text || ':' || greatest(me, p_user)::text;

  select id into cid from public.channels where dm_key = key;
  if cid is not null then
    update public.channel_recipients set hidden = false where channel_id = cid and user_id = me;
    return cid;
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'That user doesn''t exist.';
  end if;
  if not public.are_friends(me, p_user) and not public.shares_server(me, p_user) then
    raise exception 'You can only message friends or people you share a server with.';
  end if;

  insert into public.channels (type, dm_key, position) values ('dm', key, 0) returning id into cid;
  insert into public.channel_recipients (channel_id, user_id) values (cid, me), (cid, p_user);
  return cid;
end;
$$;

-- Starts a group DM with friends (up to 10 people including you).
create or replace function public.create_group_dm(p_users uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  others uuid[] := array(select distinct u from unnest(coalesce(p_users, '{}')) u where u <> me);
  cid uuid;
begin
  if coalesce(array_length(others, 1), 0) = 0 then
    raise exception 'Pick at least one friend.';
  end if;
  if array_length(others, 1) = 1 then
    return public.open_dm(others[1]);
  end if;
  if array_length(others, 1) + 1 > 10 then
    raise exception 'Group DMs can have up to 10 people.';
  end if;
  if exists (select 1 from unnest(others) u where not public.are_friends(me, u)) then
    raise exception 'You can only add friends to a group DM.';
  end if;

  insert into public.channels (type, owner_id, position) values ('group_dm', me, 0) returning id into cid;
  insert into public.channel_recipients (channel_id, user_id)
  select cid, u from unnest(array_append(others, me)) u;
  return cid;
end;
$$;

create or replace function public.add_group_dm_recipients(p_channel uuid, p_users uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  others uuid[] := array(
    select distinct u from unnest(coalesce(p_users, '{}')) u
    where not public.is_channel_recipient(p_channel, u)
  );
begin
  if not exists (select 1 from public.channels where id = p_channel and type = 'group_dm')
     or not public.is_channel_recipient(p_channel, me) then
    raise exception 'That isn''t one of your group DMs.';
  end if;
  if exists (select 1 from unnest(others) u where not public.are_friends(me, u)) then
    raise exception 'You can only add friends to a group DM.';
  end if;
  if (select count(*) from public.channel_recipients where channel_id = p_channel)
     + coalesce(array_length(others, 1), 0) > 10 then
    raise exception 'Group DMs can have up to 10 people.';
  end if;
  insert into public.channel_recipients (channel_id, user_id)
  select p_channel, u from unnest(others) u
  on conflict do nothing;
end;
$$;

-- Leaves a group DM. Ownership passes to the longest-standing member; the last one out deletes it.
create or replace function public.leave_group_dm(p_channel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_owner uuid;
begin
  delete from public.channel_recipients
  where channel_id = p_channel and user_id = auth.uid()
    and exists (select 1 from public.channels where id = p_channel and type = 'group_dm');
  if not found then
    return;
  end if;

  select user_id into next_owner from public.channel_recipients
  where channel_id = p_channel order by joined_at limit 1;
  if next_owner is null then
    delete from public.channels where id = p_channel;
  else
    update public.channels set owner_id = next_owner
    where id = p_channel and owner_id = auth.uid();
  end if;
end;
$$;

create or replace function public.rename_group_dm(p_channel uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_channel_recipient(p_channel) then
    raise exception 'That isn''t one of your group DMs.';
  end if;
  update public.channels
  set name = nullif(left(trim(coalesce(p_name, '')), 100), '')
  where id = p_channel and type = 'group_dm';
end;
$$;

create or replace function public.close_dm(p_channel uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.channel_recipients set hidden = true
  where channel_id = p_channel and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Unread state now covers DMs: every unread message from someone else counts as a mention.
-- ---------------------------------------------------------------------------

create or replace function public.get_unread_state()
returns table (
  channel_id uuid,
  server_id uuid,
  last_message_at timestamptz,
  last_read_at timestamptz,
  mention_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  visible as (
    select c.id, c.server_id, a.last_message_at,
           coalesce(rs.last_read_at, sm.joined_at) as last_read_at
    from public.server_members sm
    join me on sm.user_id = me.uid
    join public.channels c on c.server_id = sm.server_id and c.type in ('text', 'thread')
    join public.channel_activity a on a.channel_id = c.id
    left join public.read_states rs on rs.channel_id = c.id and rs.user_id = me.uid
    where public.can_view_channel(c.id)
  ),
  dms as (
    select c.id, a.last_message_at, coalesce(rs.last_read_at, r.joined_at) as last_read_at
    from public.channel_recipients r
    join me on r.user_id = me.uid
    join public.channels c on c.id = r.channel_id
    join public.channel_activity a on a.channel_id = c.id
    left join public.read_states rs on rs.channel_id = c.id and rs.user_id = me.uid
  )
  select v.id, v.server_id, v.last_message_at, v.last_read_at,
    case when v.last_message_at <= v.last_read_at then 0 else (
      select count(*) from public.messages m, me
      where m.channel_id = v.id
        and m.created_at > v.last_read_at
        and m.author_id is distinct from me.uid
        and (
          me.uid = any (m.mentions)
          or m.mention_everyone
          or m.mention_roles && array(
            select mr.role_id from public.member_roles mr
            where mr.server_id = v.server_id and mr.user_id = me.uid
          )
        )
    ) end
  from visible v
  union all
  select d.id, null::uuid, d.last_message_at, d.last_read_at,
    case when d.last_message_at <= d.last_read_at then 0 else (
      select count(*) from public.messages m, me
      where m.channel_id = d.id and m.created_at > d.last_read_at and m.author_id is distinct from me.uid
    ) end
  from dms d;
$$;

-- ---------------------------------------------------------------------------
-- Grants, Realtime
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.send_friend_request(text)',
    'public.respond_friend_request(uuid, boolean)',
    'public.remove_friend(uuid)',
    'public.open_dm(uuid)',
    'public.create_group_dm(uuid[])',
    'public.add_group_dm_recipients(uuid, uuid[])',
    'public.leave_group_dm(uuid)',
    'public.rename_group_dm(uuid, text)',
    'public.close_dm(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

alter publication supabase_realtime add table public.channel_recipients, public.friendships;
