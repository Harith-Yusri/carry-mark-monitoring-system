-- All fixtures, notifications and pg_net dispatches roll back. No real marks
-- are edited and no push can be committed by this regression transaction.
begin;
do $$
declare
  lect uuid; other_lect uuid; admin uuid; student uuid; student_auth uuid; second_student uuid;
  term uuid; programme uuid; subject uuid; offering uuid; section uuid; second_section uuid;
  enrol uuid; enrol2 uuid; assessment uuid; assessment2 uuid; mark uuid; issue uuid; issue2 uuid; req uuid; rejected_req uuid;
  result jsonb; before_total numeric; original_release uuid:=gen_random_uuid(); bad boolean;
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
  perform public.respond_to_mark_issue(issue,'reviewing','Review underway.');
  -- A correct mark can be resolved without Admin involvement.
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  issue2:=public.submit_student_mark_issue(enrol,assessment2,'Check this assessment.',gen_random_uuid());
  perform set_config('request.jwt.claim.sub',lect::text,true);
  perform public.respond_to_mark_issue(issue2,'resolved','Checked; this mark is correct.');
  if (select status from public.mark_disputes where id=issue2)<>'resolved' then raise exception 'Direct resolution failed'; end if;
  rejected_req:=public.request_mark_correction(issue,'Incorrect initial entry.');
  begin perform public.update_approved_mark(rejected_req,43); raise exception 'Pending correction editable';
  exception when others then if sqlerrm not like 'CAMS: This mark is not approved%' then raise; end if; end;
  begin perform public.request_mark_correction(issue,'Duplicate request'); raise exception 'Duplicate correction allowed';
  exception when others then if sqlerrm not like 'CAMS: An active correction request%' then raise; end if; end;
  begin perform public.review_mark_correction(rejected_req,true,'Self approval'); raise exception 'Lecturer approval allowed';
  exception when others then if sqlerrm<>'CAMS: Administrator approval is required.' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  if public.get_mark_correction_pending_count()<1 then raise exception 'Admin pending count missing'; end if;
  if not exists(select 1 from jsonb_array_elements(public.get_mark_correction_queue()) q where q->>'id'=rejected_req::text) then raise exception 'Admin request missing'; end if;
  perform public.review_mark_correction(rejected_req,false,'Evidence needed.');
  perform set_config('request.jwt.claim.sub',lect::text,true);
  begin perform public.update_approved_mark(rejected_req,43); raise exception 'Rejected correction editable';
  exception when others then if sqlerrm not like 'CAMS: This mark is not approved%' then raise; end if; end;
  req:=public.request_mark_correction(issue,'Evidence verified; initial score incorrect.');
  perform set_config('request.jwt.claim.sub',admin::text,true);
  perform public.review_mark_correction(req,true,'Approved for this cell only.');
  begin perform public.review_mark_correction(req,true,'Race'); raise exception 'Double approval allowed';
  exception when others then if sqlerrm not like 'CAMS: This request has already been reviewed%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  -- Bare approval is not a direct-table unlock, even for a privileged runner.
  begin update public.marks set score=43 where id=mark; raise exception 'Approved direct write allowed';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  begin update public.marks set score=8 where enrolment_id=enrol and assessment_id=assessment2; raise exception 'Other assessment unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  begin update public.marks set score=25 where enrolment_id=enrol2 and assessment_id=assessment; raise exception 'Other student unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  begin perform set_config('cams.correction_approved','true',true); update public.marks set score=43 where id=mark; raise exception 'Client flag unlocked marks';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',other_lect::text,true);
  begin perform public.update_approved_mark(req,43); raise exception 'Other lecturer correction allowed';
  exception when others then if sqlerrm not like 'CAMS: This mark issue is not available%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  begin perform public.update_approved_mark(req,51); raise exception 'Score exceeds maximum';
  exception when others then if sqlerrm not like 'CAMS: Enter a score from 0%' then raise; end if; end;
  perform public.update_approved_mark(req,43);
  if (select score from public.marks where id=mark)<>33 then raise exception 'Draft correction leaked into Released mark'; end if;
  begin perform public.update_approved_mark(req,44); raise exception 'Approval consumed twice';
  exception when others then if sqlerrm not like 'CAMS: This mark is not approved%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  result:=public.get_my_mark_issue_workspace(offering);
  if result::text like '%corrected_score%' or result::text like '%decision_note%' or result::text like '%Evidence verified%' then raise exception 'Student draft/internal data leaked'; end if;
  if not exists(select 1 from jsonb_array_elements(result->'issues') q where q->>'id'=issue::text and q->>'correction_status'='corrected') then raise exception 'Student correction status missing'; end if;
  if not exists(select 1 from jsonb_array_elements(public.get_my_mobile_portal()->'subjects') q
    where q->>'offering_id'=offering::text and (q->>'carry_mark')::numeric=33 and (q->>'eligible')::boolean=false) then
    raise exception 'Student portal leaked draft corrected carry total';
  end if;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  -- Admin can revoke an unused approval without touching the Released score.
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  issue2:=public.submit_student_mark_issue(enrol,assessment2,'New evidence on this mark.',gen_random_uuid());
  perform set_config('request.jwt.claim.sub',lect::text,true);
  rejected_req:=public.request_mark_correction(issue2,'Review new evidence.');
  perform set_config('request.jwt.claim.sub',admin::text,true);
  perform public.review_mark_correction(rejected_req,true,null);
  perform set_config('request.jwt.claim.sub',lect::text,true);
  perform public.update_approved_mark(rejected_req,7);
  perform set_config('request.jwt.claim.sub',admin::text,true);
  perform public.review_mark_correction(rejected_req,false,'Approval revoked pending more evidence.');
  perform set_config('request.jwt.claim.sub',lect::text,true);
  begin perform public.release_corrected_mark(rejected_req); raise exception 'Revoked draft was released';
  exception when others then if sqlerrm not like 'CAMS: Save the approved correction%' then raise; end if; end;
  if (select score from public.marks where enrolment_id=enrol and assessment_id=assessment2)<>6.6 then raise exception 'Revocation changed a mark'; end if;
  -- Concurrency conflict: changed release identity invalidates the approval.
  begin
    update public.submissions set release_id=gen_random_uuid() where section_id=section;
    begin perform public.release_corrected_mark(req); raise exception 'Stale release allowed';
    exception when others then if sqlerrm not like 'CAMS: The class release has changed%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  -- Archive protection applies to review, correction, and re-release.
  begin
    update public.academic_terms set is_current=false,status='closed' where id=term;
    begin perform public.release_corrected_mark(req); raise exception 'Archived correction allowed';
    exception when others then if sqlerrm not like 'CAMS: Previous-semester%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  perform public.release_corrected_mark(req);
  perform public.release_corrected_mark(req); -- retry must not notify twice
  if (select score from public.marks where id=mark)<>43 then raise exception 'Correction not released'; end if;
  if (select total_carry from public.student_carry_totals where enrolment_id=enrol)<>41 then raise exception 'Carry total not recalculated'; end if;
  if not (select eligible from public.student_carry_totals where enrolment_id=enrol) then raise exception 'Eligibility not recalculated'; end if;
  if (select release_id from public.submissions where section_id=section)<>original_release then raise exception 'Class release was changed'; end if;
  if (select count(*) from public.notifications where release_id=req and student_id=student and type='marks_released')<>1 then raise exception 'Notification duplicated or missing'; end if;
  if (select count(*) from public.mark_correction_events where request_id=req)<>4 then raise exception 'Audit events incomplete'; end if;
  if not exists(select 1 from public.mark_correction_requests where id=req and original_score=33 and corrected_score=43 and status='released' and reviewed_by=admin and released_at is not null) then raise exception 'Audit request incomplete'; end if;
  if exists(select 1 from cams_private.mark_release_permits) then raise exception 'Release permit survived'; end if;
  begin update public.marks set score=44 where id=mark; raise exception 'Mark stayed unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  if not exists(select 1 from jsonb_array_elements(public.get_my_mobile_portal()->'subjects') q
    where q->>'offering_id'=offering::text and (q->>'carry_mark')::numeric=41 and (q->>'eligible')::boolean=true) then
    raise exception 'Student portal did not return corrected carry/eligibility';
  end if;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  if has_table_privilege('authenticated','public.mark_correction_requests','UPDATE')
    or has_table_privilege('authenticated','public.mark_correction_events','INSERT')
    or has_table_privilege('authenticated','cams_private.mark_release_permits','INSERT')
    or has_function_privilege('anon','public.release_corrected_mark(uuid)','EXECUTE') then raise exception 'Correction permissions too broad'; end if;
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
rollback;
