-- Server banners: an image shown at the top of the channel list (and the welcome screen).
-- Stored in the server-icons bucket under the server's folder, like icons.
alter table public.servers add column if not exists banner_url text;
