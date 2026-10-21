-- Reconciles databases that ran an early copy of 20261020000200_servers.sql.
-- That copy checked channel visibility by re-reading the channel by id, which fails RLS for
-- INSERT/UPDATE ... RETURNING on channels (the new row isn't visible to the lookup yet).
-- Idempotent: on databases that already have the fix, this changes nothing.

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

drop policy if exists "members see channels they can view" on public.channels;
create policy "members see channels they can view"
  on public.channels for select to authenticated
  using (
    server_id is not null
    and public.channel_row_permissions(server_id, id, is_private) & 1 <> 0
  );
