-- Lecturer-only outcomes: Reject OR privately Correct Mark, then Release Updated Mark.
-- Keep historical approval records intact; no new approval states, grants or class reopening.

create or replace function public.lock_mark_issue(target_issue uuid) returns public.mark_disputes
language plpgsql security definer set search_path='' as $$
declare d public.mark_disputes; t uuid;
begin
  select * into d from public.mark_disputes where id=target_issue;
  if not found or not public.owns_offering(d.offering_id) then
    raise exception 'CAMS: This mark issue is not available to your account.';
  end if;
  select term_id into t from public.subject_offerings where id=d.offering_id;
  perform 1 from public.academic_terms where id=t and is_current and status='active' for share;
  if not found then raise exception 'CAMS: Previous-semester academic records are read-only.'; end if;
  perform 1 from public.subject_offerings where id=d.offering_id for update;
  select * into d from public.mark_disputes where id=target_issue for update;
  if not public.owns_offering(d.offering_id) then raise exception 'CAMS: The assigned lecturer has changed or is inactive.'; end if;
  return d;
end;
$$;

create or replace function public.respond_to_mark_issue(target_issue uuid,decision text,lecturer_response text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.mark_disputes; r public.mark_correction_requests;
begin
  d:=public.lock_mark_issue(target_issue);
  if decision is distinct from 'rejected' or length(trim(coalesce(lecturer_response,''))) not between 1 and 2000 then
    raise exception 'CAMS: Reject requires a response between 1 and 2000 characters.';
  end if;
  if d.status not in ('submitted','reviewing') then raise exception 'CAMS: This report is already closed. Refresh its status.'; end if;
  -- Rejection can also close a stale/abandoned private draft. No mark is written.
  for r in select * from public.mark_correction_requests where dispute_id=d.id and status in ('pending','approved','corrected') for update loop
    update public.mark_correction_requests set status='rejected' where id=r.id;
    insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
      values(r.id,d.id,auth.uid(),'draft_cancelled',jsonb_build_object('reason',trim(lecturer_response)));
  end loop;
  update public.mark_disputes set status='rejected',response=trim(lecturer_response),responded_by=auth.uid(),responded_at=now() where id=d.id;
  insert into public.mark_correction_events(dispute_id,actor_id,action,details)
    values(d.id,auth.uid(),'report_rejected',jsonb_build_object('response',trim(lecturer_response)));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data)
    values(auth.uid(),'rejected mark issue','mark_dispute',d.id,jsonb_build_object('status',d.status),
      jsonb_build_object('status','rejected','response',trim(lecturer_response),'responded_at',now()));
end;
$$;

create or replace function public.stage_mark_issue_correction(target_issue uuid,new_score numeric,correction_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.mark_disputes; m public.marks; sub public.submissions; result uuid; snap jsonb; r public.mark_correction_requests; maximum numeric;
begin
  d:=public.lock_mark_issue(target_issue);
  if not public.owns_offering(d.offering_id) then raise exception 'CAMS: Only the assigned lecturer can correct this mark.'; end if;
  if d.status not in ('submitted','reviewing') then raise exception 'CAMS: This report is already closed.'; end if;
  if length(trim(coalesce(correction_reason,''))) not between 1 and 2000 then raise exception 'CAMS: A correction reason of 1 to 2000 characters is required.'; end if;
  if d.enrolment_id is null or d.assessment_id is null or d.section_id is null then
    raise exception 'CAMS: This legacy report has ambiguous links. The original student, class and assessment must be identified before correction.';
  end if;
  if not exists(select 1 from public.enrolments e join public.class_sections c on c.id=e.section_id
    join public.assessments a on a.offering_id=c.offering_id where e.id=d.enrolment_id and e.student_id=d.student_id
    and e.section_id=d.section_id and e.status='enrolled' and c.offering_id=d.offering_id and a.id=d.assessment_id) then
    raise exception 'CAMS: The report no longer matches an active enrolment and assessment.';
  end if;
  select * into sub from public.submissions where section_id=d.section_id for update;
  if sub.status is distinct from 'finalised' or sub.release_id is null then raise exception 'CAMS: Only a Released mark can use this correction workflow.'; end if;
  select * into m from public.marks where enrolment_id=d.enrolment_id and assessment_id=d.assessment_id for update;
  if not found or m.score is null then raise exception 'CAMS: No Released mark exists for this assessment.'; end if;
  select max_score into maximum from public.assessments where id=d.assessment_id;
  if new_score is null or new_score::text in ('NaN','Infinity','-Infinity') or new_score<0 or new_score>maximum or new_score<>round(new_score,2) then
    raise exception 'CAMS: Enter a score from 0 to the assessment maximum with at most two decimal places.';
  end if;
  if new_score=m.score then raise exception 'CAMS: The corrected score must differ from the original score.'; end if;
  select * into r from public.mark_correction_requests where enrolment_id=d.enrolment_id and assessment_id=d.assessment_id
    and status in ('pending','approved','corrected') for update;
  if found then
    if r.dispute_id<>d.id then raise exception 'CAMS: An active correction already exists for this student and assessment.'; end if;
    r:=public.lock_mark_correction(r.id);
    -- A retry of the same staged correction is a no-op, including its event.
    if r.status='corrected' then
      if r.corrected_score=new_score and r.reason=trim(correction_reason) then return r.id; end if;
      raise exception 'CAMS: A correction is already awaiting release. Refresh its status.';
    end if;
    -- Existing pending/approved records transition without another Admin action.
    update public.mark_correction_requests set status='corrected',corrected_score=new_score,corrected_at=now(),
      maximum_score=maximum,reason=trim(correction_reason) where id=r.id;
    insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
      values(r.id,d.id,auth.uid(),'corrected',jsonb_build_object('old_score',r.original_score,'new_score',new_score,
        'reason',trim(correction_reason),'previous_reason',r.reason,'previous_status',r.status));
    return r.id;
  end if;
  select jsonb_build_object('student_name',s.full_name,'student_number',s.matrix_no,'subject_code',su.code,
    'subject_name',coalesce(o.subject_name_override,su.name),'class_label',c.label,'assessment_name',a.name,
    'lecturer_name',p.full_name,'academic_year',t.academic_year,'semester_code',t.semester_code)
    into snap from public.students s,public.class_sections c join public.subject_offerings o on o.id=c.offering_id
    join public.subjects su on su.id=o.subject_id join public.assessments a on a.offering_id=o.id
    join public.profiles p on p.id=o.lecturer_id join public.academic_terms t on t.id=o.term_id
    where s.id=d.student_id and c.id=d.section_id and a.id=d.assessment_id;
  insert into public.mark_correction_requests(dispute_id,student_id,offering_id,section_id,enrolment_id,assessment_id,mark_id,lecturer_id,term_id,
    original_score,original_version,original_release_id,maximum_score,reason,snapshot,status,corrected_score,corrected_at)
    select d.id,d.student_id,d.offering_id,d.section_id,d.enrolment_id,d.assessment_id,m.id,auth.uid(),o.term_id,
      m.score,m.version,sub.release_id,a.max_score,trim(correction_reason),snap,'corrected',new_score,now()
    from public.subject_offerings o join public.assessments a on a.offering_id=o.id where o.id=d.offering_id and a.id=d.assessment_id returning id into result;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(result,d.id,auth.uid(),'corrected',jsonb_build_object('old_score',m.score,'new_score',new_score,'reason',trim(correction_reason)));
  return result;
end;
$$;

create or replace function public.release_corrected_mark(target_request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.mark_correction_requests; d public.mark_disputes;
begin
  -- A repeat/retried release is a no-op only for its original owning lecturer.
  select * into r from public.mark_correction_requests where id=target_request;
  if r.lecturer_id is distinct from auth.uid() or not public.owns_offering(r.offering_id) then raise exception 'CAMS: Only the assigned lecturer can release this correction.'; end if;
  d:=public.lock_mark_issue(r.dispute_id);
  select * into r from public.mark_correction_requests where id=target_request for update;
  if r.status='released' then return; end if;
  if d.status not in ('submitted','reviewing') then raise exception 'CAMS: This report is already closed.'; end if;
  r:=public.lock_mark_correction(target_request);
  if r.status<>'corrected' or r.corrected_score is null then raise exception 'CAMS: Correct this mark before releasing it.'; end if;
  -- Lock helper verifies exact old score/version and the unchanged class release.
  insert into cams_private.mark_release_permits(mark_id,transaction_id,actor_id,version,score)
    values(r.mark_id,txid_current(),auth.uid(),r.original_version,r.corrected_score);
  update public.marks set score=r.corrected_score,entered_by=auth.uid() where id=r.mark_id;
  if exists(select 1 from cams_private.mark_release_permits where mark_id=r.mark_id) then raise exception 'CAMS: Correction permit was not consumed.'; end if;
  update public.mark_correction_requests set status='released',released_at=now() where id=r.id;
  update public.mark_disputes set status='resolved',response=r.reason,responded_by=auth.uid(),responded_at=now() where id=r.dispute_id;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(r.id,r.dispute_id,auth.uid(),'released',jsonb_build_object('old_score',r.original_score,'new_score',r.corrected_score,'reason',r.reason,'corrected_at',r.corrected_at,'released_at',now()));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,subject_code_snapshot,old_data,new_data)
    values(auth.uid(),'released mark correction','mark_correction',r.id,r.snapshot->>'subject_code',
      jsonb_build_object('mark_id',r.mark_id,'score',r.original_score,'version',r.original_version),
      jsonb_build_object('score',r.corrected_score,'dispute_id',r.dispute_id,'reason',r.reason));
  -- Reuse the existing marks_released push webhook and per-device preference /
  -- delivery deduplication. Do not create/reopen a class submission/release.
  insert into public.notifications(recipient_id,student_id,type,title,body,related_entity_id,data,release_id,delivery_status)
    values(null,r.student_id,'marks_released','Mark Updated',
      'Your mark for '||(r.snapshot->>'assessment_name')||' in '||(r.snapshot->>'subject_code')||' has been updated and released.',r.section_id,
      jsonb_build_object('offeringId',r.offering_id,'sectionId',r.section_id,'assessmentId',r.assessment_id,'correctionId',r.id,
        'route','/subject/'||r.offering_id::text),r.id,'pending');
end;
$$;

create or replace function public.validate_mark() returns trigger
language plpgsql set search_path='' as $$
declare maximum numeric; mark_offering uuid; enrolment_offering uuid; locked boolean; permitted boolean:=false;
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.enrolment_id<>old.enrolment_id or new.assessment_id<>old.assessment_id) then
    raise exception 'CAMS: An existing mark cannot be moved to another student or assessment.';
  end if;
  select a.max_score,a.offering_id into maximum,mark_offering from public.assessments a where a.id=new.assessment_id;
  select c.offering_id,coalesce(s.status='finalised',false) into enrolment_offering,locked
    from public.enrolments e join public.class_sections c on c.id=e.section_id
    left join public.submissions s on s.section_id=c.id where e.id=new.enrolment_id;
  if maximum is null or enrolment_offering is null or mark_offering<>enrolment_offering then raise exception 'Assessment and enrolment must belong to the same offering'; end if;
  if locked then
    -- Only the migration/RPC owner can access the private transaction permit.
    -- Client-set settings/metadata and a bare approved request cannot unlock it.
    if tg_op='UPDATE' and current_user='postgres' then
      delete from cams_private.mark_release_permits p where p.mark_id=old.id and p.transaction_id=txid_current()
        and p.actor_id=auth.uid() and p.version=old.version and p.score=new.score
        and new.remarks is not distinct from old.remarks returning true into permitted;
    end if;
    if not coalesce(permitted,false) then raise exception 'CAMS: Released marks are locked. Use Correct Mark and Release Updated Mark for the reported assessment.'; end if;
  end if;
  if new.score is not null and (new.score<0 or new.score>maximum) then raise exception 'CAMS: Score cannot exceed the assessment maximum or be negative.'; end if;
  if tg_op='UPDATE' then new.version=old.version+1; end if;
  new.updated_at=now(); return new;
end;
$$;

create or replace function public.request_mark_correction(target_issue uuid,correction_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'CAMS: This approval workflow has retired. Use Mark Issues to Reject or Correct Mark.';
end;
$$;

create or replace function public.review_mark_correction(target_request uuid,approve boolean,admin_note text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'CAMS: This approval workflow has retired. Use Mark Issues to Reject or Correct Mark.';
end;
$$;

create or replace function public.update_approved_mark(target_request uuid,new_score numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'CAMS: This approval workflow has retired. Use Mark Issues to Reject or Correct Mark.';
end;
$$;

create or replace function public.get_mark_correction_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  raise exception 'CAMS: This approval workflow has retired. Use Mark Issues to Reject or Correct Mark.';
end;
$$;

create or replace function public.get_mark_correction_pending_count() returns bigint
language plpgsql stable security definer set search_path='' as $$
begin
  raise exception 'CAMS: This approval workflow has retired. Use Mark Issues to Reject or Correct Mark.';
end;
$$;

create or replace function public.get_staff_mark_issues(target_offering uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare anchor public.subject_offerings; result jsonb;
begin
  select * into anchor from public.subject_offerings where id=target_offering;
  if not found or not public.owns_offering(target_offering) then raise exception 'CAMS: Only the assigned lecturer can view this Subject Hub.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'status',d.status,'explanation',d.explanation,'created_at',d.created_at,'response',d.response,
    'responded_by',d.responded_by,'responded_at',d.responded_at,
    'events',coalesce((select jsonb_agg(jsonb_build_object('action',ev.action,'created_at',ev.created_at,'actor_id',ev.actor_id,'details',ev.details) order by ev.id)
      from public.mark_correction_events ev where ev.dispute_id=d.id and ev.request_id is null),'[]'),
    'student_name',s.full_name,'student_number',s.matrix_no,'assessment_name',coalesce(a.name,d.assessment_name),
    'class_label',coalesce(c.label,'Legacy class link unavailable'),'current_score',m.score,'maximum_score',a.max_score,'released',coalesce(sub.status='finalised',false),
    'can_correct',d.assessment_id is not null and d.enrolment_id is not null and sub.status='finalised' and m.score is not null,
    'editable',t.is_current and t.status='active',
    'corrections',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('events',coalesce((
      select jsonb_agg(jsonb_build_object('action',ev.action,'created_at',ev.created_at,'actor_id',ev.actor_id,'details',ev.details) order by ev.id)
      from public.mark_correction_events ev where ev.request_id=r.id),'[]')) order by r.sequence_no desc)
      from public.mark_correction_requests r where r.dispute_id=d.id),'[]')
  ) order by d.created_at desc),'[]') into result
  from public.mark_disputes d join public.subject_offerings o on o.id=d.offering_id
  join public.students s on s.id=d.student_id join public.academic_terms t on t.id=o.term_id
  left join public.assessments a on a.id=d.assessment_id left join public.class_sections c on c.id=d.section_id
  left join public.submissions sub on sub.section_id=c.id left join public.marks m on m.enrolment_id=d.enrolment_id and m.assessment_id=d.assessment_id
  where o.lecturer_id=auth.uid() and o.subject_id=anchor.subject_id and o.term_id=anchor.term_id and o.programme_semester=anchor.programme_semester;
  return result;
end;
$$;

create or replace function public.get_my_mark_issue_workspace(target_offering uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare student uuid;
begin
  select id into student from public.students where auth_user_id=auth.uid() and is_active;
  if student is null then raise exception 'CAMS: An active student account is required.'; end if;
  return jsonb_build_object(
    'request_key',gen_random_uuid(),
    'options',coalesce((select jsonb_agg(jsonb_build_object('assessment_id',a.id,'enrolment_id',e.id,'name',a.name,'class_label',c.label) order by c.label,a.position)
      from public.enrolments e join public.class_sections c on c.id=e.section_id join public.subject_offerings o on o.id=c.offering_id
      join public.academic_terms t on t.id=o.term_id join public.assessments a on a.offering_id=o.id
      where e.student_id=student and e.status='enrolled' and o.id=target_offering and t.is_current and t.status='active'),'[]'),
    'issues',coalesce((select jsonb_agg(jsonb_build_object(
      'id',d.id,'assessment_name',coalesce(a.name,d.assessment_name),'class_label',c.label,'explanation',d.explanation,
      'status',case when d.status='reviewing' then 'submitted' else d.status end,'created_at',d.created_at,'response',d.response,'responded_at',d.responded_at,
      'correction_status',(select case when r.status in ('corrected','released') then r.status else null end from public.mark_correction_requests r where r.dispute_id=d.id order by r.sequence_no desc limit 1)
    ) order by d.created_at desc) from public.mark_disputes d left join public.assessments a on a.id=d.assessment_id
      left join public.class_sections c on c.id=d.section_id where d.student_id=student and d.offering_id=target_offering),'[]')
  );
end;
$$;

-- Authenticated access still requires active lecturer ownership inside each RPC.
revoke all on function public.stage_mark_issue_correction(uuid,numeric,text) from public,anon;
grant execute on function public.stage_mark_issue_correction(uuid,numeric,text) to authenticated;
revoke all on function public.request_mark_correction(uuid,text),public.review_mark_correction(uuid,boolean,text),
  public.update_approved_mark(uuid,numeric),public.get_mark_correction_queue(),public.get_mark_correction_pending_count()
  from public,anon,authenticated;
notify pgrst,'reload schema';
