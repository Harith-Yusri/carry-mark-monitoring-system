-- All fixtures, notifications and pg_net dispatches roll back. No real marks
-- are edited and no push can be committed by this regression transaction.
begin;
do $$
declare
  lect uuid; other_lect uuid; admin uuid; student uuid; student_auth uuid; second_student uuid;
  term uuid; programme uuid; subject uuid; offering uuid; section uuid; second_section uuid;
  enrol uuid; enrol2 uuid; assessment uuid; assessment2 uuid; mark uuid; issue uuid; issue2 uuid; req uuid; rejected_req uuid;
  result jsonb; before_total numeric; original_release uuid:=gen_random_uuid(); invalid_score numeric; legacy_status text; v integer; v2 integer; foreign_offering uuid; foreign_assessment uuid;
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
  select version into v from public.marks where id=mark;
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_id,programme_semester,status,carry_max)
    values(subject,term,other_lect,programme,6,'active',50) returning id into foreign_offering;
  insert into public.assessments(offering_id,name,assessment_type,max_score,carry_weight,position)
    values(foreign_offering,'Other lecturer assessment','Test',100,50,1) returning id into foreign_assessment;
  result:=public.get_released_mark_correction_context(section,enrol,assessment);
  if (result->>'current_score')::numeric<>33 or (result->>'maximum_score')::numeric<>50 or (result->>'version')::integer<>v then raise exception 'Wrong correction context'; end if;
  if result->'correction'<>'null'::jsonb then raise exception 'Unexpected initial draft'; end if;
  -- IDs must agree with the class; the score cannot bypass maximum/precision.
  begin perform public.get_released_mark_correction_context(section,enrol2,assessment); raise exception 'Other class student accepted';
  exception when others then if sqlerrm not like 'CAMS: The student and assessment%' then raise; end if; end;
  begin perform public.stage_released_mark_correction(section,enrol,foreign_assessment,v,43,'ID manipulation'); raise exception 'Foreign assessment accepted';
  exception when others then if sqlerrm not like 'CAMS: The student and assessment%' then raise; end if; end;
  begin perform public.stage_released_mark_correction(section,enrol2,assessment,v,43,'ID manipulation'); raise exception 'Other student accepted';
  exception when others then if sqlerrm not like 'CAMS: The student and assessment%' then raise; end if; end;
  foreach invalid_score in array array[null::numeric,-1,51,43.001,'NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric] loop
    begin perform public.stage_released_mark_correction(section,enrol,assessment,v,invalid_score,'Entry error'); raise exception 'Invalid score accepted';
    exception when others then if sqlerrm not like 'CAMS: Enter a score from 0%' then raise; end if; end;
  end loop;
  begin perform public.stage_released_mark_correction(section,enrol,assessment,v,33,'Unchanged'); raise exception 'Unchanged correction accepted';
  exception when others then if sqlerrm not like 'CAMS: The corrected score must differ%' then raise; end if; end;
  begin perform public.stage_released_mark_correction(section,enrol,assessment,v,43,' '); raise exception 'Blank reason accepted';
  exception when others then if sqlerrm not like 'CAMS: A correction reason%' then raise; end if; end;
  begin perform public.stage_released_mark_correction(section,enrol,assessment,v+1,43,'Stale'); raise exception 'Stale context accepted';
  exception when others then if sqlerrm not like 'CAMS: The Released mark has changed%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',other_lect::text,true);
  begin perform public.get_released_mark_correction_context(section,enrol,assessment); raise exception 'Wrong lecturer can read draft';
  exception when others then if sqlerrm not like 'CAMS: Only the assigned lecturer%' then raise; end if; end;
  begin perform public.stage_released_mark_correction(section,enrol,assessment,v,43,'Other lecturer'); raise exception 'Wrong lecturer can stage';
  exception when others then if sqlerrm not like 'CAMS: Only the assigned lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  begin perform public.stage_released_mark_correction(section,enrol,assessment,v,43,'Admin'); raise exception 'Admin can stage';
  exception when others then if sqlerrm not like 'CAMS: Only the assigned lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  -- No Student report is required or fabricated.
  result:=public.stage_released_mark_correction(section,enrol,assessment,v,43,'Lecturer found an entry error.');
  req:=(result#>>'{correction,id}')::uuid;
  if req is null or result#>>'{correction,initiation_source}'<>'lecturer' or result#>'{correction,dispute_id}'<>'null'::jsonb
    or (result->>'current_score')::numeric<>33 or (result#>>'{correction,corrected_score}')::numeric<>43 then raise exception 'Staging response/scope incorrect'; end if;
  if exists(select 1 from public.notifications where release_id=req) then raise exception 'Draft correction notified student'; end if;
  if exists(select 1 from public.mark_disputes where offering_id=offering) then raise exception 'Direct correction fabricated student report'; end if;
  if exists(select 1 from public.notifications where type='mark_issue_submitted' and data->>'offeringId'=offering::text) then raise exception 'Direct correction notified lecturer as a student report'; end if;
  result:=public.stage_released_mark_correction(section,enrol,assessment,v,43,'Lecturer found an entry error.');
  if (result#>>'{correction,id}')::uuid<>req or (select count(*) from public.mark_correction_events where request_id=req)<>1 then raise exception 'Save retry duplicated draft/event'; end if;
  begin perform public.stage_released_mark_correction(section,enrol,assessment,v,44,'Changed retry'); raise exception 'Awaiting draft overwritten';
  exception when others then if sqlerrm not like 'CAMS: A correction is already awaiting release%' then raise; end if; end;
  -- A Student report arriving while a direct draft exists cannot silently
  -- overwrite/relabel that draft; there is still only one active correction.
  begin
    perform set_config('request.jwt.claim.sub',student_auth::text,true);
    issue:=public.submit_student_mark_issue(enrol,assessment,'Concurrent report',gen_random_uuid());
    perform set_config('request.jwt.claim.sub',lect::text,true);
    begin perform public.stage_mark_issue_correction(issue,44,'Competing issue correction'); raise exception 'Other entry point overwrote active draft';
    exception when others then if sqlerrm not like 'CAMS: An active correction already exists%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  begin update public.marks set score=43 where id=mark; raise exception 'Direct mark edit unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  select version into v2 from public.marks where enrolment_id=enrol and assessment_id=assessment2;
  result:=public.stage_released_mark_correction(section,enrol,assessment2,v2,7,'Independent second cell draft.');
  rejected_req:=(result#>>'{correction,id}')::uuid;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  if (select score from public.marks where id=mark)<>33 then raise exception 'Private draft published early'; end if;
  if not exists(select 1 from jsonb_array_elements(public.get_my_mobile_portal()->'subjects') q where q->>'offering_id'=offering::text
    and (q->>'carry_mark')::numeric=33 and (q->>'eligible')::boolean=false) then raise exception 'Student sees private corrected carry'; end if;
  if jsonb_array_length(public.get_my_mark_issue_workspace(offering)->'issues')<>0 then raise exception 'Student sees fabricated report'; end if;
  begin perform public.get_released_mark_correction_context(section,enrol,assessment); raise exception 'Student can read private context';
  exception when others then if sqlerrm not like 'CAMS: Only the assigned lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',other_lect::text,true);
  begin perform public.release_corrected_mark(req); raise exception 'Wrong lecturer can release';
  exception when others then if sqlerrm not like 'CAMS: Only the assigned lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lect::text,true);
  begin
    update public.submissions set release_id=gen_random_uuid() where section_id=section;
    begin perform public.release_corrected_mark(req); raise exception 'Stale release accepted';
    exception when others then if sqlerrm not like 'CAMS: The class release has changed%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  begin
    update public.mark_correction_requests set original_version=original_version+1 where id=req;
    begin perform public.release_corrected_mark(req); raise exception 'Stale score version accepted';
    exception when others then if sqlerrm not like 'CAMS: The mark has changed%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  begin
    update public.submissions set status='draft' where section_id=section;
    begin perform public.get_released_mark_correction_context(section,enrol,assessment); raise exception 'Draft class accepted';
    exception when others then if sqlerrm not like 'CAMS: Only an existing Released mark%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  begin
    update public.academic_terms set is_current=false,status='closed' where id=term;
    begin perform public.get_released_mark_correction_context(section,enrol,assessment); raise exception 'Archived context accepted';
    exception when others then if sqlerrm not like 'CAMS: Previous-semester%' then raise; end if; end;
    begin perform public.stage_released_mark_correction(section,enrol,assessment,v,43,'Archived'); raise exception 'Archived save accepted';
    exception when others then if sqlerrm not like 'CAMS: Previous-semester%' then raise; end if; end;
    begin perform public.release_corrected_mark(req); raise exception 'Archived release accepted';
    exception when others then if sqlerrm not like 'CAMS: Previous-semester%' then raise; end if; end;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  perform public.release_corrected_mark(req);
  perform public.release_corrected_mark(req);
  -- A Student-started draft is visible/resumable from the same cell context,
  -- retains its issue link/source, and closes that issue through shared release.
  begin
    perform set_config('request.jwt.claim.sub',student_auth::text,true);
    issue:=public.submit_student_mark_issue(enrol,assessment,'Further student evidence',gen_random_uuid());
    perform set_config('request.jwt.claim.sub',lect::text,true);
    issue2:=public.stage_mark_issue_correction(issue,44,'Student evidence verified.');
    result:=public.get_released_mark_correction_context(section,enrol,assessment);
    if result#>>'{correction,dispute_id}'<>issue::text or result#>>'{correction,initiation_source}'<>'student_issue'
      or result#>>'{correction,id}'<>issue2::text then raise exception 'Student issue link/source lost'; end if;
    perform public.release_corrected_mark(issue2);
    if not exists(select 1 from public.mark_disputes where id=issue and status='resolved') then raise exception 'Shared release did not close student issue'; end if;
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  if (select score from public.marks where id=mark)<>43 or (select version from public.marks where id=mark)<>v+1 then raise exception 'Exact mark not released once'; end if;
  if (select score from public.marks where enrolment_id=enrol and assessment_id=assessment2)<>6.6
    or (select score from public.marks where enrolment_id=enrol2 and assessment_id=assessment)<>20 then raise exception 'Other marks changed'; end if;
  if not exists(select 1 from public.submissions where section_id=section and status='finalised' and release_id=original_release) then raise exception 'Class reopened or release identity changed'; end if;
  if not exists(select 1 from public.student_carry_totals where enrolment_id=enrol and total_carry=41 and eligible) then raise exception 'Carry/eligibility not recalculated'; end if;
  if (select count(*) from public.notifications where release_id=req and type='marks_released')<>1
    or not exists(select 1 from public.notifications where release_id=req and student_id=student and related_entity_id=section) then raise exception 'Notification missing, duplicated or wrong student'; end if;
  if not exists(select 1 from public.mark_correction_requests where id=req and initiation_source='lecturer' and dispute_id is null
    and original_score=33 and corrected_score=43 and reason='Lecturer found an entry error.' and lecturer_id=lect and student_id=student
    and section_id=section and offering_id=offering and assessment_id=assessment and corrected_at is not null and released_at is not null
    and snapshot->>'student_name' is not null and snapshot->>'subject_code'=fixture and snapshot->>'assessment_name'='Quiz One') then raise exception 'Correction audit incomplete'; end if;
  if (select count(*) from public.mark_correction_events where request_id=req)<>2 or not exists(select 1 from public.mark_correction_events
    where request_id=req and dispute_id is null and actor_id=lect and action='released' and (details->>'old_score')::numeric=33
    and (details->>'new_score')::numeric=43 and details->>'reason'='Lecturer found an entry error.') then raise exception 'Event audit incomplete'; end if;
  if not exists(select 1 from public.audit_logs where entity_id=req and actor_id=lect and action='released mark correction'
    and (old_data->>'score')::numeric=33 and (new_data->>'score')::numeric=43 and new_data->>'initiation_source'='lecturer'
    and new_data->>'reason'='Lecturer found an entry error.') then raise exception 'Release audit log incomplete'; end if;
  if exists(select 1 from cams_private.mark_release_permits) then raise exception 'Permit survived'; end if;
  begin update public.marks set score=44 where id=mark; raise exception 'Mark remained unlocked';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
  if has_function_privilege('authenticated','public.stage_exact_mark_correction(uuid,uuid,uuid,numeric,text,uuid,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.lock_released_mark_cell(uuid,uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.stage_released_mark_correction(uuid,uuid,uuid,integer,numeric,text)','EXECUTE')
    or has_table_privilege('authenticated','public.mark_correction_requests','UPDATE') then raise exception 'Grants widened'; end if;
  perform set_config('cams.test.student',student_auth::text,true);
  perform set_config('cams.test.lecturer',lect::text,true);
  perform set_config('cams.test.section',section::text,true);
  perform set_config('cams.test.enrol',enrol::text,true);
  perform set_config('cams.test.assessment2',assessment2::text,true);
  perform set_config('cams.test.version2',v2::text,true);
  perform set_config('cams.test.mark',mark::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('cams.test.lecturer'),true);
do $$ declare result jsonb; begin
  result:=public.stage_released_mark_correction(current_setting('cams.test.section')::uuid,current_setting('cams.test.enrol')::uuid,
    current_setting('cams.test.assessment2')::uuid,current_setting('cams.test.version2')::integer,7,'Independent second cell draft.');
  if result#>>'{correction,initiation_source}'<>'lecturer' then raise exception 'Authenticated lecturer cannot resume draft'; end if;
  begin update public.marks set score=44 where id=current_setting('cams.test.mark')::uuid; raise exception 'RLS direct released edit accepted';
  exception when others then if sqlerrm not like 'CAMS: Released marks are locked%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cams.test.student'),true);
do $$ begin
  if not exists(select 1 from public.marks where id=current_setting('cams.test.mark')::uuid and score=43) then raise exception 'Student cannot read updated mark'; end if;
  begin perform 1 from public.mark_correction_requests; raise exception 'Student reads private corrections'; exception when insufficient_privilege then null; end;
end $$;
rollback;
