-- Run after 202610090001. All fixtures and finalisation changes roll back.
begin;
do $$
<<student_mark_release>>
declare
  lecturer_id uuid := gen_random_uuid(); student_auth_id uuid := gen_random_uuid();
  student_id uuid := gen_random_uuid(); programme_id uuid := gen_random_uuid();
  term_id uuid := gen_random_uuid(); subject_id uuid := gen_random_uuid();
  offering_id uuid := gen_random_uuid(); section_id uuid := gen_random_uuid();
  enrolment_id uuid := gen_random_uuid(); assessment_id uuid := gen_random_uuid();
  test_code text := 'MR' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  portal jsonb; visible_marks bigint;
begin
  insert into auth.users(id) values (lecturer_id), (student_auth_id);
  insert into public.profiles(id, staff_no, full_name, role)
    values (lecturer_id, test_code, 'Release Test Lecturer', 'lecturer');
  insert into public.programmes(id, code, name)
    values (programme_id, test_code, 'Release Test Programme');
  update public.academic_terms set is_current = false where is_current;
  insert into public.academic_terms(id, academic_year, semester_code, semester_no, starts_on, ends_on, default_deadline, carry_max, eligible_threshold, status, is_current)
    values (term_id, test_code, '20261', 1, '2026-01-01', '2026-12-31', '2026-12-01', 50, 40, 'active', true);
  insert into public.subjects(id, code, name) values (subject_id, test_code, 'Release Test Subject');
  insert into public.subject_offerings(id, subject_id, term_id, lecturer_id, programme_id, programme_semester, carry_max, status)
    values (offering_id, subject_id, term_id, lecturer_id, programme_id, 1, 50, 'active');
  insert into public.class_sections(id, offering_id, programme_id, label, capacity)
    values (section_id, offering_id, programme_id, 'A', 10);
  insert into public.students(id, matrix_no, full_name, programme_id, auth_user_id)
    values (student_id, test_code || 'S', 'Release Test Student', programme_id, student_auth_id);
  insert into public.enrolments(id, section_id, student_id)
    values (enrolment_id, section_id, student_id);
  insert into public.assessments(id, offering_id, name, assessment_type, max_score, carry_weight, position, is_published)
    values (assessment_id, offering_id, 'Test 1', 'Test', 100, 50, 1, false);
  insert into public.marks(enrolment_id, assessment_id, score, entered_by)
    values (enrolment_id, assessment_id, 80, lecturer_id);

  perform set_config('request.jwt.claim.sub', student_auth_id::text, true);
  portal := public.get_my_mobile_portal();
  if portal #>> '{subjects,0,assessments,0,name}' <> 'Test 1' then
    raise exception 'FAIL: draft assessment structure is not visible';
  end if;
  if portal #> '{subjects,0,assessments,0,score}' <> 'null'::jsonb
     or portal #> '{subjects,0,carry_mark}' <> 'null'::jsonb then
    raise exception 'FAIL: draft marks or total leaked through the portal';
  end if;
  execute 'set local role authenticated';
  select count(*) into visible_marks from public.marks where id is not null;
  execute 'reset role';
  if visible_marks <> 0 then raise exception 'FAIL: draft marks leaked through RLS'; end if;

  perform set_config('request.jwt.claim.sub', lecturer_id::text, true);
  execute 'set local role authenticated';
  perform public.finalise_section(section_id);
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', student_auth_id::text, true);
  portal := public.get_my_mobile_portal();
  if (portal #>> '{subjects,0,assessments,0,score}')::numeric <> 80
     or (portal #>> '{subjects,0,carry_mark}')::numeric <> 40 then
    raise exception 'FAIL: finalised marks were not released';
  end if;
  if jsonb_array_length(portal->'notifications') <> 1 then
    raise exception 'FAIL: finalisation notification was not produced';
  end if;

  execute 'set local role authenticated';
  if public.set_my_notification_alerts_enabled(false) is distinct from false then
    raise exception 'FAIL: notification preference was not disabled';
  end if;
  execute 'reset role';
  portal := public.get_my_mobile_portal();
  if (portal->>'notifications_enabled')::boolean
     or jsonb_array_length(portal->'notifications') <> 0 then
    raise exception 'FAIL: disabled student still received notification alerts';
  end if;
  if (portal #>> '{subjects,0,carry_mark}')::numeric <> 40 then
    raise exception 'FAIL: disabling alerts changed finalised carry-mark visibility';
  end if;

  execute 'set local role authenticated';
  if public.set_my_notification_alerts_enabled(true) is distinct from true then
    raise exception 'FAIL: notification preference was not enabled';
  end if;
  execute 'reset role';
  portal := public.get_my_mobile_portal();
  if not (portal->>'notifications_enabled')::boolean
     or jsonb_array_length(portal->'notifications') <> 1 then
    raise exception 'FAIL: enabled student did not receive notification alerts';
  end if;

  execute 'set local role authenticated';
  select count(*) into visible_marks from public.marks where enrolment_id = student_mark_release.enrolment_id;
  execute 'reset role';
  if visible_marks <> 1 then raise exception 'FAIL: finalised mark is not readable through RLS'; end if;
end;
$$;
rollback;
select 'Passed: draft assessment visibility, draft mark/total privacy, finalised release, direct RLS, and per-student notification preference.' as result;
