-- Student mobile authentication now uses Google OAuth. The Auth hook blocks
-- new Google identities outside UiTM's student domain before auth.users is
-- populated. Profile onboarding then derives identity fields server-side.

create or replace function public.hook_restrict_student_google_domain(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = '' as $$
declare
  provider text := lower(coalesce(event->'user'->'app_metadata'->>'provider', ''));
  providers jsonb := coalesce(event->'user'->'app_metadata'->'providers', '[]'::jsonb);
  email text := lower(trim(coalesce(event->'user'->>'email', '')));
begin
  -- Do not alter the existing email/password staff registration path.
  if provider <> 'google' and not providers ? 'google' then
    return '{}'::jsonb;
  end if;

  if email !~ '^[^@]+@student\.uitm\.edu\.my$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Please sign in using your UiTM student Google account.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_restrict_student_google_domain(jsonb)
  from public, anon, authenticated;
grant execute on function public.hook_restrict_student_google_domain(jsonb)
  to supabase_auth_admin;

-- Fail closed for callers that bypass the removed mobile UI and attempt to use
-- the retired password-based student registration metadata directly.
create or replace function public.reject_retired_student_password_registration()
returns trigger
language plpgsql
security definer
set search_path = '' as $$
begin
  if coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'registration_source'
     = 'cams-student-registration' then
    raise exception 'Student registration requires a UiTM student Google account';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_retired_student_password_registration on auth.users;
create trigger reject_retired_student_password_registration
before insert on auth.users
for each row execute function public.reject_retired_student_password_registration();

revoke all on function public.reject_retired_student_password_registration()
  from public, anon, authenticated;

create or replace function public.get_my_student_onboarding_state()
returns table (
  auth_user_id uuid,
  email text,
  student_id text,
  full_name text,
  programme_id uuid,
  current_semester smallint,
  profile_complete boolean
)
language plpgsql
stable
security definer
set search_path = '' as $$
declare
  auth_record auth.users%rowtype;
  derived_student_id text;
  linked_student public.students%rowtype;
begin
  select * into auth_record
  from auth.users
  where id = (select auth.uid());

  if auth_record.id is null then
    raise exception 'Authentication is required';
  end if;
  if lower(trim(coalesce(auth_record.email, ''))) !~ '^[^@]+@student\.uitm\.edu\.my$' then
    raise exception 'Please sign in using your UiTM student Google account.';
  end if;
  if not exists (
    select 1 from auth.identities identity
    where identity.user_id = auth_record.id and identity.provider = 'google'
  ) then
    raise exception 'Please sign in using your UiTM student Google account.';
  end if;

  derived_student_id := split_part(lower(auth_record.email), '@', 1);
  if derived_student_id !~ '^[a-z0-9._-]{2,100}$' then
    raise exception 'The Student ID in this UiTM email is not valid';
  end if;

  select * into linked_student
  from public.students student
  where student.auth_user_id = auth_record.id
  limit 1;

  return query select
    auth_record.id,
    lower(auth_record.email),
    derived_student_id,
    coalesce(
      nullif(linked_student.full_name, ''),
      nullif(trim(coalesce(auth_record.raw_user_meta_data->>'full_name', auth_record.raw_user_meta_data->>'name')), ''),
      derived_student_id
    ),
    linked_student.programme_id,
    linked_student.current_semester,
    linked_student.id is not null
      and linked_student.is_active
      and linked_student.programme_id is not null
      and linked_student.current_semester is not null;
end;
$$;

create or replace function public.complete_my_student_profile(
  p_programme_id uuid,
  p_current_semester smallint
) returns uuid
language plpgsql
security definer
set search_path = '' as $$
declare
  auth_record auth.users%rowtype;
  derived_student_id text;
  derived_full_name text;
  linked_student public.students%rowtype;
  matrix_student public.students%rowtype;
  result_id uuid;
begin
  select * into auth_record
  from auth.users
  where id = (select auth.uid());

  if auth_record.id is null then
    raise exception 'Authentication is required';
  end if;
  if lower(trim(coalesce(auth_record.email, ''))) !~ '^[^@]+@student\.uitm\.edu\.my$'
     or not exists (
       select 1 from auth.identities identity
       where identity.user_id = auth_record.id and identity.provider = 'google'
     ) then
    raise exception 'Please sign in using your UiTM student Google account.';
  end if;

  derived_student_id := split_part(lower(auth_record.email), '@', 1);
  if derived_student_id !~ '^[a-z0-9._-]{2,100}$' then
    raise exception 'The Student ID in this UiTM email is not valid';
  end if;
  derived_full_name := coalesce(
    nullif(trim(coalesce(auth_record.raw_user_meta_data->>'full_name', auth_record.raw_user_meta_data->>'name')), ''),
    derived_student_id
  );
  if length(derived_full_name) > 150 then
    derived_full_name := left(derived_full_name, 150);
  end if;

  if p_current_semester not between 1 and 12 then
    raise exception 'Current semester must be between 1 and 12';
  end if;
  if not exists (
    select 1 from public.programmes programme
    where programme.id = p_programme_id and programme.is_active
  ) then
    raise exception 'Select an active programme';
  end if;

  -- Serialize profile claims for both possible unique keys.
  perform pg_advisory_xact_lock(hashtext('student-google:' || derived_student_id));

  select * into linked_student
  from public.students student
  where student.auth_user_id = auth_record.id
  for update;

  select * into matrix_student
  from public.students student
  where lower(student.matrix_no) = derived_student_id
  for update;

  if linked_student.id is not null then
    if matrix_student.id is not null and matrix_student.id <> linked_student.id then
      raise exception 'This Student ID is already linked to another CAMS profile';
    end if;
    if lower(linked_student.matrix_no) <> derived_student_id then
      raise exception 'This Google account does not match the linked CAMS Student ID';
    end if;

    update public.students
    set full_name = derived_full_name,
        programme_id = p_programme_id,
        current_semester = p_current_semester,
        is_active = true,
        updated_at = now()
    where id = linked_student.id
    returning id into result_id;
  elsif matrix_student.id is not null then
    if matrix_student.auth_user_id is not null
       and matrix_student.auth_user_id <> auth_record.id then
      raise exception 'This Student ID is already linked to another CAMS account';
    end if;

    update public.students
    set auth_user_id = auth_record.id,
        full_name = derived_full_name,
        programme_id = p_programme_id,
        current_semester = p_current_semester,
        is_active = true,
        updated_at = now()
    where id = matrix_student.id
    returning id into result_id;
  else
    insert into public.students (
      matrix_no, full_name, programme_id, current_semester,
      auth_user_id, is_active
    ) values (
      derived_student_id, derived_full_name, p_programme_id,
      p_current_semester, auth_record.id, true
    ) returning id into result_id;
  end if;

  return result_id;
exception
  when unique_violation then
    raise exception 'This Student ID is already linked to another CAMS account';
end;
$$;

revoke all on function public.get_my_student_onboarding_state()
  from public, anon;
revoke all on function public.complete_my_student_profile(uuid, smallint)
  from public, anon;
grant execute on function public.get_my_student_onboarding_state()
  to authenticated;
grant execute on function public.complete_my_student_profile(uuid, smallint)
  to authenticated;

notify pgrst, 'reload schema';
