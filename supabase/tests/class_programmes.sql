-- Run against the linked database after applying migrations. All fixtures roll back.
begin;
do $$
<<class_programmes>>
declare
  lecturer_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  student_auth_a uuid := gen_random_uuid();
  student_auth_b uuid := gen_random_uuid();
  programme_a uuid := gen_random_uuid();
  programme_b uuid := gen_random_uuid();
  term_id uuid := gen_random_uuid();
  subject_id uuid := gen_random_uuid();
  offering_id uuid := gen_random_uuid();
  section_id uuid := gen_random_uuid();
  student_a uuid := gen_random_uuid();
  student_b uuid := gen_random_uuid();
  test_code text := 'CL' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  insert into auth.users (id) values (lecturer_id), (admin_id), (student_auth_a), (student_auth_b);
  insert into public.programmes (id, code, name) values
    (programme_a, test_code || 'A', 'Class programme A'),
    (programme_b, test_code || 'B', 'Class programme B');
  insert into public.profiles (id, staff_no, full_name, role)
    values (lecturer_id, test_code, 'Class Programme Lecturer', 'lecturer');
  insert into public.profiles (id, staff_no, full_name, role)
    values (admin_id, test_code || 'ADMIN', 'Class Programme Admin', 'admin');
  update public.academic_terms set is_current = false where is_current;
  insert into public.academic_terms (id, academic_year, semester_no, starts_on, ends_on, default_deadline, status, is_current)
    values (term_id, test_code, 1, '2026-01-01', '2026-12-31', '2026-12-01', 'active', true);
  insert into public.subjects (id, code, name, programme_semester)
    values (subject_id, test_code, 'Class Programme Test', 1);
  insert into public.subject_offerings (id, subject_id, term_id, lecturer_id)
    values (offering_id, subject_id, term_id, lecturer_id);
  insert into public.class_sections (id, offering_id, programme_id, label, capacity)
    values (section_id, offering_id, programme_a, 'A', 10);
  insert into public.students (id, matrix_no, full_name, programme_id, auth_user_id) values
    (student_a, test_code || '1', 'Programme A Student', programme_a, student_auth_a),
    (student_b, test_code || '2', 'Programme B Student', programme_b, student_auth_b);
  insert into public.enrolments (section_id, student_id) values (section_id, student_a);

  perform set_config('request.jwt.claim.sub', lecturer_id::text, true);
  if not public.owns_offering(offering_id) or not public.can_access_section(section_id) then
    raise exception 'FAIL: lecturer cannot access an owned cross-programme class';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  if not public.is_admin() or not public.can_access_offering(offering_id)
     or not public.can_access_section(section_id) or not public.can_access_student(student_a) then
    raise exception 'FAIL: admin cannot access allocation data through the current policies';
  end if;

  perform set_config('request.jwt.claim.sub', student_auth_a::text, true);
  if not public.can_access_offering(offering_id) or not public.can_access_section(section_id)
     or not public.student_can_read_lecturer(lecturer_id) then
    raise exception 'FAIL: enrolled student cannot access their class, offering or lecturer';
  end if;
  if (select count(*) from public.get_my_subjects() student_subject where student_subject.offering_id = class_programmes.offering_id) <> 1 then
    raise exception 'FAIL: enrolled student subject read model did not return the class';
  end if;

  perform set_config('request.jwt.claim.sub', student_auth_b::text, true);
  if public.can_access_offering(offering_id) or public.can_access_section(section_id) then
    raise exception 'FAIL: unenrolled student can access another programme class';
  end if;

  begin
    update public.class_sections set programme_id = programme_b where id = section_id;
    raise exception 'FAIL: class programme changed despite incompatible enrolment';
  exception when others then
    if sqlerrm not like 'The class programme cannot be changed%' then raise; end if;
  end;

  begin
    insert into public.enrolments (section_id, student_id) values (section_id, student_b);
    raise exception 'FAIL: student enrolled into a class from another programme';
  exception when others then
    if sqlerrm not like 'The student and class must belong%' then raise; end if;
  end;

  update public.programmes set is_active = false where id = programme_b;
  begin
    insert into public.class_sections (offering_id, programme_id, label, capacity)
      values (offering_id, programme_b, 'B', 10);
    raise exception 'FAIL: class accepted an inactive programme';
  exception when others then
    if sqlerrm not like 'Select an active programme%' then raise; end if;
  end;
end;
$$;
rollback;
select 'Passed: admin, lecturer and student access; class programme foreign key; active-programme validation; safe programme edits and enrolment matching. All fixtures rolled back.' as result;
