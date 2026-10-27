-- Run after applying 202610070004. All fixtures and lifecycle changes roll back.
begin;
do $$
<<session_lifecycle>>
declare
  admin_id uuid := gen_random_uuid();
  lecturer_id uuid := gen_random_uuid();
  student_auth_id uuid := gen_random_uuid();
  student_id uuid := gen_random_uuid();
  programme_id uuid := gen_random_uuid();
  old_term uuid := gen_random_uuid();
  new_term uuid;
  subject_id uuid := gen_random_uuid();
  offering_id uuid := gen_random_uuid();
  section_id uuid := gen_random_uuid();
  test_code text := 'SL' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  student_portal jsonb;
begin
  insert into auth.users(id) values (admin_id), (lecturer_id), (student_auth_id);
  insert into public.profiles(id, staff_no, full_name, role) values
    (admin_id, test_code || 'A', 'Lifecycle Admin', 'admin'),
    (lecturer_id, test_code || 'L', 'Lifecycle Lecturer', 'lecturer');
  insert into public.programmes(id, code, name) values (programme_id, test_code, 'Lifecycle Programme');
  update public.academic_terms set is_current = false where is_current;
  insert into public.academic_terms(id, academic_year, semester_code, semester_no, starts_on, ends_on, default_deadline, status, is_current)
    values (old_term, '2025/2026', '20261', 1, '2026-01-01', '2026-06-30', '2026-06-15', 'active', true);
  insert into public.subjects(id, code, name) values (subject_id, test_code, 'Lifecycle Subject');
  insert into public.subject_offerings(id, subject_id, term_id, lecturer_id, programme_id, programme_semester, status)
    values (offering_id, subject_id, old_term, lecturer_id, programme_id, 1, 'active');
  insert into public.class_sections(id, offering_id, programme_id, label, capacity)
    values (section_id, offering_id, programme_id, 'A', 10);
  insert into public.students(id, matrix_no, full_name, programme_id, auth_user_id)
    values (student_id, test_code || 'S', 'Lifecycle Student', programme_id, student_auth_id);
  insert into public.enrolments(section_id, student_id) values (section_id, student_id);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  new_term := public.create_academic_semester('2026/2027', '20262', '2026-07-01'::date, '2026-12-31'::date, '2026-12-15'::timestamptz);
  if not exists (select 1 from public.academic_terms where id = new_term and status = 'draft' and not is_current) then
    raise exception 'FAIL: semester was not created as a draft';
  end if;
  perform public.activate_academic_semester(new_term);
  if not exists (select 1 from public.academic_terms where id = new_term and status = 'active' and is_current) then
    raise exception 'FAIL: new semester was not activated';
  end if;
  if not exists (select 1 from public.academic_terms where id = old_term and status = 'closed' and not is_current and closed_at is not null) then
    raise exception 'FAIL: previous semester was not archived';
  end if;
  if not exists (select 1 from public.subject_offerings where id = offering_id and status = 'completed') then
    raise exception 'FAIL: previous offerings were not completed';
  end if;
  begin
    update public.class_sections set label = 'Changed' where id = section_id;
    raise exception 'FAIL: archived class remained writable';
  exception when others then
    if sqlerrm not like 'Archived academic semester data is read-only%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', lecturer_id::text, true);
  if not exists (select 1 from public.get_my_archived_lecturer_subjects() archived where archived.offering_id = session_lifecycle.offering_id) then
    raise exception 'FAIL: lecturer archived semester data is unavailable';
  end if;
  if exists (select 1 from public.get_my_lecturer_subjects() current_subject where current_subject.offering_id = session_lifecycle.offering_id) then
    raise exception 'FAIL: archived offering appeared in the current lecturer view';
  end if;

  perform set_config('request.jwt.claim.sub', student_auth_id::text, true);
  student_portal := public.get_my_mobile_portal();
  if public.can_access_offering(offering_id) or jsonb_array_length(student_portal->'subjects') <> 0 then
    raise exception 'FAIL: student normal view can still access the archived semester';
  end if;
  if student_portal#>>'{student,semester}' <> 'Semester 2 · 2026/2027' then
    raise exception 'FAIL: student semester label did not follow the active academic_terms row';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  begin
    perform public.delete_academic_semester(old_term);
    raise exception 'FAIL: populated archived semester was deleted';
  exception when others then
    if sqlerrm not like 'This semester contains teaching data%' then raise; end if;
  end;
  perform public.update_academic_semester(old_term, '2025/2026', '20254', '2026-01-02'::date, '2026-06-30'::date, '2026-06-16'::timestamptz);
  if not exists (select 1 from public.academic_terms where id = old_term and academic_year = '2025/2026' and semester_code = '20254' and semester_no = 4) then
    raise exception 'FAIL: archived semester details were not editable';
  end if;
  perform public.activate_academic_semester(old_term);
  if not exists (select 1 from public.academic_terms where id = old_term and status = 'active' and is_current) or
     not exists (select 1 from public.academic_terms where id = new_term and status = 'closed' and not is_current) then
    raise exception 'FAIL: switching back did not reactivate the previous semester';
  end if;
  if not exists (select 1 from public.subject_offerings where id = offering_id and status = 'active' and status_before_archive is null) then
    raise exception 'FAIL: offering status was not restored when the semester reopened';
  end if;
  update public.class_sections set label = 'Reopened' where id = section_id;
  begin
    perform public.delete_academic_semester(old_term);
    raise exception 'FAIL: active semester was deleted';
  exception when others then
    if sqlerrm not like 'The active academic semester cannot be deleted%' then raise; end if;
  end;
  perform public.delete_academic_semester(new_term);
  if exists (select 1 from public.academic_terms where id = new_term) then
    raise exception 'FAIL: empty archived test semester was not deleted';
  end if;

  if has_function_privilege('anon', 'public.activate_academic_semester(uuid)', 'execute') then
    raise exception 'FAIL: anonymous role can activate semesters';
  end if;
end;
$$;
rollback;
select 'Passed: creation, editing, activation, archival, write lock, student isolation, history, reversible reopening and safe empty-semester deletion. All fixtures rolled back.' result;
