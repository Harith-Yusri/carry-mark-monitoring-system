-- Keep staff ID login working when administrators change an Auth email.
-- Only the server may resolve an ID; never expose an anonymous email directory.
create table public.staff_login_attempts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.staff_login_attempts enable row level security;
revoke all on public.staff_login_attempts from anon, authenticated;

create function public.resolve_staff_login_email(target_staff_no text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
  attempt_count integer;
  registered_email text;
begin
  select p.id, u.email into target_id, registered_email
  from public.profiles p join auth.users u on u.id = p.id
  where lower(p.staff_no) = lower(trim(target_staff_no))
    and p.is_active and p.role in ('admin', 'lecturer');
  if target_id is null then return null; end if;

  insert into public.staff_login_attempts as attempts (profile_id) values (target_id)
  on conflict (profile_id) do update set
    attempts = case when attempts.window_started_at <= now() - interval '15 minutes' then 1 else attempts.attempts + 1 end,
    window_started_at = case when attempts.window_started_at <= now() - interval '15 minutes' then now() else attempts.window_started_at end
  returning attempts.attempts into attempt_count;
  if attempt_count > 10 then return null; end if;
  return registered_email;
end;
$$;
revoke all on function public.resolve_staff_login_email(text) from public, anon, authenticated;
grant execute on function public.resolve_staff_login_email(text) to service_role;
