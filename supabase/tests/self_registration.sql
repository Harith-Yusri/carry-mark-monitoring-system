-- Run after 202610250001. Registration fixtures roll back.
begin;
do $$
declare
  programme_id uuid := gen_random_uuid();
  student_auth_id uuid := gen_random_uuid();
  lecturer_auth_id uuid := gen_random_uuid();
  rejected_external_id uuid := gen_random_uuid();
  rejected_student_channel_id uuid := gen_random_uuid();
  rejected_lecturer_channel_id uuid := gen_random_uuid();
  rejected_legacy_id uuid := gen_random_uuid();
  duplicate_student_id uuid := gen_random_uuid();
  code_prefix text := 'RG' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  rejected boolean := false;
begin
  insert into public.programmes(id, code, name)
  values (programme_id, code_prefix, 'Registration Test Programme');

  insert into auth.users(id, email, raw_user_meta_data)
  values (
    student_auth_id,
    lower(code_prefix) || '@student.uitm.edu.my',
    jsonb_build_object(
      'registration_source', 'cams-student-registration',
      'registration_role', 'lecturer',
      'full_name', 'Registration Student',
      'identifier', code_prefix || 'S',
      'programme_id', programme_id,
      'current_semester', 4
    )
  );

  if not exists (
    select 1 from public.students
    where auth_user_id = student_auth_id
      and matrix_no = code_prefix || 'S'
      and current_semester = 4
      and not is_active
  ) then
    raise exception 'FAIL: pending student profile was not created correctly';
  end if;

  insert into auth.users(id, email, raw_user_meta_data)
  values (
    lecturer_auth_id,
    lower(code_prefix) || '@uitm.edu.my',
    jsonb_build_object(
      'registration_source', 'cams-lecturer-registration',
      'registration_role', 'student',
      'full_name', 'Registration Lecturer',
      'identifier', code_prefix || 'L'
    )
  );

  if not exists (
    select 1 from public.profiles
    where id = lecturer_auth_id
      and staff_no = code_prefix || 'L'
      and role = 'lecturer'
      and not is_active
      and programme_id is null
  ) then
    raise exception 'FAIL: pending lecturer profile was not created correctly';
  end if;

  begin
    insert into auth.users(id, email, raw_user_meta_data)
    values (
      rejected_external_id,
      lower(code_prefix) || '@example.com',
      jsonb_build_object(
        'registration_source', 'cams-student-registration',
        'registration_role', 'admin',
        'full_name', 'Rejected Admin',
        'identifier', code_prefix || 'A'
      )
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: a non-UiTM email domain was accepted'; end if;

  rejected := false;
  begin
    insert into auth.users(id, email, raw_user_meta_data)
    values (
      rejected_student_channel_id,
      lower(code_prefix) || '.staff@uitm.edu.my',
      jsonb_build_object(
        'registration_source', 'cams-student-registration',
        'full_name', 'Wrong Student Channel',
        'identifier', code_prefix || 'WS',
        'programme_id', programme_id,
        'current_semester', 4
      )
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: student registration accepted a staff email'; end if;

  rejected := false;
  begin
    insert into auth.users(id, email, raw_user_meta_data)
    values (
      rejected_lecturer_channel_id,
      lower(code_prefix) || '.student@student.uitm.edu.my',
      jsonb_build_object(
        'registration_source', 'cams-lecturer-registration',
        'full_name', 'Wrong Lecturer Channel',
        'identifier', code_prefix || 'WL'
      )
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: lecturer registration accepted a student email'; end if;

  rejected := false;
  begin
    insert into auth.users(id, email, raw_user_meta_data)
    values (
      rejected_legacy_id,
      lower(code_prefix) || '.legacy@student.uitm.edu.my',
      jsonb_build_object(
        'registration_source', 'cmms-self-registration',
        'full_name', 'Legacy Registration',
        'identifier', code_prefix || 'OLD',
        'programme_id', programme_id,
        'current_semester', 4
      )
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'FAIL: legacy shared registration source was accepted'; end if;

  rejected := false;
  begin
    insert into auth.users(id, email, raw_user_meta_data)
    values (
      duplicate_student_id,
      lower(code_prefix) || '.duplicate@student.uitm.edu.my',
      jsonb_build_object(
        'registration_source', 'cams-student-registration',
        'registration_role', 'student',
        'full_name', 'Duplicate Registration Student',
        'identifier', code_prefix || 'S',
        'programme_id', programme_id,
        'current_semester', 4
      )
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'FAIL: duplicate registration ID was accepted'; end if;

  update auth.users set email_confirmed_at = now()
  where id in (student_auth_id, lecturer_auth_id);

  if not exists (select 1 from public.students where auth_user_id = student_auth_id and is_active)
     or not exists (select 1 from public.profiles where id = lecturer_auth_id and is_active) then
    raise exception 'FAIL: confirmed registration was not activated';
  end if;

  if public.resolve_student_login_email(code_prefix || 'S') is null
     or public.resolve_staff_login_email(code_prefix || 'L') is null then
    raise exception 'FAIL: confirmed ID could not resolve to its Auth email';
  end if;
end;
$$;
rollback;
select 'Passed: role-scoped email domains, legacy-source rejection, metadata tamper resistance, duplicate checks, confirmation activation, and Auth linkage.' as result;
