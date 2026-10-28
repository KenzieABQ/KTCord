-- Milestone 15: video and text in voice.
--   VIDEO 262144   (1 << 18)   share your camera or screen in voice channels
-- New servers' @everyone default = VIEW | SEND | CREATE_INVITE | ATTACH_FILES | ADD_REACTIONS | CONNECT | SPEAK | VIDEO = 324611
-- Existing servers get VIDEO on @everyone, as Discord's default includes it.

update public.roles set permissions = permissions | 262144 where is_default and permissions & 262144 = 0;

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
  values (sid, '@everyone', 0, 324611, true);

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

-- Overrides may also allow or deny VIDEO per channel.
-- VIEW 1 | SEND 2 | MANAGE_MESSAGES 4 | ATTACH 4096 | REACT 8192 | CONNECT 16384 | SPEAK 32768 | VIDEO 262144
create or replace function public.channel_overwrite_mask()
returns bigint
language sql
immutable
as $$ select 323591::bigint $$;

-- Voice channels have a text chat too (Discord's "text in voice").
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
  if ch.type not in ('text', 'thread', 'voice') then
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
