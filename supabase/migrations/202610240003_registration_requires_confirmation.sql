-- Fail closed if hosted Auth email confirmations are accidentally disabled.
-- Self-registered application rows always start inactive and are activated only
-- by the separate email_confirmed_at update trigger.
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
begin
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

revoke all on function public.handle_cmms_self_registration() from public, anon, authenticated;
