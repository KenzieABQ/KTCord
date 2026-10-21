-- M7: attachments (private storage), reactions, threads, pins and message search.

-- ---------------------------------------------------------------------------
-- Attachments
-- ---------------------------------------------------------------------------

-- attachments is a JSON array of { path, name, size, mime, kind, width?, height?, spoiler? }
-- where kind is image | video | file. These flags power "has:" search filters.
alter table public.messages
  add column has_image boolean generated always as (attachments @? '$[*] ? (@.kind == "image")') stored,
  add column has_video boolean generated always as (attachments @? '$[*] ? (@.kind == "video")') stored,
  add column has_file boolean generated always as (jsonb_array_length(attachments) > 0) stored;

-- Can post files here: can send, plus ATTACH_FILES (always allowed in DMs).
create or replace function public.can_attach(p_channel uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_send(p_channel, p_user)
    and public.channel_permissions(p_channel, p_user) & 4096 <> 0;
$$;

-- Private bucket; objects live at {channel_id}/{message_id}/{n}-{file name}.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

create policy "attachments: channel viewers can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_view_channel(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "attachments: senders can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.can_attach(public.try_uuid((storage.foldername(name))[1]))
  );

-- Validates attachments and keeps the idempotent insert from M3.
create or replace function public.send_message(
  p_id uuid,
  p_channel uuid,
  p_content text,
  p_reply_to uuid default null,
  p_attachments jsonb default '[]'::jsonb
)
returns setof public.messages
language plpgsql
set search_path = ''
as $$
declare
  files jsonb := coalesce(p_attachments, '[]'::jsonb);
begin
  if not public.can_send(p_channel) then
    if exists (
      select 1 from public.channels c
      join public.server_members sm on sm.server_id = c.server_id and sm.user_id = auth.uid()
      where c.id = p_channel and sm.timeout_until > now()
    ) then
      raise exception 'You''re timed out and can''t send messages right now.';
    end if;
    raise exception 'You don''t have permission to send messages in this channel.';
  end if;

  if jsonb_typeof(files) <> 'array' or jsonb_array_length(files) > 10 then
    raise exception 'You can attach up to 10 files.';
  end if;
  if jsonb_array_length(files) > 0 then
    if not public.can_attach(p_channel) then
      raise exception 'You don''t have permission to attach files here.';
    end if;
    if exists (
      select 1 from jsonb_array_elements(files) f
      where coalesce(f ->> 'path', '') not like p_channel::text || '/' || p_id::text || '/%'
         or coalesce(f ->> 'kind', '') not in ('image', 'video', 'file')
    ) then
      raise exception 'Those attachments don''t belong to this message.';
    end if;
  end if;

  insert into public.messages (id, channel_id, content, reply_to_id, attachments)
  values (p_id, p_channel, coalesce(p_content, ''), p_reply_to, files)
  on conflict (id) do nothing;

  return query select * from public.messages where id = p_id and author_id = auth.uid();
end;
$$;

-- System messages (pins, threads) keep their type; only normal messages become replies.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.created_at := now();
    new.author_id := auth.uid();
    new.pinned_at := null;
    new.pinned_by := null;
    new.edited_at := null;
    if new.type not in ('default', 'reply') then
      raise exception 'Clients can only send normal messages.';
    end if;
  end if;

  if new.reply_to_id is not null then
    if not exists (
      select 1 from public.messages where id = new.reply_to_id and channel_id = new.channel_id
    ) then
      new.reply_to_id := null;
      if new.type = 'reply' then
        new.type := 'default';
      end if;
    elsif new.type = 'default' then
      new.type := 'reply';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint reactions_unique unique (message_id, user_id, emoji),
  constraint reactions_emoji_length check (char_length(emoji) between 1 and 64)
);

create index reactions_message_idx on public.reactions (message_id);

-- Fills channel_id from the message and caps a message at 20 different emoji.
create or replace function public.reactions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select channel_id into new.channel_id from public.messages where id = new.message_id;
  if new.channel_id is null then
    raise exception 'That message no longer exists.';
  end if;
  if not exists (select 1 from public.reactions where message_id = new.message_id and emoji = new.emoji)
     and (select count(distinct emoji) from public.reactions where message_id = new.message_id) >= 20 then
    raise exception 'This message has the maximum number of different reactions.';
  end if;
  return new;
end;
$$;

create trigger reactions_before_insert
  before insert on public.reactions
  for each row execute function public.reactions_before_insert();

alter table public.reactions enable row level security;

create policy "viewers see reactions"
  on public.reactions for select to authenticated
  using (public.can_view_channel(channel_id));

-- Adding a new emoji needs ADD_REACTIONS; joining an existing one only needs to see the channel.
-- Timed-out members can't react.
-- Columns of the new row are qualified as reactions.* so the subqueries can't capture them.
create policy "members react"
  on public.reactions for insert to authenticated
  with check (
    reactions.user_id = (select auth.uid())
    and public.can_view_channel(reactions.channel_id)
    and not exists (
      select 1 from public.channels c
      join public.server_members sm on sm.server_id = c.server_id and sm.user_id = (select auth.uid())
      where c.id = reactions.channel_id and sm.timeout_until > now()
    )
    and (
      public.channel_permissions(reactions.channel_id) & 8192 <> 0
      or exists (
        select 1 from public.reactions r
        where r.message_id = reactions.message_id and r.emoji = reactions.emoji
      )
    )
  );

create policy "people remove their reactions; moderators clear any"
  on public.reactions for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.channel_permissions(channel_id) & 4 <> 0
  );

-- ---------------------------------------------------------------------------
-- Threads: channels of type 'thread' under a text channel, started from a message
-- ---------------------------------------------------------------------------

alter table public.channels
  add column source_message_id uuid unique references public.messages (id) on delete set null;

-- Threads take their permissions (and privacy) from the parent channel.
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
      when c.type = 'thread' then
        (select public.channel_row_permissions(p.server_id, p.id, p.is_private, p_user)
         from public.channels p where p.id = c.parent_id)
      else public.channel_row_permissions(c.server_id, c.id, c.is_private, p_user)
    end
    from public.channels c where c.id = p_channel
  ), 0);
$$;

drop policy "members see channels they can view" on public.channels;
create policy "members see channels they can view"
  on public.channels for select to authenticated
  using (
    server_id is not null
    and case
      when type = 'thread' then public.channel_permissions(parent_id)
      else public.channel_row_permissions(server_id, id, is_private)
    end & 1 <> 0
  );

-- The tree rules now allow threads under text channels.
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

  if new.type = 'text' then
    new.name := trim(both '-' from regexp_replace(lower(trim(new.name)), '[\s-]+', '-', 'g'));
  elsif new.name is not null then
    new.name := trim(new.name);
  end if;
  if new.type in ('text', 'voice', 'category', 'thread') and coalesce(new.name, '') = '' then
    raise exception 'Give the channel a name.';
  end if;

  if new.type = 'category' and new.parent_id is not null then
    raise exception 'Categories can''t be nested.';
  end if;
  if new.type = 'thread' then
    if not exists (
      select 1 from public.channels
      where id = new.parent_id and server_id = new.server_id and type = 'text'
    ) then
      raise exception 'Threads belong to a text channel.';
    end if;
  elsif new.parent_id is not null and not exists (
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

-- Deleting a text channel deletes its threads (parent_id would otherwise just go null).
create or replace function public.channels_delete_threads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.channels where parent_id = old.id and type = 'thread';
  return old;
end;
$$;

create trigger channels_delete_threads
  before delete on public.channels
  for each row when (old.type = 'text')
  execute function public.channels_delete_threads();

create policy "thread starters and channel managers delete threads"
  on public.channels for delete to authenticated
  using (
    type = 'thread'
    and (owner_id = (select auth.uid()) or public.has_server_permission(server_id, 16))
  );

-- Starts (or returns) the thread for a message. Anyone who can post in the channel can.
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
  if parent.type <> 'text' then
    raise exception 'Threads can only be started in text channels.';
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

-- ---------------------------------------------------------------------------
-- Pins
-- ---------------------------------------------------------------------------

-- Pin or unpin. Needs MANAGE_MESSAGES in servers; any recipient can pin in DMs. Max 50 per channel.
create or replace function public.pin_message(p_message uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg public.messages;
  ch public.channels;
begin
  select * into msg from public.messages where id = p_message;
  if not found then
    raise exception 'That message no longer exists.';
  end if;
  select * into ch from public.channels where id = msg.channel_id;
  if ch.server_id is null then
    if not public.is_channel_recipient(ch.id) then
      raise exception 'You can''t pin messages here.';
    end if;
  elsif public.channel_permissions(ch.id) & 4 = 0 then
    raise exception 'You need the Manage Messages permission to pin messages.';
  end if;

  if p_pinned then
    if msg.pinned_at is not null then
      return;
    end if;
    if (select count(*) from public.messages where channel_id = ch.id and pinned_at is not null) >= 50 then
      raise exception 'This channel has reached the limit of 50 pins.';
    end if;
    update public.messages set pinned_at = now(), pinned_by = auth.uid() where id = p_message;
    insert into public.messages (id, channel_id, author_id, type, reply_to_id, content)
    values (gen_random_uuid(), ch.id, auth.uid(), 'pin', p_message, '');
  else
    update public.messages set pinned_at = null, pinned_by = null where id = p_message;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------

-- Searches one channel, one server, or (both null) everything the user can see.
-- SECURITY INVOKER: RLS limits results to visible messages.
-- p_has: any of image, video, file, link. Returns { total, messages: [...] }.
create or replace function public.search_messages(
  p_server uuid default null,
  p_channel uuid default null,
  p_query text default null,
  p_author uuid default null,
  p_mentions uuid default null,
  p_has text[] default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with hits as (
    select m.*
    from public.messages m
    join public.channels c on c.id = m.channel_id
    where m.type in ('default', 'reply')
      and (p_channel is null or m.channel_id = p_channel)
      and (p_server is null or c.server_id = p_server)
      and (coalesce(trim(p_query), '') = '' or m.search @@ websearch_to_tsquery('simple', p_query))
      and (p_author is null or m.author_id = p_author)
      and (p_mentions is null or p_mentions = any (m.mentions))
      and (not ('image' = any (coalesce(p_has, '{}'))) or m.has_image)
      and (not ('video' = any (coalesce(p_has, '{}'))) or m.has_video)
      and (not ('file' = any (coalesce(p_has, '{}'))) or m.has_file)
      and (not ('link' = any (coalesce(p_has, '{}'))) or m.has_link)
  ),
  page as (
    select * from hits
    order by created_at desc, id desc
    limit least(greatest(coalesce(p_limit, 25), 1), 50)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from hits),
    'messages', coalesce(
      (select jsonb_agg(to_jsonb(page) - 'search' order by page.created_at desc, page.id desc) from page),
      '[]'::jsonb
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Unread state: threads count like channels (already included); nothing to change.
-- Grants, Realtime
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_thread(uuid, text)',
    'public.pin_message(uuid, boolean)',
    'public.search_messages(uuid, uuid, text, uuid, uuid, text[], integer, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

alter publication supabase_realtime add table public.reactions;
