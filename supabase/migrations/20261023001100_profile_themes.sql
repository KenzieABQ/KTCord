-- M10: Discord-style profile customization: pronouns, a banner image, and a two-color
-- profile theme (the card is a gradient from the primary to the accent color).

alter table public.profiles
  add column if not exists pronouns text,
  add column if not exists banner_url text,
  add column if not exists theme_primary text,
  add column if not exists theme_accent text;

alter table public.profiles
  drop constraint if exists profiles_pronouns_length,
  drop constraint if exists profiles_theme_primary_format,
  drop constraint if exists profiles_theme_accent_format,
  drop constraint if exists profiles_banner_url_own_folder;

alter table public.profiles
  add constraint profiles_pronouns_length
    check (pronouns is null or char_length(pronouns) between 1 and 40),
  add constraint profiles_theme_primary_format
    check (theme_primary is null or theme_primary ~ '^#[0-9a-fA-F]{6}$'),
  add constraint profiles_theme_accent_format
    check (theme_accent is null or theme_accent ~ '^#[0-9a-fA-F]{6}$'),
  -- Banners live in the user's own folder of the public avatars bucket, so a profile can't
  -- point everyone's browser at an arbitrary third-party URL.
  add constraint profiles_banner_url_own_folder
    check (banner_url is null or banner_url like '%/storage/v1/object/public/avatars/' || id::text || '/%');
