-- channels.position is filled by channels_guard() on insert. Giving it a default makes that
-- explicit to clients (and to generated types): -1 means "put it at the end".

alter table public.channels alter column position set default -1;

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

  if tg_op = 'INSERT' and (new.position is null or new.position < 0) then
    select coalesce(max(position), -1) + 1 into new.position
    from public.channels where server_id = new.server_id;
  end if;
  return new;
end;
$$;
