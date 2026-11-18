-- All fixtures, notifications and pg_net dispatches roll back. No real marks
-- are edited and no push can be committed by this regression transaction.
begin;
do $$
declare
  lect uuid; other_lect uuid; admin uuid; student uuid; student_auth uuid; second_student uuid;
  term uuid; programme uuid; subject uuid; offering uuid; section uuid; second_section uuid;
  enrol uuid; enrol2 uuid; assessment uuid; assessment2 uuid; mark uuid; issue uuid; issue2 uuid; req uuid; rejected_req uuid;
  result jsonb; before_total numeric; original_release uuid:=gen_random_uuid(); invalid_score numeric; legacy_status text;
  fixture text:='CORR'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
  select id into lect from public.profiles where role='lecturer' and is_active limit 1;
  select id into other_lect from public.profiles where role='lecturer' and is_active and id<>lect limit 1;
  select id into admin from public.profiles where role='admin' and is_active limit 1;
  select s.id,s.auth_user_id,s.programme_id into student,student_auth,programme from public.students s where s.is_active and s.auth_user_id is not null limit 1;
  select id into term from public.academic_terms where is_current and status='active';
  if lect is null or other_lect is null or admin is null or student is null or term is null then raise exception 'Missing regression prerequisites'; end if;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  insert into public.subjects(code,name) values(fixture,'Correction fixture') returning id into subject;
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_id,programme_semester,status,carry_max)
    values(subject,term,lect,programme,5,'active',50) returning id into offering;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(offering,programme,'Fixture A',20,fixture||'A') returning id into section;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(offering,programme,'Fixture B',20,fixture||'B') returning id into second_section;
  insert into public.enrolments(section_id,student_id) values(section,student) returning id into enrol;
  insert into public.students(matrix_no,full_name,programme_id) values(fixture,'Isolated second student',programme) returning id into second_student;
  insert into public.enrolments(section_id,student_id) values(second_section,second_student) returning id into enrol2;
  insert into public.assessments(offering_id,name,assessment_type,max_score,carry_weight,position,is_published)
    values(offering,'Quiz One','Quiz',50,40,1,false) returning id into assessment;
  insert into public.assessments(offering_id,name,assessment_type,max_score,carry_weight,position,is_published)
    values(offering,'Test Two','Test',10,10,2,false) returning id into assessment2;
  insert into public.marks(enrolment_id,assessment_id,score,entered_by) values(enrol,assessment,33,lect) returning id into mark;
  insert into public.marks(enrolment_id,assessment_id,score,entered_by) values(enrol,assessment2,6.6,lect),(enrol2,assessment,20,lect);
  insert into public.submissions(section_id,status,finalised_by,finalised_at,release_id)
    values(section,'finalised',lect,now(),original_release),(second_section,'finalised',lect,now(),gen_random_uuid());
  -- Existing total formula: 33/50*40 + 6.6/10*10 = 33.
  update public.academic_terms set eligible_threshold=40 where id=term;
  select total_carry into before_total from public.student_carry_totals where enrolment_id=enrol;
  if before_total<>33 then raise exception 'Fixture total is wrong'; end if;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  issue:=public.submit_student_mark_issue(enrol,assessment,'Please review this mark.', '11111111-1111-4111-8111-111111111111');
  if public.submit_student_mark_issue(enrol,assessment,'Please review this mark.','11111111-1111-4111-8111-111111111111')<>issue then raise exception 'Report retry was not idempotent'; end if;
  begin
    perform public.submit_student_mark_issue(enrol2,assessment,'IDOR attempt',gen_random_uuid()); raise exception 'Student IDOR allowed';
  exception when others then if sqlerrm not like 'CAMS: You are not enrolled%' then raise; end if; end;
  -- Student workspace cannot leak private correction fields.
  result:=public.get_my_mark_issue_workspace(offering);
  if jsonb_array_length(result->'issues')<>1 then raise exception 'Student issue missing'; end if;
  perform set_config('request.jwt.claim.sub',other_lect::text,true);
  begin perform public.get_staff_mark_issues(offering); raise exception 'Other lecturer read allowed';
  exception when others then if sqlerrm not like 'CAMS: Only the assigned lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  if jsonb_array_length(public.get_staff_mark_issues(offering))<>1 then raise exception 'Assigned lecturer cannot see issue'; end if;
  -- Only Reject or Correct Mark are valid lecturer outcomes.
  begin perform public.respond_to_mark_issue(issue,'reviewing','Review underway.'); raise exception 'Reviewing outcome still allowed';
  exception when others then if sqlerrm not like 'CAMS: Reject requires%' then raise; end if; end;
  begin perform public.respond_to_mark_issue(issue,'resolved','Checked.'); raise exception 'Resolve outcome still allowed';
  exception when others then if sqlerrm not like 'CAMS: Reject requires%' then raise; end if; end;
  begin perform public.respond_to_mark_issue(issue,'rejected',' '); raise exception 'Blank rejection allowed';
  exception when others then if sqlerrm not like 'CAMS: Reject requires%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  issue2:=public.submit_student_mark_issue(enrol,assessment2,'Check this assessment.',gen_random_uuid());
  perform set_config('request.jwt.claim.sub',lect::text,true);
  perform public.respond_to_mark_issue(issue2,'rejected','Checked; the existing mark is correct.');
  if not exists(select 1 from public.mark_disputes where id=issue2 and status='rejected' and responded_by=lect
    and responded_at is not null and response='Checked; the existing mark is correct.') then raise exception 'Rejection audit incomplete'; end if;
  if not exists(select 1 from public.mark_correction_events where dispute_id=issue2 and action='report_rejected' and actor_id=lect) then raise exception 'Rejection event missing'; end if;
  if (select score from public.marks where enrolment_id=enrol and assessment_id=assessment2)<>6.6 then raise exception 'Reject changed score'; end if;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  if not exists(select 1 from jsonb_array_elements(public.get_my_mark_issue_workspace(offering)->'issues') q
    where q->>'id'=issue2::text and q->>'status'='rejected' and q->>'response'='Checked; the existing mark is correct.') then raise exception 'Student cannot see rejection response'; end if;
  begin perform public.stage_mark_issue_correction(issue,43,'Student attempt'); raise exception 'Student correction allowed';
  exception when others then if sqlerrm not like 'CAMS: This mark issue is not available%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  begin perform public.respond_to_mark_issue(issue,'rejected','Admin attempt'); raise exception 'Admin rejection allowed';
  exception when others then if sqlerrm not like 'CAMS: This mark issue is not available%' then raise; end if; end;
  begin perform public.stage_mark_issue_correction(issue,43,'Admin attempt'); raise exception 'Admin correction allowed';
  exception when others then if sqlerrm not like 'CAMS: This mark issue is not available%' then raise; end if; end;
  begin perform public.review_mark_correction(gen_random_uuid(),true,'Admin attempt'); raise exception 'Admin approval still available';
  exception when others then if sqlerrm not like 'CAMS: This approval workflow has retired%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',other_lect::text,true);
  begin perform public.stage_mark_issue_correction(issue,43,'Other lecturer attempt'); raise exception 'Other lecturer correction allowed';
  exception when others then if sqlerrm not like 'CAMS: This mark issue is not available%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  begin perform public.stage_mark_issue_correction(issue,43,' '); raise exception 'Blank correction reason allowed';
  exception when others then if sqlerrm not like 'CAMS: A correction reason%' then raise; end if; end;
  foreach invalid_score in array array[null::numeric,-1,51,43.001,'NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric] loop
    begin perform public.stage_mark_issue_correction(issue,invalid_score,'Verified entry error.'); raise exception 'Invalid score allowed';
    exception when others then if sqlerrm not like 'CAMS: Enter a score from 0%' then raise; end if; end;
  end loop;
  begin perform public.stage_mark_issue_correction(issue,33,'Unchanged entry'); raise exception 'Unchanged score allowed';
  exception when others then if sqlerrm not like 'CAMS: The corrected score must differ%' then raise; end if; end;
  req:=public.stage_mark_issue_correction(issue,43,'Evidence verified; initial score incorrect.');
  if public.stage_mark_issue_correction(issue,43,'Evidence verified; initial score incorrect.')<>req then raise exception 'Draft retry not idempotent'; end if;
  begin perform public.stage_mark_issue_correction(issue,44,'Different stale action'); raise exception 'Stale draft overwrite allowed';
  exception when others then if sqlerrm not like 'CAMS: A correction is already awaiting release%' then raise; end if; end;
  if not exists(select 1 from public.mark_correction_requests where id=req and status='corrected' and reviewed_by is null and reviewed_at is null) then raise exception 'Correction still requires review'; end if;
  -- Drafts and client flags are never direct-table unlocks.
  begin update public.marks set score=43 where id=mark; raise exception 'Draft direct write allowed';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  begin update public.marks set score=8 where enrolment_id=enrol and assessment_id=assessment2; raise exception 'Other assessment unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  begin update public.marks set score=25 where enrolment_id=enrol2 and assessment_id=assessment; raise exception 'Other student unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  begin perform set_config('cams.correction_approved','true',true); update public.marks set score=43 where id=mark; raise exception 'Client flag unlocked marks';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  if (select score from public.marks where id=mark)<>33 then raise exception 'Draft score published'; end if;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  result:=public.get_my_mark_issue_workspace(offering);
  if result::text like '%corrected_score%' or result::text like '%decision_note%' or result::text like '%Evidence verified%' then raise exception 'Private draft data leaked'; end if;
  if not exists(select 1 from jsonb_array_elements(result->'issues') q where q->>'id'=issue::text and q->>'correction_status'='corrected') then raise exception 'Draft progress missing'; end if;
  if not exists(select 1 from jsonb_array_elements(public.get_my_mobile_portal()->'subjects') q
    where q->>'offering_id'=offering::text and (q->>'carry_mark')::numeric=33 and (q->>'eligible')::boolean=false) then raise exception 'Student portal leaked draft total'; end if;
  -- A rejected private draft cannot be released. Also exercise legacy pending
  -- and approved requests without deleting their original review history.
  foreach legacy_status in array array['pending','approved','corrected'] loop
    issue2:=public.submit_student_mark_issue(enrol,assessment2,'New evidence on this mark.',gen_random_uuid());
    perform set_config('request.jwt.claim.sub',lect::text,true);
    rejected_req:=public.stage_mark_issue_correction(issue2,7,'Review new evidence.');
    update public.mark_correction_requests set status=legacy_status,
      reviewed_by=case when legacy_status='approved' then admin else null end,
      reviewed_at=case when legacy_status='approved' then now() else null end,
      decision_note=case when legacy_status='approved' then 'Historical approval' else null end,
      corrected_score=case when legacy_status='corrected' then 7 else null end where id=rejected_req;
    if legacy_status<>'corrected' then
      if public.stage_mark_issue_correction(issue2,7,'Confirmed entry error.')<>rejected_req then raise exception 'Legacy request not reused'; end if;
      if legacy_status='approved' and not exists(select 1 from public.mark_correction_requests where id=rejected_req and reviewed_by=admin and decision_note='Historical approval') then raise exception 'Historical review lost'; end if;
    end if;
    perform public.respond_to_mark_issue(issue2,'rejected','Further checks confirm the existing score.');
    begin perform public.release_corrected_mark(rejected_req); raise exception 'Rejected draft released';
    exception when others then if sqlerrm not like 'CAMS: This report is already closed%' then raise; end if; end;
    perform set_config('request.jwt.claim.sub',student_auth::text,true);
  end loop;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  begin perform public.release_corrected_mark(req); raise exception 'Admin release allowed';
  exception when others then if sqlerrm not like 'CAMS: Only the assigned lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  -- Reject stale class-release identities and stale mark versions atomically.
  begin
    update public.submissions set release_id=gen_random_uuid() where section_id=section;
    begin perform public.release_corrected_mark(req); raise exception 'Stale class release allowed';
    exception when others then if sqlerrm not like 'CAMS: The class release has changed%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  begin
    update public.mark_correction_requests set original_version=original_version+1 where id=req;
    begin perform public.release_corrected_mark(req); raise exception 'Stale mark version allowed';
    exception when others then if sqlerrm not like 'CAMS: The mark has changed%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  begin
    update public.academic_terms set is_current=false,status='closed' where id=term;
    begin perform public.respond_to_mark_issue(issue,'rejected','Archived rejection'); raise exception 'Archived rejection allowed';
    exception when others then if sqlerrm not like 'CAMS: Previous-semester%' then raise; end if; end;
    begin perform public.stage_mark_issue_correction(issue,43,'Archived staging'); raise exception 'Archived staging allowed';
    exception when others then if sqlerrm not like 'CAMS: Previous-semester%' then raise; end if; end;
    begin perform public.release_corrected_mark(req); raise exception 'Archived correction allowed';
    exception when others then if sqlerrm not like 'CAMS: Previous-semester%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  perform public.release_corrected_mark(req);
  perform public.release_corrected_mark(req); -- Retry must not notify twice.
  if (select score from public.marks where id=mark)<>43 then raise exception 'Correction not released'; end if;
  if (select total_carry from public.student_carry_totals where enrolment_id=enrol)<>41 then raise exception 'Carry total not recalculated'; end if;
  if not (select eligible from public.student_carry_totals where enrolment_id=enrol) then raise exception 'Eligibility not recalculated'; end if;
  if (select release_id from public.submissions where section_id=section)<>original_release
    or (select status from public.submissions where section_id=section)<>'finalised' then raise exception 'Class release was changed'; end if;
  if (select score from public.marks where enrolment_id=enrol and assessment_id=assessment2)<>6.6
    or (select score from public.marks where enrolment_id=enrol2 and assessment_id=assessment)<>20 then raise exception 'Other mark changed'; end if;
  if (select count(*) from public.notifications where release_id=req and student_id=student and type='marks_released')<>1 then raise exception 'Notification duplicated or missing'; end if;
  if (select count(*) from public.mark_correction_events where request_id=req)<>2 then raise exception 'Correction events incomplete/duplicated'; end if;
  if not exists(select 1 from public.mark_correction_requests where id=req and original_score=33 and corrected_score=43 and status='released'
    and lecturer_id=lect and reviewed_by is null and corrected_at is not null and released_at is not null) then raise exception 'Correction audit incomplete'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=req and actor_id=lect and action='released mark correction'
    and (old_data->>'score')::numeric=33 and (new_data->>'score')::numeric=43 and new_data->>'reason'='Evidence verified; initial score incorrect.') then raise exception 'Release audit log incomplete'; end if;
  if exists(select 1 from cams_private.mark_release_permits) then raise exception 'Release permit survived'; end if;
  begin update public.marks set score=44 where id=mark; raise exception 'Mark stayed unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  if not exists(select 1 from jsonb_array_elements(public.get_my_mobile_portal()->'subjects') q
    where q->>'offering_id'=offering::text and (q->>'carry_mark')::numeric=41 and (q->>'eligible')::boolean=true) then raise exception 'Student portal has wrong corrected total/eligibility'; end if;
  if not exists(select 1 from jsonb_array_elements(public.get_my_mark_issue_workspace(offering)->'issues') q
    where q->>'id'=issue::text and q->>'status'='resolved' and q->>'correction_status'='released'
    and q->>'response'='Evidence verified; initial score incorrect.') then raise exception 'Student corrected outcome missing'; end if;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  if has_table_privilege('authenticated','public.mark_correction_requests','UPDATE')
    or has_table_privilege('authenticated','public.mark_correction_events','INSERT')
    or has_table_privilege('authenticated','cams_private.mark_release_permits','INSERT')
    or has_function_privilege('anon','public.release_corrected_mark(uuid)','EXECUTE')
    or has_function_privilege('anon','public.stage_mark_issue_correction(uuid,numeric,text)','EXECUTE')
    or has_function_privilege('authenticated','public.review_mark_correction(uuid,boolean,text)','EXECUTE')
    or has_function_privilege('authenticated','public.request_mark_correction(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.update_approved_mark(uuid,numeric)','EXECUTE')
    or has_function_privilege('authenticated','public.get_mark_correction_queue()','EXECUTE')
    or has_function_privilege('authenticated','public.get_mark_correction_pending_count()','EXECUTE') then raise exception 'Correction permissions too broad'; end if;
  perform set_config('cams.test.assessment2',assessment2::text,true);
  perform set_config('cams.test.admin',admin::text,true);
  perform set_config('cams.test.mark',mark::text,true);
  perform set_config('cams.test.student',student_auth::text,true);
  perform set_config('cams.test.lecturer',lect::text,true);
  perform set_config('cams.test.enrolment',enrol::text,true);
  perform set_config('cams.test.offering',offering::text,true);
end;
$$;
-- Actual authenticated-role/RLS checks, not just SECURITY DEFINER calls under postgres.
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('cams.test.lecturer'),true);
select jsonb_array_length(public.get_staff_mark_issues(current_setting('cams.test.offering')::uuid)) as authenticated_lecturer_issues;
do $$ begin
  begin update public.marks set score=44 where id=current_setting('cams.test.mark')::uuid;
    raise exception 'Authenticated lecturer directly changed Released mark';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cams.test.student'),true);
do $$ begin
  if not exists(select 1 from public.marks where id=current_setting('cams.test.mark')::uuid and score=43) then raise exception 'Student cannot read corrected Released mark'; end if;
  begin perform 1 from public.mark_correction_requests; raise exception 'Student can read private correction drafts';
  exception when insufficient_privilege then null; end;
end $$;
-- Exercise the new write RPCs under the actual authenticated role as well.
select set_config('cams.test.extra_issue',public.submit_student_mark_issue(
  current_setting('cams.test.enrolment')::uuid,current_setting('cams.test.assessment2')::uuid,
  'Authenticated role fixture',gen_random_uuid())::text,true);
select set_config('request.jwt.claim.sub',current_setting('cams.test.lecturer'),true);
select public.stage_mark_issue_correction(current_setting('cams.test.extra_issue')::uuid,0,'Authenticated lecturer checked script.');
select public.respond_to_mark_issue(current_setting('cams.test.extra_issue')::uuid,'rejected','Further check confirms published score.');
select set_config('request.jwt.claim.sub',current_setting('cams.test.admin'),true);
do $$ begin
  begin perform public.review_mark_correction(gen_random_uuid(),true,null); raise exception 'Authenticated Admin can still approve';
  exception when insufficient_privilege then null; end;
  begin perform public.stage_mark_issue_correction(current_setting('cams.test.extra_issue')::uuid,7,'Admin attempt'); raise exception 'Authenticated Admin can correct';
  exception when others then if sqlerrm not like 'CAMS: This mark issue is not available%' then raise; end if; end;
end $$;
rollback;
