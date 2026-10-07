-- Run against the linked database after applying the migration. All fixtures roll back.
begin;
do $$
declare
  lecturer_a uuid := gen_random_uuid();
  lecturer_b uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  programme uuid := gen_random_uuid();
  second_programme uuid := gen_random_uuid();
  term uuid := gen_random_uuid();
  first_offering uuid;
  second_offering uuid;
  test_subject_id uuid;
  test_code text := 'TEST' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  insert into auth.users (id) values (lecturer_a), (lecturer_b), (admin_id);
  insert into public.programmes (id, code, name) values
    (programme, test_code, 'Temporary test programme'),
    (second_programme, test_code || 'P', 'Second temporary programme');
  insert into public.profiles (id, staff_no, full_name, role) values
    (lecturer_a, test_code || 'A', 'Test Lecturer A', 'lecturer'),
    (lecturer_b, test_code || 'B', 'Test Lecturer B', 'lecturer'),
    (admin_id, test_code || 'C', 'Test Admin', 'admin');
  update public.academic_terms set is_current = false where is_current;
  insert into public.academic_terms (id, academic_year, semester_no, starts_on, ends_on, default_deadline, status, is_current)
    values (term, test_code, 1, '2026-01-01', '2026-12-31', '2026-12-01', 'active', true);

  perform set_config('request.jwt.claim.sub', lecturer_a::text, true);
  first_offering := public.create_lecturer_subject(' ' || lower(test_code) || ' ', 'Test Subject', 3);
  select so.subject_id into test_subject_id from public.subject_offerings so where id = first_offering;
  if not exists (select 1 from public.subjects s where s.id = test_subject_id and s.code = test_code) then
    raise exception 'FAIL: new subject was not normalized';
  end if;
  if not exists (select 1 from public.subject_offerings where id = first_offering and lecturer_id = lecturer_a and term_id = term and status = 'active') then
    raise exception 'FAIL: incorrect lecturer or term';
  end if;
  begin
    perform public.create_lecturer_subject(test_code, 'Duplicate', 1);
    raise exception 'FAIL: duplicate assignment allowed';
  exception when others then
      if sqlerrm not like 'You have already added%' then raise; end if;
  end;
  insert into public.class_sections (offering_id, programme_id, label, capacity) values
    (first_offering, programme, 'Programme A', 10),
    (first_offering, second_programme, 'Programme B', 10);
  if (select count(*) from public.get_my_lecturer_subjects() where offering_id = first_offering) <> 1 then
    raise exception 'FAIL: lecturer subject read model did not return the offering';
  end if;
  if not exists (
    select 1 from public.get_my_lecturer_subjects()
    where offering_id = first_offering and programme_ids @> array[programme, second_programme]
  ) then
    raise exception 'FAIL: lecturer subject read model did not return both class programmes';
  end if;
  perform public.update_lecturer_subject(first_offering, 'Edited Test Subject', 4);
  if not exists (
    select 1 from public.subject_offerings
    where id = first_offering and subject_name_override = 'Edited Test Subject' and programme_semester_override = 4
  ) then
    raise exception 'FAIL: lecturer subject override was not saved';
  end if;
  perform set_config('request.jwt.claim.sub', lecturer_b::text, true);
  begin
    perform public.update_lecturer_subject(first_offering, 'Unauthorised Edit', 5);
    raise exception 'FAIL: lecturer edited another lecturer offering';
  exception when others then
    if sqlerrm not like 'You can only edit subjects%' then raise; end if;
  end;
  second_offering := public.create_lecturer_subject(test_code, 'Do not overwrite', 9);
  if not exists (select 1 from public.subject_offerings so where id = second_offering and so.subject_id = test_subject_id and lecturer_id = lecturer_b) then
    raise exception 'FAIL: second lecturer did not reuse the catalogue subject';
  end if;
  if (select count(*) from public.subjects where code = test_code) <> 1 or
     not exists (select 1 from public.subjects where code = test_code and name = 'Test Subject' and programme_semester = 3) then
    raise exception 'FAIL: catalogue duplicated or overwritten';
  end if;
  update public.subjects set is_active = false where code = test_code;
  begin
    perform public.create_lecturer_subject(test_code, '', 1);
    raise exception 'FAIL: inactive subject allowed';
  exception when others then
    if sqlerrm not like 'This subject is inactive%' then raise; end if;
  end;
  begin
    perform public.create_lecturer_subject(test_code || 'NEW', 'Bad semester', 13);
    raise exception 'FAIL: invalid semester allowed';
  exception when others then
    if sqlerrm not like 'Programme semester must%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  begin
    perform public.create_lecturer_subject(test_code, '', 1);
    raise exception 'FAIL: admin allowed to create lecturer offering';
  exception when others then
    if sqlerrm not like 'An active lecturer account%' then raise; end if;
  end;
  update public.profiles set is_active = false where id = lecturer_b;
  perform set_config('request.jwt.claim.sub', lecturer_b::text, true);
  begin
    perform public.create_lecturer_subject(test_code, '', 1);
    raise exception 'FAIL: inactive lecturer allowed';
  exception when others then
    if sqlerrm not like 'An active lecturer account%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', lecturer_a::text, true);
  update public.academic_terms set status = 'closed' where id = term;
  begin
    perform public.create_lecturer_subject(test_code, '', 1);
    raise exception 'FAIL: closed term allowed';
  exception when others then
    if sqlerrm not like 'There is no active current%' then raise; end if;
  end;
  if has_function_privilege('anon', 'public.create_lecturer_subject(text,text,integer)', 'execute') then
    raise exception 'FAIL: anonymous role can call function';
  end if;
  if has_function_privilege('anon', 'public.update_lecturer_subject(uuid,text,integer)', 'execute') then
    raise exception 'FAIL: anonymous role can edit a lecturer subject';
  end if;
  if has_function_privilege('anon', 'public.get_my_lecturer_subjects()', 'execute') then
    raise exception 'FAIL: anonymous role can read lecturer subjects';
  end if;
end;
$$;
rollback;
select 'Passed: class-derived multi-programme read model, owned edit, normalization, duplicate rejection, catalogue reuse, ownership, inactive subject, invalid semester, role checks, closed term and anonymous permission. All fixtures rolled back.' as result;
