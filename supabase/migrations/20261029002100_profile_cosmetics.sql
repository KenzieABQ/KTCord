-- Profile cosmetics, all optional, in one column:
--   name_font, name_effect, name_colors (1-2 hex colors): the display name style
--   decoration: an animated frame around the avatar
--   effect: an animation over the profile card
--   nameplate: a background behind the name in the member list
alter table public.profiles add column if not exists cosmetics jsonb not null default '{}'::jsonb;

create or replace function public.valid_cosmetics(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(c) = 'object'
    and pg_column_size(c) < 1024
    and coalesce(c ->> 'name_font', 'default') in ('default', 'rounded', 'serif', 'pixel', 'script', 'toon', 'tech', 'retro')
    and coalesce(c ->> 'name_effect', 'solid') in ('solid', 'gradient', 'neon', 'toon', 'pop', 'shimmer')
    and coalesce(c ->> 'decoration', 'none') in ('none', 'neon', 'fire', 'sparkles', 'halo', 'cat_ears', 'rainbow', 'orbit', 'hearts')
    and coalesce(c ->> 'effect', 'none') in ('none', 'snow', 'stars', 'hearts', 'aurora', 'sakura', 'bubbles')
    and coalesce(c ->> 'nameplate', 'none') in ('none', 'aurora', 'sunset', 'ocean', 'galaxy', 'forest', 'candy')
    and (
      c -> 'name_colors' is null
      or (
        jsonb_typeof(c -> 'name_colors') = 'array'
        and jsonb_array_length(c -> 'name_colors') <= 2
        and not exists (
          select 1 from jsonb_array_elements_text(c -> 'name_colors') v where v !~ '^#[0-9a-fA-F]{6}$'
        )
      )
    );
$$;

alter table public.profiles drop constraint if exists profiles_cosmetics_valid;
alter table public.profiles add constraint profiles_cosmetics_valid check (public.valid_cosmetics(cosmetics));
