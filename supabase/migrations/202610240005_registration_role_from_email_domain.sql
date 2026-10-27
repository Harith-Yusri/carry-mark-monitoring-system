-- The verified UiTM email domain is the authoritative registration role.
-- Client-supplied role metadata is deliberately ignored.
create or replace function public.handle_cmms_self_registration()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
declare registration_source text := metadata->>'registration_source';
declare email_domain text;
declare registration_role text;
declare full_name_value text := trim(coalesce(metadata->>'full_name', ''));
declare identifier_value text := upper(trim(coalesce(metadata->>'identifier', '')));
declare programme_value uuid;
declare semester_value smallint;
begin
  if registration_source is distinct from 'cmms-self-registration' then
    return new;
  end if;

  if new.email is null or length(trim(new.email)) > 320 then
    raise exception 'A valid UiTM email address is required';
  end if;
  email_domain := lower(substring(trim(new.email) from '@([^@]+)$'));
  registration_role := case email_domain
    when 'student.uitm.edu.my' then 'student'
    when 'uitm.edu.my' then 'lecturer'
    else null
  end;
  if registration_role is null then
    raise exception 'Registration requires an @student.uitm.edu.my or @uitm.edu.my email address';
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
      new.id, false
    );
  else
    insert into public.profiles (
      id, staff_no, full_name, role, programme_id, is_active
    ) values (
      new.id, identifier_value, full_name_value, 'lecturer', null, false
    );
  end if;

  return new;
exception
  when unique_violation then
    raise exception 'That email or Student/Staff ID is already registered';
end;
$$;

create or replace function public.activate_confirmed_cmms_registration()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
declare email_domain text;
begin
  if metadata->>'registration_source' = 'cmms-self-registration'
     and old.email_confirmed_at is null
     and new.email_confirmed_at is not null then
    email_domain := lower(substring(trim(new.email) from '@([^@]+)$'));
    if email_domain = 'student.uitm.edu.my' then
      update public.students
      set is_active = true
      where auth_user_id = new.id;
    elsif email_domain = 'uitm.edu.my' then
      update public.profiles
      set is_active = true
      where id = new.id and role = 'lecturer';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_cmms_self_registration() from public, anon, authenticated;
revoke all on function public.activate_confirmed_cmms_registration() from public, anon, authenticated;
