-- All fixtures, notifications and pg_net dispatches roll back. No real marks
-- are edited and no push can be committed by this regression transaction.
begin;
do $$
declare
  lect uuid; other_lect uuid; admin uuid; student uuid; student_auth uuid; second_student uuid;
  term uuid; programme uuid; subject uuid; offering uuid; section uuid; second_section uuid;
  enrol uuid; enrol2 uuid; assessment uuid; assessment2 uuid; mark uuid; issue uuid; issue2 uuid; req uuid; rejected_req uuid;
  result jsonb; before_total numeric; original_release uuid:=gen_random_uuid(); invalid_score numeric; legacy_status text; notification uuid;
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
  select id into notification from public.notifications where type='mark_issue_submitted' and related_entity_id=issue;
  if (select count(*) from public.notifications where type='mark_issue_submitted' and related_entity_id=issue)<>1 then raise exception 'Missing or duplicate issue notification'; end if;
  if not exists(select 1 from public.notifications n join public.mark_disputes d on d.id=n.related_entity_id
    join public.students s on s.id=d.student_id where n.id=notification and n.recipient_id=lect and n.student_id is null
    and n.data->>'studentName'=s.full_name and n.data->>'subjectCode'=fixture and n.data->>'classLabel'='Fixture A'
    and n.data->>'assessmentName'='Quiz One' and n.data->>'issueId'=issue::text and n.data->>'offeringId'=offering::text
    and n.created_at=d.created_at and n.read_at is null) then raise exception 'Wrong recipient or notification context'; end if;
  if (select score from public.marks where id=mark)<>33 then raise exception 'Report changed a mark'; end if;
  perform set_config('request.jwt.claim.sub',other_lect::text,true);
  if exists(select 1 from jsonb_array_elements(public.get_my_lecturer_notifications()->'items') n where n->>'id'=notification::text) then raise exception 'Wrong lecturer inbox leak'; end if;
  begin perform public.open_my_mark_issue_notification(notification); raise exception 'Wrong lecturer opened notification';
  exception when others then if sqlerrm not like 'CAMS: This notification is not available%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',student_auth::text,true);
  begin perform public.get_my_lecturer_notifications(); raise exception 'Student accessed staff inbox';
  exception when others then if sqlerrm not like 'CAMS: An active lecturer%' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  begin perform public.open_my_mark_issue_notification(notification); raise exception 'Admin opened issue notification';
  exception when others then if sqlerrm not like 'CAMS: An active lecturer%' then raise; end if; end;
  if has_function_privilege('anon','public.get_my_lecturer_notifications(timestamptz,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.notify_lecturer_mark_issue()','EXECUTE')
    or has_column_privilege('authenticated','public.notifications','read_at','UPDATE') then raise exception 'Notification privileges too broad'; end if;
  perform set_config('cams.test.notification',notification::text,true);
  perform set_config('cams.test.lecturer',lect::text,true);
  perform set_config('cams.test.other_lecturer',other_lect::text,true);
  perform set_config('cams.test.student',student_auth::text,true);
  perform set_config('cams.test.admin',admin::text,true);
  perform set_config('cams.test.offering',offering::text,true);
  perform set_config('cams.test.issue',issue::text,true);
end $$;
-- Real API role, RLS and checked acknowledgement (no broad read_at grant).
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('cams.test.other_lecturer'),true);
do $$ begin
  if exists(select 1 from public.notifications where id=current_setting('cams.test.notification')::uuid) then raise exception 'RLS leaked another lecturer alert'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cams.test.student'),true);
do $$ begin
  if exists(select 1 from public.notifications where id=current_setting('cams.test.notification')::uuid) then raise exception 'RLS leaked lecturer alert to student'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cams.test.admin'),true);
do $$ begin
  if exists(select 1 from public.notifications where id=current_setting('cams.test.notification')::uuid) then raise exception 'RLS leaked new alert to Admin'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('cams.test.lecturer'),true);
do $$ declare before_count bigint; result jsonb; first_read timestamptz;
begin
  if not exists(select 1 from public.notifications where id=current_setting('cams.test.notification')::uuid and read_at is null) then raise exception 'Own unread notification missing'; end if;
  before_count:=(public.get_my_lecturer_notifications()->>'unread_count')::bigint;
  result:=public.open_my_mark_issue_notification(current_setting('cams.test.notification')::uuid);
  first_read:=(result->>'read_at')::timestamptz;
  if result->>'issue_id'<>current_setting('cams.test.issue') or not exists(select 1 from jsonb_array_elements(result->'subject_rows') s
    where s->>'offering_id'=current_setting('cams.test.offering')) then raise exception 'Notification opens wrong issue/Hub'; end if;
  if first_read is null or (result->>'unread_count')::bigint<>before_count-1 then raise exception 'Unread badge did not decrement'; end if;
  result:=public.open_my_mark_issue_notification(current_setting('cams.test.notification')::uuid);
  if (result->>'read_at')::timestamptz<>first_read or (result->>'unread_count')::bigint<>before_count-1 then raise exception 'Open retry changed count/read time'; end if;
  if not exists(select 1 from public.notifications where id=current_setting('cams.test.notification')::uuid and read_at=first_read) then raise exception 'Read acknowledgement not saved'; end if;
end $$;
rollback;
