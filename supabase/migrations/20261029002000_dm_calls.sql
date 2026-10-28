-- Calls in DMs and group DMs: any member of the conversation can join its call. Server
-- voice channels keep their rules (CONNECT, not timed out, rules accepted).
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
  if not found then
    return false;
  end if;
  if ch.type in ('dm', 'group_dm') then
    return public.is_channel_recipient(p_channel, p_user);
  end if;
  if ch.type <> 'voice' or ch.server_id is null then
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
