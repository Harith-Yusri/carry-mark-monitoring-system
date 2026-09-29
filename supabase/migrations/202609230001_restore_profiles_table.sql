-- Restore the canonical staff profile table name expected by the application,
-- database functions, RLS policies, and generated database types.
do $$
begin
  if to_regclass('public.profiles') is null and to_regclass('public.staffs') is not null then
    alter table public.staffs rename to profiles;
  elsif to_regclass('public.profiles') is null then
    raise exception 'Neither public.profiles nor public.staffs exists';
  elsif to_regclass('public.staffs') is not null then
    raise exception 'Both public.profiles and public.staffs exist; manual reconciliation is required';
  end if;
end;
$$;
