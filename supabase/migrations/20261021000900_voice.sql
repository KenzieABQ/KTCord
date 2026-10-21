-- M9: voice channels.
--
-- Who is connected to a voice channel lives in Realtime Presence on the private topic
-- "voice:<channel uuid>". Presence drops on its own when a tab disconnects, so there are no
-- stale rows to clean up. These policies decide who may watch a topic and who may appear in it.

-- Joining voice: a server voice channel, CONNECT (1 << 14) there, and not timed out.
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
  return not exists (
    select 1 from public.server_members
    where server_id = ch.server_id and user_id = p_user and timeout_until > now()
  );
end;
$$;

revoke execute on function public.can_join_voice(uuid, uuid) from public, anon;
grant execute on function public.can_join_voice(uuid, uuid) to authenticated, service_role;

-- Anyone who can see a voice channel sees who is in it.
create policy "channel viewers watch voice topics"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'voice:%'
    and public.can_view_channel(public.try_uuid(substr(realtime.topic(), 7)))
  );

-- Only people allowed to connect may announce themselves (presence only, no broadcasts).
create policy "voice members announce on voice topics"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'voice:%'
    and realtime.messages.extension = 'presence'
    and public.can_join_voice(public.try_uuid(substr(realtime.topic(), 7)))
  );
