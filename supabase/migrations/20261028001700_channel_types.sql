-- Milestone 16: announcement and forum channels. Enum values get their own migration
-- because Postgres won't use a new value in the transaction that adds it.
alter type public.channel_type add value if not exists 'announcement';
alter type public.channel_type add value if not exists 'forum';
