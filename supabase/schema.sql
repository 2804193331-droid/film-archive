create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  name text not null,
  iso integer not null,
  type text not null,
  formats text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (brand, name, iso)
);

create table if not exists public.cameras (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  type text not null check (type in ('135胶片机', '120胶片机', '数码相机')),
  created_at timestamptz not null default now(),
  unique (brand, model)
);

create table if not exists public.lenses (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  mount text not null,
  model text not null,
  focal_length text,
  created_at timestamptz not null default now(),
  unique (brand, mount, model)
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_path text,
  location text,
  date text,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_path text,
  location text,
  date text,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  original_path text not null,
  preview_path text not null,
  thumbnail_path text not null,
  original_url text,
  preview_url text,
  thumbnail_url text,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz not null default now(),
  width integer,
  height integer,
  camera_id uuid references public.cameras(id) on delete set null,
  lens_id uuid references public.lenses(id) on delete set null,
  film_id uuid references public.films(id) on delete set null,
  camera text,
  camera_type text check (camera_type in ('135', '120', 'digital')),
  lens text,
  film text,
  film_brand text,
  iso integer,
  aperture text,
  shutter_speed text,
  focal_length text,
  taken_at timestamptz,
  location text,
  scanner text,
  notes text,
  album_id uuid references public.albums(id) on delete set null,
  series_id uuid references public.series(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.series_photos (
  series_id uuid not null references public.series(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (series_id, photo_id)
);

drop table if exists public.photo_likes;
drop table if exists public.photo_favorites;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.albums add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.albums add column if not exists title text not null default 'Film Archive';
alter table public.albums add column if not exists description text not null default '';
alter table public.albums add column if not exists cover_path text;
alter table public.albums add column if not exists location text;
alter table public.albums add column if not exists date text;
alter table public.albums add column if not exists visibility text not null default 'public';
alter table public.albums add column if not exists created_at timestamptz not null default now();
alter table public.albums add column if not exists updated_at timestamptz not null default now();
alter table public.series add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
alter table public.series add column if not exists title text not null default 'Film Archive';
alter table public.series add column if not exists description text not null default '';
alter table public.series add column if not exists cover_path text;
alter table public.series add column if not exists location text;
alter table public.series add column if not exists date text;
alter table public.series add column if not exists visibility text not null default 'public';
alter table public.series add column if not exists created_at timestamptz not null default now();
alter table public.series add column if not exists updated_at timestamptz not null default now();
alter table public.photos add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.photos add column if not exists title text not null default 'Untitled';
alter table public.photos add column if not exists description text;
alter table public.photos add column if not exists original_path text;
alter table public.photos add column if not exists preview_path text;
alter table public.photos add column if not exists thumbnail_path text;
alter table public.photos drop column if exists like_count;
alter table public.photos drop column if exists favorite_count;
alter table public.photos add column if not exists album_id uuid references public.albums(id) on delete set null;
alter table public.photos add column if not exists series_id uuid references public.series(id) on delete set null;
alter table public.photos add column if not exists original_url text;
alter table public.photos add column if not exists preview_url text;
alter table public.photos add column if not exists thumbnail_url text;
alter table public.photos add column if not exists file_size bigint;
alter table public.photos add column if not exists mime_type text;
alter table public.photos add column if not exists uploaded_at timestamptz not null default now();
alter table public.photos add column if not exists width integer;
alter table public.photos add column if not exists height integer;
alter table public.photos add column if not exists camera text;
alter table public.photos add column if not exists camera_type text;
alter table public.photos add column if not exists lens text;
alter table public.photos add column if not exists film text;
alter table public.photos add column if not exists film_brand text;
alter table public.photos add column if not exists iso integer;
alter table public.photos add column if not exists aperture text;
alter table public.photos add column if not exists shutter_speed text;
alter table public.photos add column if not exists focal_length text;
alter table public.photos add column if not exists taken_at timestamptz;
alter table public.photos add column if not exists location text;
alter table public.photos add column if not exists scanner text;
alter table public.photos add column if not exists notes text;
alter table public.photos add column if not exists visibility text not null default 'public';
alter table public.photos add column if not exists created_at timestamptz not null default now();
alter table public.photos add column if not exists updated_at timestamptz not null default now();

create index if not exists albums_user_idx on public.albums (user_id, created_at desc);
create index if not exists albums_public_created_idx on public.albums (visibility, created_at desc);
create index if not exists photos_public_created_idx on public.photos (visibility, created_at desc);
create index if not exists photos_user_idx on public.photos (user_id, created_at desc);
create index if not exists photos_album_idx on public.photos (album_id);
create index if not exists photos_camera_type_idx on public.photos (camera_type);
create index if not exists photos_film_brand_idx on public.photos (film_brand);
create index if not exists photos_iso_idx on public.photos (iso);
create index if not exists photos_search_idx on public.photos using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' ||
    coalesce(location, '') || ' ' ||
    coalesce(camera, '') || ' ' ||
    coalesce(lens, '') || ' ' ||
    coalesce(film, '')
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists series_set_updated_at on public.series;
create trigger series_set_updated_at
before update on public.series
for each row execute function public.set_updated_at();

drop trigger if exists albums_set_updated_at on public.albums;
create trigger albums_set_updated_at
before update on public.albums
for each row execute function public.set_updated_at();

drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at
before update on public.photos
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.films enable row level security;
alter table public.cameras enable row level security;
alter table public.lenses enable row level security;
alter table public.albums enable row level security;
alter table public.series enable row level security;
alter table public.photos enable row level security;
alter table public.series_photos enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
on public.profiles for select
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Catalogs are readable" on public.films;
create policy "Catalogs are readable" on public.films for select using (true);

drop policy if exists "Cameras are readable" on public.cameras;
create policy "Cameras are readable" on public.cameras for select using (true);

drop policy if exists "Lenses are readable" on public.lenses;
create policy "Lenses are readable" on public.lenses for select using (true);

drop policy if exists "Public albums are readable" on public.albums;
create policy "Public albums are readable"
on public.albums for select
using (visibility = 'public' or user_id = auth.uid());

drop policy if exists "Users manage own albums" on public.albums;
create policy "Users manage own albums"
on public.albums for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Public series are readable" on public.series;
create policy "Public series are readable"
on public.series for select
using (visibility = 'public' or owner_id = auth.uid());

drop policy if exists "Users manage own series" on public.series;
create policy "Users manage own series"
on public.series for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Public photos are readable" on public.photos;
create policy "Public photos are readable"
on public.photos for select
using (visibility = 'public' or user_id = auth.uid());

drop policy if exists "Users manage own photos" on public.photos;
create policy "Users manage own photos"
on public.photos for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Series photos readable through public photos" on public.series_photos;
create policy "Series photos readable through public photos"
on public.series_photos for select
using (
  exists (
    select 1 from public.photos
    where photos.id = series_photos.photo_id
      and (photos.visibility = 'public' or photos.user_id = auth.uid())
  )
);

drop policy if exists "Users manage own series photos" on public.series_photos;
create policy "Users manage own series photos"
on public.series_photos for all
using (
  exists (
    select 1 from public.series
    where series.id = series_photos.series_id
      and series.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.series
    where series.id = series_photos.series_id
      and series.owner_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;

notify pgrst, 'reload schema';
