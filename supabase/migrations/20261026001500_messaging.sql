-- Milestone 14: messaging extras.
--   * Mark Unread: move your read marker back to just before a message.
--   * Reply pings: a reply mentions the person replied to, unless the sender turns it off.
--   * Forwarding: a message can carry a snapshot of another message (built by the database
--     from the original, which the forwarder must be able to see).
--   * Polls: a question with 2-10 answers on a message, single or multiple choice, ending
--     after a set time; votes are kept in poll_votes and cast through vote_poll().

-- ---------------------------------------------------------------------------
-- Mark Unread
-- ---------------------------------------------------------------------------

create or replace function public.mark_unread(p_channel uuid, p_message uuid)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  read_at timestamptz;
begin
  select created_at - interval '1 microsecond' into read_at
  from public.messages where id = p_message and channel_id = p_channel;
  if read_at is null then
    raise exception 'That message isn''t in this channel.';
  end if;

  insert into public.read_states (user_id, channel_id, last_read_message_id, last_read_at)
  values (auth.uid(), p_channel, null, read_at)
  on conflict (user_id, channel_id) do update
    set last_read_message_id = null, last_read_at = excluded.last_read_at;
  return read_at;
end;
$$;

revoke execute on function public.mark_unread(uuid, uuid) from public, anon;
grant execute on function public.mark_unread(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- New message columns
-- ---------------------------------------------------------------------------

alter table public.messages add column if not exists reply_ping boolean not null default true;
-- {message_id, channel_id, author_id, content, created_at} of the original message.
alter table public.messages add column if not exists forwarded jsonb;
-- {question, answers: [{id, text, emoji}], multiselect, expires_at}.
alter table public.messages add column if not exists poll jsonb;

alter table public.messages drop constraint if exists messages_not_empty;
alter table public.messages add constraint messages_not_empty
  check (
    type not in ('default', 'reply')
    or char_length(btrim(content)) > 0
    or jsonb_array_length(attachments) > 0
    or forwarded is not null
    or poll is not null
  );

-- Builds forward snapshots and normalizes polls on insert; keeps both (and reply_ping)
-- unchanged on edits. Named to run before the other insert triggers (AutoMod reads both).
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
begin
  if tg_op = 'UPDATE' then
    new.forwarded := old.forwarded;
    new.reply_ping := old.reply_ping;
    -- Ending a poll early goes through end_poll() (security definer).
    if current_user = 'authenticated' then
      new.poll := old.poll;
    end if;
    return new;
  end if;

  if new.forwarded is not null then
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

drop trigger if exists messages_a_forward_poll on public.messages;
create trigger messages_a_forward_poll
  before insert or update on public.messages
  for each row execute function public.messages_a_forward_poll();

-- ---------------------------------------------------------------------------
-- Reply pings: same as before, plus the replied-to author when reply_ping is on.
-- ---------------------------------------------------------------------------

create or replace function public.messages_extract_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch record;
  perms bigint;
  replied uuid;
begin
  select id, server_id into ch from public.channels where id = new.channel_id;
  perms := case when ch.server_id is null then 0
                else public.channel_permissions(new.channel_id, new.author_id) end;

  select coalesce(array_agg(distinct p.id), '{}') into new.mentions
  from regexp_matches(new.content, '<@([0-9a-fA-F-]{36})>', 'g') as m(g)
  join public.profiles p on p.id = public.try_uuid(m.g[1]);

  if new.reply_to_id is not null and new.reply_ping then
    select author_id into replied from public.messages where id = new.reply_to_id;
    if replied is not null and replied is distinct from new.author_id and not replied = any (new.mentions) then
      new.mentions := new.mentions || replied;
    end if;
  end if;

  if ch.server_id is null then
    new.mention_roles := '{}';
  else
    select coalesce(array_agg(distinct r.id), '{}') into new.mention_roles
    from regexp_matches(new.content, '<@&([0-9a-fA-F-]{36})>', 'g') as m(g)
    join public.roles r on r.id = public.try_uuid(m.g[1])
    where r.server_id = ch.server_id
      and not r.is_default
      and (r.mentionable or perms & 8 <> 0); -- MENTION_EVERYONE can ping any role
  end if;

  new.mention_everyone := ch.server_id is not null
    and perms & 8 <> 0
    and new.content ~ '(^|[^\w`])@(everyone|here)\M';
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- AutoMod also reads forwarded text and poll text.
-- ---------------------------------------------------------------------------

create or replace function public.messages_automod()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  srv uuid;
  rule public.automod_rules;
  mentions integer;
  hit text;
  body text;
begin
  if new.type not in ('default', 'reply') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then
    return new;
  end if;
  body := concat_ws(
    E'\n',
    nullif(new.content, ''),
    new.forwarded ->> 'content',
    new.poll ->> 'question',
    (select string_agg(a ->> 'text', E'\n') from jsonb_array_elements(coalesce(new.poll -> 'answers', '[]')) a)
  );
  if coalesce(body, '') = '' then
    return new;
  end if;
  select server_id into srv from public.channels where id = new.channel_id;
  if srv is null then
    return new;
  end if;
  if public.server_permissions(srv, new.author_id) & 64 <> 0 then -- MANAGE_SERVER (and admins)
    return new;
  end if;

  for rule in
    select * from public.automod_rules where server_id = srv and enabled order by created_at
  loop
    continue when exists (
      select 1 from public.member_roles mr
      where mr.user_id = new.author_id and mr.role_id = any (rule.exempt_role_ids)
    );
    if rule.kind = 'keyword' then
      hit := public.automod_keyword_match(body, rule.keywords, rule.allow_list);
      if hit is not null then
        raise exception 'Your message was blocked by AutoMod (%).', rule.name
          using errcode = 'P0001', hint = 'automod';
      end if;
    elsif rule.kind = 'mention_spam' then
      select count(distinct m[1]) into mentions
      from regexp_matches(coalesce(new.content, ''), '<@[!&]?([0-9a-fA-F-]{36})>', 'g') as m;
      if mentions > rule.mention_limit then
        raise exception 'Your message was blocked by AutoMod (%): too many mentions.', rule.name
          using errcode = 'P0001', hint = 'automod';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- send_message: reply ping, forwards and polls.
-- ---------------------------------------------------------------------------

drop function if exists public.send_message(uuid, uuid, text, uuid, jsonb);

create or replace function public.send_message(
  p_id uuid,
  p_channel uuid,
  p_content text,
  p_reply_to uuid default null,
  p_attachments jsonb default '[]'::jsonb,
  p_reply_ping boolean default true,
  p_forward uuid default null,
  p_poll jsonb default null
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

  insert into public.messages (id, channel_id, content, reply_to_id, attachments, reply_ping, forwarded, poll)
  values (
    p_id, p_channel, coalesce(p_content, ''), p_reply_to, files, coalesce(p_reply_ping, true),
    case when p_forward is null then null else jsonb_build_object('message_id', p_forward) end,
    p_poll
  )
  on conflict (id) do nothing;

  return query select * from public.messages where id = p_id and author_id = auth.uid();
end;
$$;

revoke execute on function public.send_message(uuid, uuid, text, uuid, jsonb, boolean, uuid, jsonb) from public, anon;
grant execute on function public.send_message(uuid, uuid, text, uuid, jsonb, boolean, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Poll votes
-- ---------------------------------------------------------------------------

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  answer_id smallint not null,
  created_at timestamptz not null default now(),
  constraint poll_votes_unique unique (message_id, user_id, answer_id)
);

create index if not exists poll_votes_message_idx on public.poll_votes (message_id);

alter table public.poll_votes enable row level security;

-- Votes are public to everyone who can see the poll, as in Discord. Writes go through vote_poll().
drop policy if exists "poll viewers see votes" on public.poll_votes;
create policy "poll viewers see votes"
  on public.poll_votes for select to authenticated
  using (
    exists (select 1 from public.messages m where m.id = message_id and public.can_view_channel(m.channel_id))
  );

do $$
begin
  alter publication supabase_realtime add table public.poll_votes;
exception when duplicate_object then null;
end $$;

-- Replaces your votes on a poll; an empty list removes them.
create or replace function public.vote_poll(p_message uuid, p_answers smallint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
  picks smallint[] := coalesce(p_answers, '{}');
begin
  select * into m from public.messages where id = p_message;
  if m.id is null or m.poll is null or not public.can_view_channel(m.channel_id) then
    raise exception 'That poll isn''t available.';
  end if;
  if (m.poll ->> 'expires_at')::timestamptz <= now() then
    raise exception 'This poll has ended.';
  end if;
  if (select count(distinct a) from unnest(picks) a) > 1 and not (m.poll ->> 'multiselect')::boolean then
    raise exception 'You can only pick one answer in this poll.';
  end if;
  if exists (select 1 from unnest(picks) a where a < 1 or a > jsonb_array_length(m.poll -> 'answers')) then
    raise exception 'That answer isn''t in this poll.';
  end if;

  delete from public.poll_votes where message_id = p_message and user_id = auth.uid();
  insert into public.poll_votes (message_id, user_id, answer_id)
  select p_message, auth.uid(), a from (select distinct unnest(picks) as a) s;
end;
$$;

-- Ends a poll now: its author, or someone who can manage messages there.
create or replace function public.end_poll(p_message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
begin
  select * into m from public.messages where id = p_message;
  if m.id is null or m.poll is null or not public.can_view_channel(m.channel_id) then
    raise exception 'That poll isn''t available.';
  end if;
  if m.author_id is distinct from auth.uid() and public.channel_permissions(m.channel_id, auth.uid()) & 4 = 0 then
    raise exception 'Only the poll''s author can end it.';
  end if;
  if (m.poll ->> 'expires_at')::timestamptz > now() then
    update public.messages set poll = jsonb_set(poll, '{expires_at}', to_jsonb(now())) where id = p_message;
  end if;
end;
$$;

revoke execute on function public.vote_poll(uuid, smallint[]) from public, anon;
revoke execute on function public.end_poll(uuid) from public, anon;
grant execute on function public.vote_poll(uuid, smallint[]) to authenticated;
grant execute on function public.end_poll(uuid) to authenticated;
