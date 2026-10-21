-- M9: speaking indicators travel as Broadcast events on the voice topic rather than as
-- presence updates. Presence suits join/leave/mute; speaking flips several times a second,
-- and frequent presence updates made people drop out of others' rosters.

drop policy if exists "voice members announce on voice topics" on realtime.messages;

-- People allowed to connect may announce themselves (presence) and send speaking events (broadcast).
create policy "voice members announce on voice topics"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'voice:%'
    and realtime.messages.extension in ('presence', 'broadcast')
    and public.can_join_voice(public.try_uuid(substr(realtime.topic(), 7)))
  );
