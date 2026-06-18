begin;

alter table public.photos
  add column if not exists rotation integer not null default 0;

update public.photos
set rotation = 0
where rotation is null
   or rotation not in (0, 90, 180, 270);

alter table public.photos
  alter column rotation set default 0,
  alter column rotation set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'photos_rotation_check'
      and conrelid = 'public.photos'::regclass
  ) then
    alter table public.photos
      add constraint photos_rotation_check
      check (rotation in (0, 90, 180, 270));
  end if;
end $$;

commit;

select pg_notify('pgrst', 'reload schema');

select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'photos'
  and column_name = 'rotation';
