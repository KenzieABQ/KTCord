-- M13: moderation tools like Discord's: an audit log, AutoMod rules, and voice moderation.
--
-- New permission bit (mirrored in src/lib/permissions.ts):
--   VIEW_AUDIT_LOG 131072   (1 << 17)

-- ---------------------------------------------------------------------------
-- Audit log: written by triggers, so every change is recorded however it was made.
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_id uuid,
  -- A snapshot of the target's name, so entries still read well after it's gone.
  target_name text,
  details jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_server_idx on public.audit_log (server_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit log readers see entries" on public.audit_log;
create policy "audit log readers see entries"
  on public.audit_log for select to authenticated
  using (public.has_server_permission(server_id, 131072));

/** Records one entry, unless there's no signed-in actor (seed scripts) or the server is going away. */
create or replace function public.audit(
  p_server uuid,
  p_action text,
  p_target uuid default null,
  p_target_name text default null,
  p_details jsonb default '{}'::jsonb,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_server is null then
    return;
  end if;
  if not exists (select 1 from public.servers where id = p_server) then
    return;
  end if;
  insert into public.audit_log (server_id, actor_id, action, target_id, target_name, details, reason)
  values (p_server, auth.uid(), p_action, p_target, p_target_name, coalesce(p_details, '{}'::jsonb), p_reason);
end;
$$;

revoke execute on function public.audit(uuid, text, uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function public.username_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select username from public.profiles where id = p_user $$;

-- Servers: name and icon.
create or replace function public.audit_servers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changes jsonb := '{}'::jsonb;
begin
  if new.name is distinct from old.name then
    changes := changes || jsonb_build_object('name', jsonb_build_array(old.name, new.name));
  end if;
  if new.icon_url is distinct from old.icon_url then
    changes := changes || jsonb_build_object('icon', jsonb_build_array(old.icon_url is not null, new.icon_url is not null));
  end if;
  if changes <> '{}'::jsonb then
    perform public.audit(new.id, 'server_update', new.id, new.name, changes);
  end if;
  return null;
end;
$$;

drop trigger if exists audit_servers on public.servers;
create trigger audit_servers after update on public.servers
  for each row execute function public.audit_servers();

-- Channels: create, meaningful edits (not reordering), delete. Threads are left out.
create or replace function public.audit_channels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changes jsonb := '{}'::jsonb;
  row_ public.channels;
begin
  row_ := coalesce(new, old);
  if row_.server_id is null or row_.type = 'thread' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.audit(new.server_id, 'channel_create', new.id, new.name, jsonb_build_object('type', new.type));
  elsif tg_op = 'DELETE' then
    perform public.audit(old.server_id, 'channel_delete', old.id, old.name, jsonb_build_object('type', old.type));
  else
    if new.name is distinct from old.name then
      changes := changes || jsonb_build_object('name', jsonb_build_array(old.name, new.name));
    end if;
    if new.topic is distinct from old.topic then
      changes := changes || jsonb_build_object('topic', jsonb_build_array(old.topic, new.topic));
    end if;
    if new.slowmode_seconds is distinct from old.slowmode_seconds then
      changes := changes || jsonb_build_object('slowmode', jsonb_build_array(old.slowmode_seconds, new.slowmode_seconds));
    end if;
    if new.is_private is distinct from old.is_private then
      changes := changes || jsonb_build_object('private', jsonb_build_array(old.is_private, new.is_private));
    end if;
    if changes <> '{}'::jsonb then
      perform public.audit(new.server_id, 'channel_update', new.id, new.name, changes);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_channels on public.channels;
create trigger audit_channels after insert or update or delete on public.channels
  for each row execute function public.audit_channels();

-- Channel permission overrides.
create or replace function public.audit_channel_overwrites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_ public.channel_overwrites;
  ch public.channels;
  who text;
begin
  row_ := coalesce(new, old);
  select * into ch from public.channels where id = row_.channel_id;
  if not found then
    return null;
  end if;
  who := coalesce(
    (select case when is_default then '@everyone' else name end from public.roles where id = row_.role_id),
    public.username_of(row_.user_id)
  );
  perform public.audit(
    ch.server_id,
    case tg_op when 'INSERT' then 'overwrite_create' when 'UPDATE' then 'overwrite_update' else 'overwrite_delete' end,
    ch.id,
    ch.name,
    jsonb_build_object(
      'for', who,
      'allow', case when tg_op = 'DELETE' then 0 else new.allow end,
      'deny', case when tg_op = 'DELETE' then 0 else new.deny end
    )
  );
  return null;
end;
$$;

drop trigger if exists audit_channel_overwrites on public.channel_overwrites;
create trigger audit_channel_overwrites after insert or update or delete on public.channel_overwrites
  for each row execute function public.audit_channel_overwrites();

-- Roles: create, edits (not reordering), delete.
create or replace function public.audit_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    if not new.is_default then
      perform public.audit(new.server_id, 'role_create', new.id, new.name);
    end if;
  elsif tg_op = 'DELETE' then
    perform public.audit(old.server_id, 'role_delete', old.id, old.name);
  else
    if new.name is distinct from old.name then
      changes := changes || jsonb_build_object('name', jsonb_build_array(old.name, new.name));
    end if;
    if new.color is distinct from old.color then
      changes := changes || jsonb_build_object('color', jsonb_build_array(old.color, new.color));
    end if;
    if new.permissions is distinct from old.permissions then
      changes := changes || jsonb_build_object('permissions', jsonb_build_array(old.permissions, new.permissions));
    end if;
    if new.hoist is distinct from old.hoist then
      changes := changes || jsonb_build_object('hoist', jsonb_build_array(old.hoist, new.hoist));
    end if;
    if new.mentionable is distinct from old.mentionable then
      changes := changes || jsonb_build_object('mentionable', jsonb_build_array(old.mentionable, new.mentionable));
    end if;
    if changes <> '{}'::jsonb then
      perform public.audit(new.server_id, 'role_update', new.id, case when new.is_default then '@everyone' else new.name end, changes);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_roles on public.roles;
create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function public.audit_roles();

-- Giving or taking a role.
create or replace function public.audit_member_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_ public.member_roles;
  r public.roles;
begin
  row_ := coalesce(new, old);
  select * into r from public.roles where id = row_.role_id;
  if not found or r.is_default then
    return null;
  end if;
  perform public.audit(
    r.server_id,
    'member_role_update',
    row_.user_id,
    public.username_of(row_.user_id),
    jsonb_build_object(case when tg_op = 'INSERT' then 'added' else 'removed' end, r.name)
  );
  return null;
end;
$$;

drop trigger if exists audit_member_roles on public.member_roles;
create trigger audit_member_roles after insert or delete on public.member_roles
  for each row execute function public.audit_member_roles();

-- Members: kicks (not people leaving, and not the removal that's part of a ban), timeouts
-- and nickname changes made by someone else.
create or replace function public.audit_server_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if auth.uid() is distinct from old.user_id
       and not exists (
         select 1 from public.bans b
         where b.server_id = old.server_id and b.user_id = old.user_id and b.created_at = now()
       ) then
      perform public.audit(old.server_id, 'member_kick', old.user_id, public.username_of(old.user_id));
    end if;
    return null;
  end if;
  if new.timeout_until is distinct from old.timeout_until then
    perform public.audit(
      new.server_id,
      case when new.timeout_until is null then 'member_timeout_remove' else 'member_timeout' end,
      new.user_id,
      public.username_of(new.user_id),
      jsonb_build_object('until', new.timeout_until)
    );
  end if;
  if new.nickname is distinct from old.nickname and auth.uid() is distinct from new.user_id then
    perform public.audit(
      new.server_id, 'member_update', new.user_id, public.username_of(new.user_id),
      jsonb_build_object('nickname', jsonb_build_array(old.nickname, new.nickname))
    );
  end if;
  return null;
end;
$$;

drop trigger if exists audit_server_members on public.server_members;
create trigger audit_server_members after update or delete on public.server_members
  for each row execute function public.audit_server_members();

create or replace function public.audit_bans()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.audit(old.server_id, 'member_unban', old.user_id, public.username_of(old.user_id));
  else
    perform public.audit(new.server_id, 'member_ban', new.user_id, public.username_of(new.user_id), '{}'::jsonb, new.reason);
  end if;
  return null;
end;
$$;

drop trigger if exists audit_bans on public.bans;
create trigger audit_bans after insert or update or delete on public.bans
  for each row execute function public.audit_bans();

create or replace function public.audit_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit(
      new.server_id, 'invite_create', null, new.code,
      jsonb_build_object('max_uses', new.max_uses, 'expires_at', new.expires_at)
    );
  else
    perform public.audit(old.server_id, 'invite_delete', null, old.code);
  end if;
  return null;
end;
$$;

drop trigger if exists audit_invites on public.invites;
create trigger audit_invites after insert or delete on public.invites
  for each row execute function public.audit_invites();

create or replace function public.audit_server_emojis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit(new.server_id, 'emoji_create', new.id, new.name);
  elsif tg_op = 'DELETE' then
    perform public.audit(old.server_id, 'emoji_delete', old.id, old.name);
  elsif new.name is distinct from old.name then
    perform public.audit(new.server_id, 'emoji_update', new.id, new.name, jsonb_build_object('name', jsonb_build_array(old.name, new.name)));
  end if;
  return null;
end;
$$;

drop trigger if exists audit_server_emojis on public.server_emojis;
create trigger audit_server_emojis after insert or update or delete on public.server_emojis
  for each row execute function public.audit_server_emojis();

-- Someone else's message deleted by a moderator (bans that clean up messages included).
create or replace function public.audit_message_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.channels;
begin
  if old.author_id is null or auth.uid() is not distinct from old.author_id then
    return null;
  end if;
  select * into ch from public.channels where id = old.channel_id;
  if not found or ch.server_id is null then
    return null;
  end if;
  -- A ban that cleans up messages is already one "ban" entry; don't log each message.
  if exists (
    select 1 from public.bans b
    where b.server_id = ch.server_id and b.user_id = old.author_id and b.created_at = now()
  ) then
    return null;
  end if;
  perform public.audit(
    ch.server_id, 'message_delete', old.author_id, public.username_of(old.author_id),
    jsonb_build_object('channel', ch.name, 'channel_id', ch.id)
  );
  return null;
end;
$$;

drop trigger if exists audit_message_delete on public.messages;
create trigger audit_message_delete after delete on public.messages
  for each row execute function public.audit_message_delete();

-- ---------------------------------------------------------------------------
-- AutoMod: keyword and mention-spam rules, checked whenever a message is sent or edited.
-- People with Manage Server (and administrators) are exempt, as in Discord.
-- ---------------------------------------------------------------------------

create table if not exists public.automod_rules (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  name text not null,
  kind text not null,
  enabled boolean not null default true,
  -- keyword rules: words to block (cat, cat*, *cat, *cat*) and words to always allow.
  keywords text[] not null default '{}',
  allow_list text[] not null default '{}',
  -- mention spam rules: the most distinct user/role mentions allowed in one message.
  mention_limit integer,
  exempt_role_ids uuid[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint automod_rules_name_length check (char_length(trim(name)) between 1 and 100),
  constraint automod_rules_kind check (kind in ('keyword', 'mention_spam')),
  constraint automod_rules_keywords_size check (cardinality(keywords) <= 1000 and cardinality(allow_list) <= 100),
  constraint automod_rules_mention_limit check (mention_limit is null or mention_limit between 1 and 50),
  constraint automod_rules_shape check (
    (kind = 'keyword' and cardinality(keywords) > 0) or (kind = 'mention_spam' and mention_limit is not null)
  )
);

create index if not exists automod_rules_server_idx on public.automod_rules (server_id);

alter table public.automod_rules enable row level security;

drop policy if exists "server managers see automod rules" on public.automod_rules;
create policy "server managers see automod rules"
  on public.automod_rules for select to authenticated
  using (public.has_server_permission(server_id, 64));

drop policy if exists "server managers add automod rules" on public.automod_rules;
create policy "server managers add automod rules"
  on public.automod_rules for insert to authenticated
  with check (public.has_server_permission(server_id, 64) and created_by = (select auth.uid()));

drop policy if exists "server managers edit automod rules" on public.automod_rules;
create policy "server managers edit automod rules"
  on public.automod_rules for update to authenticated
  using (public.has_server_permission(server_id, 64))
  with check (public.has_server_permission(server_id, 64));

drop policy if exists "server managers remove automod rules" on public.automod_rules;
create policy "server managers remove automod rules"
  on public.automod_rules for delete to authenticated
  using (public.has_server_permission(server_id, 64));

create or replace function public.audit_automod_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.audit(
    coalesce(new.server_id, old.server_id),
    case tg_op when 'INSERT' then 'automod_rule_create' when 'UPDATE' then 'automod_rule_update' else 'automod_rule_delete' end,
    coalesce(new.id, old.id),
    coalesce(new.name, old.name)
  );
  return null;
end;
$$;

drop trigger if exists audit_automod_rules on public.automod_rules;
create trigger audit_automod_rules after insert or update or delete on public.automod_rules
  for each row execute function public.audit_automod_rules();

/**
 * The first blocked keyword found in `p_content`, or null. Keywords follow Discord's rules:
 * "cat" matches the whole word, "cat*" words starting with it, "*cat" words ending with it,
 * "*cat*" anywhere. Matching ignores case; allow-listed words are removed first.
 */
create or replace function public.automod_keyword_match(p_content text, p_keywords text[], p_allow text[])
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  content text := lower(coalesce(p_content, ''));
  kw text;
  core text;
  pattern text;
  allowed text;
begin
  foreach allowed in array coalesce(p_allow, '{}') loop
    allowed := lower(trim(allowed));
    continue when allowed = '';
    content := regexp_replace(content, '\m' || regexp_replace(allowed, '([.^$|()\[\]{}*+?\\])', '\\\1', 'g') || '\M', ' ', 'g');
  end loop;
  foreach kw in array coalesce(p_keywords, '{}') loop
    kw := lower(trim(kw));
    core := trim(both '*' from kw);
    continue when core = '';
    pattern := regexp_replace(core, '([.^$|()\[\]{}*+?\\])', '\\\1', 'g');
    if left(kw, 1) <> '*' then
      pattern := '\m' || pattern;
    end if;
    if right(kw, 1) <> '*' then
      pattern := pattern || '\M';
    end if;
    if content ~ pattern then
      return core;
    end if;
  end loop;
  return null;
end;
$$;

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
begin
  if new.type not in ('default', 'reply') or coalesce(new.content, '') = '' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then
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
      hit := public.automod_keyword_match(new.content, rule.keywords, rule.allow_list);
      if hit is not null then
        raise exception 'Your message was blocked by AutoMod (%).', rule.name
          using errcode = 'P0001', hint = 'automod';
      end if;
    elsif rule.kind = 'mention_spam' then
      select count(distinct m[1]) into mentions
      from regexp_matches(new.content, '<@[!&]?([0-9a-fA-F-]{36})>', 'g') as m;
      if mentions > rule.mention_limit then
        raise exception 'Your message was blocked by AutoMod (%): too many mentions.', rule.name
          using errcode = 'P0001', hint = 'automod';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists messages_automod on public.messages;
create trigger messages_automod before insert or update of content on public.messages
  for each row execute function public.messages_automod();

-- ---------------------------------------------------------------------------
-- Voice moderation: server mute and server deafen (they stick until a moderator lifts them),
-- and disconnecting someone. MODERATE_MEMBERS (2048) with the usual role hierarchy.
-- ---------------------------------------------------------------------------

create table if not exists public.voice_moderation (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  server_mute boolean not null default false,
  server_deaf boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint voice_moderation_unique unique (server_id, user_id)
);

alter table public.voice_moderation enable row level security;

drop policy if exists "members see voice moderation" on public.voice_moderation;
create policy "members see voice moderation"
  on public.voice_moderation for select to authenticated
  using (public.is_server_member(server_id));

create or replace function public.set_voice_moderation(p_server uuid, p_user uuid, p_mute boolean, p_deaf boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before public.voice_moderation;
begin
  perform public.require_permission(p_server, 2048, 'moderate voice');
  perform public.require_moderatable(p_server, p_user);
  select * into before from public.voice_moderation where server_id = p_server and user_id = p_user;
  insert into public.voice_moderation (server_id, user_id, server_mute, server_deaf, updated_by, updated_at)
  values (p_server, p_user, coalesce(p_mute, false), coalesce(p_deaf, false), auth.uid(), now())
  on conflict (server_id, user_id)
  do update set server_mute = excluded.server_mute, server_deaf = excluded.server_deaf,
                updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform public.audit(
    p_server, 'member_voice_update', p_user, public.username_of(p_user),
    jsonb_build_object(
      'mute', jsonb_build_array(coalesce(before.server_mute, false), coalesce(p_mute, false)),
      'deaf', jsonb_build_array(coalesce(before.server_deaf, false), coalesce(p_deaf, false))
    )
  );
end;
$$;

-- Called by /api/voice/moderate before it disconnects someone from voice: checks and records.
create or replace function public.voice_disconnect_member(p_server uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_permission(p_server, 2048, 'moderate voice');
  perform public.require_moderatable(p_server, p_user);
  perform public.audit(p_server, 'member_disconnect', p_user, public.username_of(p_user));
end;
$$;

/**
 * Whether the caller may pull someone out of this server's voice rooms because they lost
 * access: the caller can kick, ban or time out, and the person isn't a member any more or is
 * timed out. Used by /api/voice/moderate after a kick, ban or timeout.
 */
create or replace function public.voice_removal_allowed(p_server uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.server_permissions(p_server) & (128 | 256 | 2048) <> 0
    and (
      not public.is_server_member(p_server, p_user)
      or exists (
        select 1 from public.server_members
        where server_id = p_server and user_id = p_user and timeout_until > now()
      )
    );
$$;

revoke execute on function public.set_voice_moderation(uuid, uuid, boolean, boolean) from public, anon;
revoke execute on function public.voice_disconnect_member(uuid, uuid) from public, anon;
revoke execute on function public.voice_removal_allowed(uuid, uuid) from public, anon;
grant execute on function public.set_voice_moderation(uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.voice_disconnect_member(uuid, uuid) to authenticated;
grant execute on function public.voice_removal_allowed(uuid, uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.voice_moderation;
exception when duplicate_object then null;
end;
$$;
