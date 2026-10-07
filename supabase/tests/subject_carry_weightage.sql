-- Run against the linked database after applying the migration. All fixtures roll back.
begin;
do $$
declare
  test_section_id uuid := gen_random_uuid();
  test_student_id uuid := gen_random_uuid();
  test_enrolment_id uuid := gen_random_uuid();
  assessment_a uuid := gen_random_uuid();
  assessment_b uuid := gen_random_uuid();
  lecturer_a uuid := gen_random_uuid();
  lecturer_b uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  programme uuid := gen_random_uuid();
  term uuid := gen_random_uuid();
  first_offering uuid;
  second_offering uuid;
  test_subject_id uuid;
  test_code text := 'TEST' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  insert into auth.users (id) values (lecturer_a), (lecturer_b), (admin_id);
  insert into public.programmes (id, code, name) values (programme, test_code, 'Temporary test programme');
  insert into public.profiles (id, staff_no, full_name, role) values
    (lecturer_a, test_code || 'A', 'Test Lecturer A', 'lecturer'),
    (lecturer_b, test_code || 'B', 'Test Lecturer B', 'lecturer'),
    (admin_id, test_code || 'C', 'Test Admin', 'admin');
  update public.academic_terms set is_current = false where is_current;
  insert into public.academic_terms (id, academic_year, semester_no, starts_on, ends_on, default_deadline, status, is_current)
    values (term, test_code, 1, '2026-01-01', '2026-12-31', '2026-12-01', 'active', true);

  perform set_config('request.jwt.claim.sub', lecturer_a::text, true);
  first_offering := public.create_lecturer_subject(' ' || lower(test_code) || ' ', 'Test Subject', 3);
  if (select carry_max from public.subject_offerings where id = first_offering) is not null then raise exception 'New subject must require weightage setup'; end if;
  perform public.set_offering_carry_max(first_offering, 60);
  select so.subject_id into test_subject_id from public.subject_offerings so where id = first_offering;
  insert into public.class_sections(id, offering_id, programme_id, label, capacity) values (test_section_id, first_offering, programme, 'Test', 10);
  insert into public.students(id, matrix_no, full_name, programme_id) values (test_student_id, test_code, 'Test Student', programme);
  insert into public.enrolments(id, section_id, student_id) values (test_enrolment_id, test_section_id, test_student_id);
  insert into public.assessments(id, offering_id, name, assessment_type, max_score, carry_weight, position) values
    (assessment_a, first_offering, 'Quiz', 'Quiz', 20, 20, 1),
    (assessment_b, first_offering, 'Project', 'Project', 40, 40, 2);
  insert into public.marks(enrolment_id, assessment_id, score, entered_by) values
    (test_enrolment_id, assessment_a, 10, lecturer_a), (test_enrolment_id, assessment_b, 30, lecturer_a);
  if (select total_carry from public.student_carry_totals t where t.enrolment_id = test_enrolment_id) <> 40 then raise exception 'Weighted total is wrong'; end if;
  begin
    perform public.set_offering_carry_max(first_offering, 50);
    raise exception 'FAIL: lowering below allocation allowed';
  exception when others then if sqlerrm not like 'Total weightage cannot%' then raise; end if; end;
  begin
    insert into public.assessments(offering_id, name, assessment_type, max_score, carry_weight, position) values(first_offering, 'Extra', 'Quiz', 10, 1, 3);
    raise exception 'FAIL: allocation overflow allowed';
  exception when others then if sqlerrm not like 'Assessment weightage exceeds%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', lecturer_b::text, true);
  begin
    perform public.set_offering_carry_max(first_offering, 70);
    raise exception 'FAIL: another lecturer could change weightage';
  exception when others then if sqlerrm not like 'Only the active lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', lecturer_a::text, true);
  perform public.finalise_section(test_section_id);
  if not exists (select 1 from public.submissions s where s.section_id = test_section_id and status = 'finalised') then raise exception 'Finalisation at 60 failed'; end if;
  begin
    perform public.set_offering_carry_max(first_offering, 70);
    raise exception 'FAIL: finalised weightage could change';
  exception when others then if sqlerrm not like 'Reopen finalised%' then raise; end if; end;

end;
$$;
rollback;
select 'Passed: lecturer-defined 60% total, weighted marks, allocation limits, ownership and finalisation locks. All fixtures rolled back.' as result;
