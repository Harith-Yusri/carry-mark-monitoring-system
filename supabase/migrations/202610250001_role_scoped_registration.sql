-- Registration entry points are role-specific. The client-provided role remains
-- untrusted; the registration source and exact UiTM email domain must agree.
create or replace function public.handle_cmms_self_registration()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
declare registration_source text := metadata->>'registration_source';
declare email_domain text;
declare full_name_value text := trim(coalesce(metadata->>'full_name', ''));
declare identifier_value text := upper(trim(coalesce(metadata->>'identifier', '')));
declare programme_value uuid;
declare semester_value smallint;
begin
  -- Auth users created outside public CAMS registration are not affected.
  if registration_source is null then
    return new;
  end if;
  if registration_source = 'cmms-self-registration' then
    raise exception 'This registration client is outdated. Use the current CAMS registration form';
  end if;
  if registration_source not in ('cams-student-registration', 'cams-lecturer-registration') then
    return new;
  end if;

  if new.email is null or length(trim(new.email)) > 320 then
    raise exception 'A valid UiTM email address is required';
  end if;
  email_domain := lower(substring(trim(new.email) from '@([^@]+)$'));
  if registration_source = 'cams-student-registration'
     and email_domain is distinct from 'student.uitm.edu.my' then
    raise exception 'Student registration requires a UiTM student email';
  end if;
  if registration_source = 'cams-lecturer-registration'
     and email_domain is distinct from 'uitm.edu.my' then
    raise exception 'Lecturer registration requires a UiTM staff email';
  end if;
  if length(full_name_value) < 2 or length(full_name_value) > 150 then
    raise exception 'Full name must contain between 2 and 150 characters';
  end if;
  if identifier_value !~ '^[A-Z0-9._-]{2,100}$' then
    if registration_source = 'cams-student-registration' then
      raise exception 'Enter a valid Student ID';
    else
      raise exception 'Enter a valid Staff ID';
    end if;
  end if;

  if registration_source = 'cams-student-registration' then
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
    raise exception 'That email or identifier is already registered';
end;
$$;

create or replace function public.activate_confirmed_cmms_registration()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
declare metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
declare registration_source text := metadata->>'registration_source';
declare email_domain text;
begin
  -- Retain activation support for accounts created before this migration.
  if registration_source in (
       'cmms-self-registration',
       'cams-student-registration',
       'cams-lecturer-registration'
     )
     and old.email_confirmed_at is null
     and new.email_confirmed_at is not null then
    email_domain := lower(substring(trim(new.email) from '@([^@]+)$'));
    if email_domain = 'student.uitm.edu.my' then
      update public.students set is_active = true where auth_user_id = new.id;
    elsif email_domain = 'uitm.edu.my' then
      update public.profiles set is_active = true where id = new.id and role = 'lecturer';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_cmms_self_registration() from public, anon, authenticated;
revoke all on function public.activate_confirmed_cmms_registration() from public, anon, authenticated;

notify pgrst, 'reload schema';
