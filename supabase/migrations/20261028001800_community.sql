-- Milestone 16: community features.
--   MANAGE_EVENTS 524288   (1 << 19)   create, edit and cancel scheduled events
--
--   * Announcement channels: members can't post by default (an @everyone override denies
--     SEND when one is created). Other servers can follow one into a text channel, and
--     publish_message() copies a post to every follower.
--   * Forum channels: no chat of their own; each post is a thread with a title, a first
--     message and optional tags from the forum's list.
--   * Scheduled events, with "Interested".
--   * Welcome screen (a description and up to five recommended channels) and rules that new
--     members accept before they can talk.
--   * Vanity invite links (/invite/<vanity>).

-- ---------------------------------------------------------------------------
-- New channel types
-- ---------------------------------------------------------------------------

alter table public.channels drop constraint if exists channels_server_types;
alter table public.channels add constraint channels_server_types check (
  (type in ('text', 'voice', 'category', 'thread', 'announcement', 'forum') and server_id is not null and name is not null)
  or (type in ('dm', 'group_dm') and server_id is null)
);

drop policy if exists "channel managers create channels" on public.channels;
create policy "channel managers create channels"
  on public.channels for insert to authenticated
  with check (
    server_id is not null
    and type in ('text', 'voice', 'category', 'announcement', 'forum')
    and public.has_server_permission(server_id, 16)
  );

drop policy if exists "channel managers delete channels" on public.channels;
create policy "channel managers delete channels"
  on public.channels for delete to authenticated
  using (
    server_id is not null
    and type in ('text', 'voice', 'category', 'announcement', 'forum')
    and public.has_server_permission(server_id, 16)
  );

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
      and type in ('text', 'voice', 'category', 'announcement', 'forum');
  end loop;
end;
$$;

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
    new.source_message_id := old.source_message_id;
    if new.type = 'thread' then
      new.parent_id := old.parent_id;
    end if;
  end if;

  if new.type in ('text', 'announcement', 'forum') then
    new.name := trim(both '-' from regexp_replace(lower(trim(new.name)), '[\s-]+', '-', 'g'));
  elsif new.name is not null then
    new.name := trim(new.name);
  end if;
  if new.server_id is not null and coalesce(new.name, '') = '' then
    raise exception 'Give the channel a name.';
  end if;

  if new.type = 'category' and new.parent_id is not null then
    raise exception 'Categories can''t be nested.';
  end if;
  if new.type = 'thread' then
    if not exists (
      select 1 from public.channels
      where id = new.parent_id and server_id = new.server_id and type in ('text', 'announcement', 'forum')
    ) then
      raise exception 'Threads belong to a text, announcement or forum channel.';
    end if;
  elsif new.parent_id is not null and not exists (
    select 1 from public.channels
    where id = new.parent_id and server_id = new.server_id and type = 'category'
  ) then
    raise exception 'That category isn''t in this server.';
  end if;

  if tg_op = 'INSERT' and (new.position is null or new.position < 0) then
    select coalesce(max(position), -1) + 1 into new.position
    from public.channels where server_id = new.server_id;
  end if;
  return new;
end;
$$;

drop trigger if exists channels_delete_threads on public.channels;
create trigger channels_delete_threads
  before delete on public.channels
  for each row when (old.type in ('text', 'announcement', 'forum'))
  execute function public.channels_delete_threads();

create or replace function public.create_thread(p_message uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg public.messages;
  parent public.channels;
  tid uuid;
  thread_name text := left(trim(coalesce(p_name, '')), 100);
begin
  select * into msg from public.messages where id = p_message;
  if not found then
    raise exception 'That message no longer exists.';
  end if;
  select * into parent from public.channels where id = msg.channel_id;
  if parent.type not in ('text', 'announcement') then
    raise exception 'Threads can only be started in text and announcement channels.';
  end if;
  if not public.can_send(parent.id) then
    raise exception 'You don''t have permission to start threads here.';
  end if;

  select id into tid from public.channels where source_message_id = p_message;
  if tid is not null then
    return tid;
  end if;

  if thread_name = '' then
    thread_name := coalesce(nullif(left(regexp_replace(msg.content, '\s+', ' ', 'g'), 40), ''), 'New Thread');
  end if;

  insert into public.channels (server_id, type, parent_id, name, owner_id, source_message_id, position)
  values (parent.server_id, 'thread', parent.id, thread_name, auth.uid(), p_message, 0)
  returning id into tid;

  -- A note in the parent channel, as Discord does.
  insert into public.messages (id, channel_id, author_id, type, reply_to_id, content)
  values (gen_random_uuid(), parent.id, auth.uid(), 'thread_created', p_message, thread_name);
  return tid;
end;
$$;

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
    join public.channels c on c.server_id = sm.server_id and c.type in ('text', 'thread', 'announcement', 'voice')
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

-- Forum tags: the forum's list ({id, name, emoji}) and the ones a post (thread) carries.
alter table public.channels add column if not exists available_tags jsonb not null default '[]'::jsonb;
alter table public.channels add column if not exists applied_tags text[] not null default '{}';
alter table public.channels drop constraint if exists channels_tags_shape;
alter table public.channels add constraint channels_tags_shape check (
  jsonb_typeof(available_tags) = 'array' and jsonb_array_length(available_tags) <= 20 and cardinality(applied_tags) <= 5
);

-- ---------------------------------------------------------------------------
-- Welcome screen, rules and vanity links
-- ---------------------------------------------------------------------------

alter table public.servers add column if not exists description text;
alter table public.servers add column if not exists welcome_enabled boolean not null default false;
-- [{channel_id, description, emoji}], up to five.
alter table public.servers add column if not exists welcome_channels jsonb not null default '[]'::jsonb;
alter table public.servers add column if not exists rules text[] not null default '{}';
alter table public.servers add column if not exists rules_enabled boolean not null default false;
alter table public.servers add column if not exists vanity_code text unique;

alter table public.servers drop constraint if exists servers_community_shape;
alter table public.servers add constraint servers_community_shape check (
  (description is null or char_length(description) <= 300)
  and jsonb_typeof(welcome_channels) = 'array' and jsonb_array_length(welcome_channels) <= 5
  and cardinality(rules) <= 20
  and (vanity_code is null or vanity_code ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')
);

-- New members of a server with rules wait as "pending" until they accept them.
alter table public.server_members add column if not exists pending boolean not null default false;

create or replace function public.server_members_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.pending := coalesce(
      (select rules_enabled and cardinality(rules) > 0 and owner_id <> new.user_id from public.servers where id = new.server_id),
      false
    );
  elsif current_user = 'authenticated' then
    -- Only accept_rules() clears it.
    new.pending := old.pending;
  end if;
  return new;
end;
$$;

drop trigger if exists server_members_pending on public.server_members;
create trigger server_members_pending
  before insert or update on public.server_members
  for each row execute function public.server_members_pending();

-- Whether someone still has to accept a server's rules (and the server still has them on).
create or replace function public.member_pending(p_server uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.server_members m
    join public.servers s on s.id = m.server_id
    where m.server_id = p_server and m.user_id = p_user and m.pending and s.rules_enabled
  );
$$;

create or replace function public.accept_rules(p_server uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.server_members set pending = false where server_id = p_server and user_id = auth.uid();
end;
$$;

revoke execute on function public.accept_rules(uuid) from public, anon;
grant execute on function public.accept_rules(uuid) to authenticated;

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
  where i.code = p_code
  union all
  -- A server's vanity link (never expires, no use limit).
  select
    s.vanity_code,
    s.id,
    s.name,
    s.icon_url,
    (select count(*) from public.server_members m where m.server_id = s.id),
    null::timestamptz,
    true,
    public.is_server_member(s.id)
  from public.servers s
  where s.vanity_code = lower(p_code)
    and not exists (select 1 from public.invites where code = p_code);
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
  vanity_server uuid;
begin
  if uid is null then
    raise exception 'Sign in first.';
  end if;

  select * into inv from public.invites where code = p_code for update;
  if not found then
    -- Vanity links: a server's own code, always valid.
    select id into vanity_server from public.servers where vanity_code = lower(p_code);
    if vanity_server is null then
      raise exception 'This invite is invalid or has been revoked.';
    end if;
    if public.is_server_member(vanity_server, uid) then
      return vanity_server;
    end if;
    if exists (select 1 from public.bans where server_id = vanity_server and user_id = uid) then
      raise exception 'You''re banned from this server.';
    end if;
    insert into public.server_members (server_id, user_id) values (vanity_server, uid);
    return vanity_server;
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

-- Sending: announcement channels too; not while timed out or still pending the rules.
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
  if ch.type not in ('text', 'thread', 'voice', 'announcement') then
    return false;
  end if;
  if public.channel_permissions(p_channel, p_user) & 2 = 0 then -- SEND_MESSAGES
    return false;
  end if;
  if public.member_pending(ch.server_id, p_user) then
    return false;
  end if;
  return not exists (
    select 1 from public.server_members
    where server_id = ch.server_id and user_id = p_user and timeout_until > now()
  );
end;
$$;

create or replace function public.can_join_voice(p_channel uuid, p_user uuid default auth.uid())
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
  if not found or ch.type <> 'voice' or ch.server_id is null then
    return false;
  end if;
  if public.channel_permissions(p_channel, p_user) & 16384 = 0 then -- CONNECT
    return false;
  end if;
  if public.member_pending(ch.server_id, p_user) then
    return false;
  end if;
  return not exists (
    select 1 from public.server_members
    where server_id = ch.server_id and user_id = p_user and timeout_until > now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Announcement channels: posting is opt-in, following and publishing
-- ---------------------------------------------------------------------------

create or replace function public.channels_announcement_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.channel_overwrites (channel_id, role_id, allow, deny)
  select new.id, r.id, 0, 2 from public.roles r where r.server_id = new.server_id and r.is_default;
  return new;
end;
$$;

drop trigger if exists channels_announcement_default on public.channels;
create trigger channels_announcement_default
  after insert on public.channels
  for each row when (new.type = 'announcement')
  execute function public.channels_announcement_default();

alter table public.messages add column if not exists published_at timestamptz;

create or replace function public.messages_a_forward_poll()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  src public.messages;
  answer jsonb;
  answers jsonb := '[]'::jsonb;
  answer_text text;
  answer_emoji text;
  question text;
  hours integer;
  n integer := 0;
  published boolean;
begin
  if tg_op = 'UPDATE' then
    new.forwarded := old.forwarded;
    new.reply_ping := old.reply_ping;
    -- Ending a poll early goes through end_poll() (security definer).
    if current_user = 'authenticated' then
      new.poll := old.poll;
      new.published_at := old.published_at;
    end if;
    return new;
  end if;

  if new.forwarded is not null then
    -- Publishing an announcement (publish_message, security definer) marks the copy as such.
    published := current_user <> 'authenticated' and coalesce(new.forwarded ->> 'published', '') = 'true';
    -- Read with the sender's rights: you can only forward what you can see.
    select * into src from public.messages where id = public.try_uuid(new.forwarded ->> 'message_id');
    if src.id is null or src.type not in ('default', 'reply') or src.poll is not null then
      raise exception 'That message can''t be forwarded.';
    end if;
    -- Forwarding a forward passes the original along.
    new.forwarded := coalesce(
      src.forwarded,
      jsonb_build_object(
        'message_id', src.id,
        'channel_id', src.channel_id,
        'author_id', src.author_id,
        'content', src.content,
        'created_at', src.created_at
      )
    );
    if published then
      new.forwarded := new.forwarded || (
        select jsonb_build_object('published', true, 'channel_name', c.name, 'server_name', s.name)
        from public.channels c join public.servers s on s.id = c.server_id
        where c.id = src.channel_id
      );
    end if;
    new.reply_to_id := null;
    new.poll := null;
  end if;

  if new.poll is not null then
    question := btrim(new.poll ->> 'question');
    if question is null or char_length(question) not between 1 and 300 then
      raise exception 'Poll questions can be 1 to 300 characters.';
    end if;
    if jsonb_typeof(new.poll -> 'answers') is distinct from 'array'
       or jsonb_array_length(new.poll -> 'answers') not between 2 and 10 then
      raise exception 'Polls need 2 to 10 answers.';
    end if;
    for answer in select * from jsonb_array_elements(new.poll -> 'answers') loop
      n := n + 1;
      answer_text := btrim(answer ->> 'text');
      if answer_text is null or char_length(answer_text) not between 1 and 55 then
        raise exception 'Poll answers can be 1 to 55 characters.';
      end if;
      answer_emoji := nullif(btrim(coalesce(answer ->> 'emoji', '')), '');
      if char_length(answer_emoji) > 100 then
        raise exception 'That answer''s emoji isn''t valid.';
      end if;
      answers := answers || jsonb_build_object('id', n, 'text', answer_text, 'emoji', answer_emoji);
    end loop;
    if coalesce(new.poll ->> 'duration_hours', '') !~ '^\d{1,3}$' then
      raise exception 'Pick how long the poll should run.';
    end if;
    hours := (new.poll ->> 'duration_hours')::integer;
    if hours not in (1, 4, 8, 24, 72, 168, 336) then
      raise exception 'Pick how long the poll should run.';
    end if;
    new.poll := jsonb_build_object(
      'question', question,
      'answers', answers,
      'multiselect', coalesce(new.poll ->> 'multiselect', 'false') = 'true',
      'expires_at', now() + make_interval(hours => hours)
    );
  end if;
  return new;
end;
$$;

create table if not exists public.channel_follows (
  id uuid primary key default gen_random_uuid(),
  source_channel_id uuid not null references public.channels (id) on delete cascade,
  target_channel_id uuid not null references public.channels (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint channel_follows_unique unique (source_channel_id, target_channel_id)
);

alter table public.channel_follows enable row level security;

drop policy if exists "follow managers see follows" on public.channel_follows;
create policy "follow managers see follows"
  on public.channel_follows for select to authenticated
  using (
    public.can_view_channel(target_channel_id)
    or public.has_server_permission((select server_id from public.channels where id = source_channel_id), 16)
  );

-- Follows an announcement channel into a text channel of a server you manage channels in.
create or replace function public.follow_channel(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.channels;
  dst public.channels;
begin
  select * into src from public.channels where id = p_source;
  if src.id is null or src.type <> 'announcement' or not public.can_view_channel(p_source) then
    raise exception 'That announcement channel isn''t available.';
  end if;
  select * into dst from public.channels where id = p_target;
  if dst.id is null or dst.type <> 'text' or not public.has_server_permission(dst.server_id, 16) then
    raise exception 'You need Manage Channels in the server you follow into.';
  end if;
  if dst.server_id = src.server_id then
    raise exception 'Pick a channel in another server.';
  end if;
  insert into public.channel_follows (source_channel_id, target_channel_id) values (p_source, p_target)
  on conflict do nothing;
end;
$$;

create or replace function public.unfollow_channel(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.has_server_permission((select server_id from public.channels where id = p_target), 16)
    or public.has_server_permission((select server_id from public.channels where id = p_source), 16)
  ) then
    raise exception 'You don''t have permission to change this follow.';
  end if;
  delete from public.channel_follows where source_channel_id = p_source and target_channel_id = p_target;
end;
$$;

-- Sends an announcement to every following channel (as a "published" forward). Returns how many got it.
create or replace function public.publish_message(p_message uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
  ch public.channels;
  target uuid;
  sent integer := 0;
begin
  select * into m from public.messages where id = p_message;
  if m.id is null then
    raise exception 'That message no longer exists.';
  end if;
  select * into ch from public.channels where id = m.channel_id;
  if ch.type <> 'announcement' then
    raise exception 'Only messages in announcement channels can be published.';
  end if;
  if not public.can_view_channel(ch.id)
     or (m.author_id is distinct from auth.uid() and public.channel_permissions(ch.id) & 4 = 0) then
    raise exception 'You can''t publish this message.';
  end if;
  if m.published_at is not null then
    raise exception 'This message was already published.';
  end if;
  if m.type not in ('default', 'reply') or m.poll is not null then
    raise exception 'This message can''t be published.';
  end if;

  update public.messages set published_at = now() where id = p_message;
  for target in select target_channel_id from public.channel_follows where source_channel_id = ch.id loop
    begin
      insert into public.messages (id, channel_id, author_id, content, forwarded)
      values (gen_random_uuid(), target, auth.uid(), '', jsonb_build_object('message_id', m.id, 'published', true));
      sent := sent + 1;
    exception when others then
      -- One follower's slow mode or AutoMod doesn't stop the rest.
      null;
    end;
  end loop;
  return sent;
end;
$$;

revoke execute on function public.follow_channel(uuid, uuid) from public, anon;
revoke execute on function public.unfollow_channel(uuid, uuid) from public, anon;
revoke execute on function public.publish_message(uuid) from public, anon;
grant execute on function public.follow_channel(uuid, uuid) to authenticated;
grant execute on function public.unfollow_channel(uuid, uuid) to authenticated;
grant execute on function public.publish_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Forum posts
-- ---------------------------------------------------------------------------

-- Creates a post: a thread under the forum named after its title, with the first message.
create or replace function public.create_forum_post(
  p_forum uuid,
  p_title text,
  p_message uuid,
  p_content text,
  p_tags text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  forum public.channels;
  tid uuid;
  title text := left(btrim(coalesce(p_title, '')), 100);
  tags text[];
begin
  select * into forum from public.channels where id = p_forum;
  if forum.id is null or forum.type <> 'forum' or not public.can_view_channel(p_forum) then
    raise exception 'That forum isn''t available.';
  end if;
  if public.channel_permissions(p_forum) & 2 = 0 or public.member_pending(forum.server_id)
     or exists (select 1 from public.server_members where server_id = forum.server_id and user_id = auth.uid() and timeout_until > now()) then
    raise exception 'You don''t have permission to post here.';
  end if;
  if title = '' then
    raise exception 'Give your post a title.';
  end if;
  if char_length(btrim(coalesce(p_content, ''))) = 0 then
    raise exception 'Write something to start the post.';
  end if;
  -- Only tags the forum offers, at most five.
  select coalesce(array_agg(distinct t), '{}') into tags
  from unnest(coalesce(p_tags, '{}')) t
  where exists (select 1 from jsonb_array_elements(forum.available_tags) a where a ->> 'id' = t);
  if cardinality(tags) > 5 then
    raise exception 'A post can have up to five tags.';
  end if;

  insert into public.channels (server_id, type, parent_id, name, owner_id, applied_tags, position)
  values (forum.server_id, 'thread', forum.id, title, auth.uid(), tags, 0)
  returning id into tid;
  insert into public.messages (id, channel_id, author_id, content)
  values (p_message, tid, auth.uid(), p_content);
  return tid;
end;
$$;

revoke execute on function public.create_forum_post(uuid, text, uuid, text, text[]) from public, anon;
grant execute on function public.create_forum_post(uuid, text, uuid, text, text[]) to authenticated;

-- A forum's posts, newest activity first, with their first message.
create or replace function public.forum_posts(p_forum uuid)
returns table (
  id uuid,
  name text,
  owner_id uuid,
  created_at timestamptz,
  applied_tags text[],
  last_message_at timestamptz,
  message_count integer,
  first_message text
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.name, c.owner_id, c.created_at, c.applied_tags,
         coalesce(a.last_message_at, c.created_at), coalesce(a.message_count, 0)::integer,
         (select m.content from public.messages m where m.channel_id = c.id order by m.created_at limit 1)
  from public.channels c
  left join public.channel_activity a on a.channel_id = c.id
  where c.parent_id = p_forum and c.type = 'thread'
  order by coalesce(a.last_message_at, c.created_at) desc
  limit 200;
$$;

grant execute on function public.forum_posts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled events
-- ---------------------------------------------------------------------------

create table if not exists public.scheduled_events (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  -- Where: a voice channel in the server, or a place/link.
  channel_id uuid references public.channels (id) on delete set null,
  location text,
  name text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint scheduled_events_name check (char_length(btrim(name)) between 1 and 100),
  constraint scheduled_events_description check (description is null or char_length(description) <= 1000),
  constraint scheduled_events_location check (location is null or char_length(location) between 1 and 100),
  constraint scheduled_events_status check (status in ('scheduled', 'active', 'completed', 'canceled')),
  constraint scheduled_events_times check (ends_at is null or ends_at > starts_at)
);

create index if not exists scheduled_events_server_idx on public.scheduled_events (server_id, starts_at);

create or replace function public.scheduled_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.server_id := old.server_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  if new.channel_id is not null and not exists (
    select 1 from public.channels where id = new.channel_id and server_id = new.server_id and type = 'voice'
  ) then
    raise exception 'Pick a voice channel in this server.';
  end if;
  if new.channel_id is null and new.location is null then
    raise exception 'Say where the event happens.';
  end if;
  return new;
end;
$$;

drop trigger if exists scheduled_events_guard on public.scheduled_events;
create trigger scheduled_events_guard
  before insert or update on public.scheduled_events
  for each row execute function public.scheduled_events_guard();

alter table public.scheduled_events enable row level security;

drop policy if exists "members see events" on public.scheduled_events;
create policy "members see events"
  on public.scheduled_events for select to authenticated
  using (public.is_server_member(server_id));

drop policy if exists "event managers create events" on public.scheduled_events;
create policy "event managers create events"
  on public.scheduled_events for insert to authenticated
  with check (public.has_server_permission(server_id, 524288) and created_by = (select auth.uid()));

drop policy if exists "event managers and hosts edit events" on public.scheduled_events;
create policy "event managers and hosts edit events"
  on public.scheduled_events for update to authenticated
  using (public.has_server_permission(server_id, 524288) or created_by = (select auth.uid()))
  with check (public.has_server_permission(server_id, 524288) or created_by = (select auth.uid()));

drop policy if exists "event managers and hosts delete events" on public.scheduled_events;
create policy "event managers and hosts delete events"
  on public.scheduled_events for delete to authenticated
  using (public.has_server_permission(server_id, 524288) or created_by = (select auth.uid()));

create table if not exists public.event_interests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scheduled_events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_interests_unique unique (event_id, user_id)
);

alter table public.event_interests enable row level security;

drop policy if exists "members see interest" on public.event_interests;
create policy "members see interest"
  on public.event_interests for select to authenticated
  using (exists (select 1 from public.scheduled_events e where e.id = event_id and public.is_server_member(e.server_id)));

drop policy if exists "members mark interest" on public.event_interests;
create policy "members mark interest"
  on public.event_interests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.scheduled_events e where e.id = event_id and public.is_server_member(e.server_id))
  );

drop policy if exists "members unmark interest" on public.event_interests;
create policy "members unmark interest"
  on public.event_interests for delete to authenticated
  using (user_id = (select auth.uid()));

do $$
begin
  alter publication supabase_realtime add table public.scheduled_events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.event_interests;
exception when duplicate_object then null;
end $$;
