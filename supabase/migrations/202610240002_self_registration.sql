-- Secure Student/Lecturer self-registration. Public clients create only the
-- Auth user; validated triggers create and activate the linked application row.

alter table public.students
  add column if not exists current_semester smallint
  check (current_semester between 1 and 12);

create or replace function public.get_registration_programmes()
returns table (id uuid, code text, name text)
language sql
stable
security definer
set search_path = '' as $$
  select programme.id, programme.code, programme.name
  from public.programmes programme
  where programme.is_active
  order by programme.code;
$$;

create or replace function public.registration_identifier_available(p_role text, p_identifier text)
returns boolean
language plpgsql
stable
security definer
set search_path = '' as $$
declare normalized_role text := lower(trim(coalesce(p_role, '')));
declare normalized_identifier text := upper(trim(coalesce(p_identifier, '')));
begin
  if normalized_role not in ('student', 'lecturer')
     or normalized_identifier !~ '^[A-Z0-9._-]{2,100}$' then
    return false;
  end if;

  if normalized_role = 'student' then
    return not exists (
      select 1 from public.students student
      where upper(student.matrix_no) = normalized_identifier
    );
  end if;

  return not exists (
    select 1 from public.profiles profile
    where upper(profile.staff_no) = normalized_identifier
  );
end;
$$;

create or replace function public.handle_cmms_self_registration()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
declare registration_role text := lower(trim(coalesce(metadata->>'registration_role', '')));
declare registration_source text := metadata->>'registration_source';
declare full_name_value text := trim(coalesce(metadata->>'full_name', ''));
declare identifier_value text := upper(trim(coalesce(metadata->>'identifier', '')));
declare programme_value uuid;
declare semester_value smallint;
declare account_active boolean := new.email_confirmed_at is not null;
begin
  -- Ignore Auth users created through existing administrator workflows.
  if registration_source is distinct from 'cmms-self-registration' then
    return new;
  end if;

  if registration_role not in ('student', 'lecturer') then
    raise exception 'Only Student or Lecturer self-registration is allowed';
  end if;
  if new.email is null or length(trim(new.email)) > 320 then
    raise exception 'A valid email address is required';
  end if;
  if length(full_name_value) < 2 or length(full_name_value) > 150 then
    raise exception 'Full name must contain between 2 and 150 characters';
  end if;
  if identifier_value !~ '^[A-Z0-9._-]{2,100}$' then
    raise exception 'Enter a valid Student ID or Staff ID';
  end if;

  if registration_role = 'student' then
    begin
      programme_value := (metadata->>'programme_id')::uuid;
      semester_value := (metadata->>'current_semester')::smallint;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'A valid programme and current semester are required';
    end;

    if semester_value not between 1 and 12 then
      raise exception 'Current semester must be between 1 and 12';
    end if;
    if not exists (
      select 1 from public.programmes programme
      where programme.id = programme_value and programme.is_active
    ) then
      raise exception 'Select an active programme';
    end if;

    insert into public.students (
      matrix_no, full_name, programme_id, current_semester,
      auth_user_id, is_active
    ) values (
      identifier_value, full_name_value, programme_value, semester_value,
      new.id, account_active
    );
  else
    insert into public.profiles (
      id, staff_no, full_name, role, programme_id, is_active
    ) values (
      new.id, identifier_value, full_name_value, 'lecturer', null, account_active
    );
  end if;

  return new;
exception
  when unique_violation then
    raise exception 'That email or Student/Staff ID is already registered';
end;
$$;

drop trigger if exists cmms_self_registration_created on auth.users;
create trigger cmms_self_registration_created
after insert on auth.users
for each row execute function public.handle_cmms_self_registration();

create or replace function public.activate_confirmed_cmms_registration()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
declare registration_role text := lower(trim(coalesce(metadata->>'registration_role', '')));
begin
  if metadata->>'registration_source' = 'cmms-self-registration'
     and old.email_confirmed_at is null
     and new.email_confirmed_at is not null then
    if registration_role = 'student' then
      update public.students
      set is_active = true
      where auth_user_id = new.id;
    elsif registration_role = 'lecturer' then
      update public.profiles
      set is_active = true
      where id = new.id and role = 'lecturer';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cmms_self_registration_confirmed on auth.users;
create trigger cmms_self_registration_confirmed
after update of email_confirmed_at on auth.users
for each row execute function public.activate_confirmed_cmms_registration();

-- Resolve IDs only inside trusted login Edge Functions. These functions are
-- deliberately unavailable through the public Data API.
create table if not exists public.student_login_attempts (
  student_id uuid primary key references public.students(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0)
);
alter table public.student_login_attempts enable row level security;
revoke all on public.student_login_attempts from public, anon, authenticated;

create or replace function public.resolve_student_login_email(target_matrix_no text)
returns text
language plpgsql
security definer
set search_path = '' as $$
declare target_id uuid;
declare attempt_count integer;
declare registered_email text;
begin
  select student.id, auth_user.email into target_id, registered_email
  from public.students student
  join auth.users auth_user on auth_user.id = student.auth_user_id
  where lower(student.matrix_no) = lower(trim(target_matrix_no));
  if target_id is null then return null; end if;

  insert into public.student_login_attempts as attempts (student_id)
  values (target_id)
  on conflict (student_id) do update set
    attempts = case when attempts.window_started_at <= now() - interval '15 minutes' then 1 else attempts.attempts + 1 end,
    window_started_at = case when attempts.window_started_at <= now() - interval '15 minutes' then now() else attempts.window_started_at end
  returning attempts.attempts into attempt_count;
  if attempt_count > 10 then return null; end if;
  return registered_email;
end;
$$;

-- Pending self-registrations must reach Auth so it can return the specific
-- email-not-confirmed response. Active/role checks still happen after Auth.
create or replace function public.resolve_staff_login_email(target_staff_no text)
returns text
language plpgsql
security definer
set search_path = '' as $$
declare target_id uuid;
declare attempt_count integer;
declare registered_email text;
begin
  select profile.id, auth_user.email into target_id, registered_email
  from public.profiles profile
  join auth.users auth_user on auth_user.id = profile.id
  where lower(profile.staff_no) = lower(trim(target_staff_no))
    and profile.role in ('admin', 'lecturer');
  if target_id is null then return null; end if;

  insert into public.staff_login_attempts as attempts (profile_id)
  values (target_id)
  on conflict (profile_id) do update set
    attempts = case when attempts.window_started_at <= now() - interval '15 minutes' then 1 else attempts.attempts + 1 end,
    window_started_at = case when attempts.window_started_at <= now() - interval '15 minutes' then now() else attempts.window_started_at end
  returning attempts.attempts into attempt_count;
  if attempt_count > 10 then return null; end if;
  return registered_email;
end;
$$;

revoke all on function public.get_registration_programmes() from public;
revoke all on function public.registration_identifier_available(text, text) from public;
revoke all on function public.handle_cmms_self_registration() from public, anon, authenticated;
revoke all on function public.activate_confirmed_cmms_registration() from public, anon, authenticated;
revoke all on function public.resolve_student_login_email(text) from public, anon, authenticated;
revoke all on function public.resolve_staff_login_email(text) from public, anon, authenticated;

grant execute on function public.get_registration_programmes() to anon, authenticated;
grant execute on function public.registration_identifier_available(text, text) to anon, authenticated;
grant execute on function public.resolve_student_login_email(text) to service_role;
grant execute on function public.resolve_staff_login_email(text) to service_role;

notify pgrst, 'reload schema';
