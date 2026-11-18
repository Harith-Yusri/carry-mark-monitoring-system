-- A second entry point into the SAME exact-cell, private-draft correction store.
-- No synthetic student report, class reopen, mark grant or scoring rule change.
alter table public.mark_correction_requests alter column dispute_id drop not null;
alter table public.mark_correction_requests add column initiation_source text not null default 'student_issue'
  check(initiation_source in ('student_issue','lecturer'));
alter table public.mark_correction_requests add constraint mark_correction_source_link_check
  check((initiation_source='student_issue' and dispute_id is not null) or (initiation_source='lecturer' and dispute_id is null));
alter table public.mark_correction_events alter column dispute_id drop not null;
alter table public.mark_correction_events add constraint mark_correction_event_context_check
  check(request_id is not null or dispute_id is not null);

-- Private common context/locking guard. Every public entry point derives its
-- mark from this exact enrolled student + section + assessment relationship.
create function public.lock_released_mark_cell(target_section uuid,target_enrolment uuid,target_assessment uuid)
returns public.marks language plpgsql security definer set search_path='' as $$
declare section public.class_sections; offering public.subject_offerings; sub public.submissions; m public.marks;
begin
  select * into section from public.class_sections where id=target_section;
  if not found or not public.owns_offering(section.offering_id) then raise exception 'CAMS: Only the assigned lecturer can correct this class.'; end if;
  select * into offering from public.subject_offerings where id=section.offering_id;
  perform 1 from public.academic_terms where id=offering.term_id and is_current and status='active' for share;
  if not found then raise exception 'CAMS: Previous-semester academic records are read-only.'; end if;
  perform 1 from public.subject_offerings where id=offering.id for update;
  if not public.owns_offering(offering.id) or not exists(select 1 from public.class_sections where id=target_section and offering_id=offering.id) then
    raise exception 'CAMS: The assigned class has changed. Refresh before correcting.';
  end if;
  select * into sub from public.submissions where section_id=target_section for update;
  if sub.status is distinct from 'finalised' or sub.release_id is null then raise exception 'CAMS: Only an existing Released mark can be corrected.'; end if;
  perform 1 from public.enrolments e join public.students s on s.id=e.student_id
    where e.id=target_enrolment and e.section_id=target_section and e.status='enrolled' and s.is_active for update of e;
  if not found or not exists(select 1 from public.assessments where id=target_assessment and offering_id=offering.id) then
    raise exception 'CAMS: The student and assessment must belong to the selected class.';
  end if;
  select * into m from public.marks where enrolment_id=target_enrolment and assessment_id=target_assessment for update;
  if not found or m.score is null then raise exception 'CAMS: No Released mark exists for this assessment.'; end if;
  return m;
end;
$$;

create or replace function public.lock_mark_correction(target_request uuid) returns public.mark_correction_requests
language plpgsql security definer set search_path='' as $$
declare r public.mark_correction_requests; m public.marks; d public.mark_disputes;
begin
  select * into r from public.mark_correction_requests where id=target_request;
  if not found or r.lecturer_id is distinct from auth.uid() or not public.owns_offering(r.offering_id) then
    raise exception 'CAMS: Only the assigned lecturer can correct this mark.';
  end if;
  if r.dispute_id is not null then d:=public.lock_mark_issue(r.dispute_id); end if;
  m:=public.lock_released_mark_cell(r.section_id,r.enrolment_id,r.assessment_id);
  select * into r from public.mark_correction_requests where id=target_request for update;
  if m.id<>r.mark_id or not exists(select 1 from public.enrolments e join public.class_sections c on c.id=e.section_id
    join public.subject_offerings o on o.id=c.offering_id where e.id=r.enrolment_id and e.student_id=r.student_id
    and c.id=r.section_id and o.id=r.offering_id and o.term_id=r.term_id and o.lecturer_id=r.lecturer_id) then
    raise exception 'CAMS: The correction no longer matches its original academic context.';
  end if;
  if r.dispute_id is not null and (d.enrolment_id is distinct from r.enrolment_id or d.assessment_id is distinct from r.assessment_id
    or d.student_id<>r.student_id or d.section_id is distinct from r.section_id or d.offering_id<>r.offering_id) then
    raise exception 'CAMS: The correction no longer matches its student issue.';
  end if;
  -- A repeated release remains a no-op, after checking actor/current context.
  if r.status='released' then return r; end if;
  if not exists(select 1 from public.submissions where section_id=r.section_id and release_id=r.original_release_id and status='finalised') then
    raise exception 'CAMS: The class release has changed. This request cannot modify it.';
  end if;
  if m.version<>r.original_version or m.score<>r.original_score then
    raise exception 'CAMS: The mark has changed since the request. Refresh and investigate before correcting.';
  end if;
  return r;
end;
$$;

create function public.stage_exact_mark_correction(target_section uuid,target_enrolment uuid,target_assessment uuid,
  new_score numeric,correction_reason text,linked_issue uuid,expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare m public.marks; r public.mark_correction_requests; d public.mark_disputes; maximum numeric; result uuid; source text;
begin
  if linked_issue is not null then d:=public.lock_mark_issue(linked_issue); end if;
  m:=public.lock_released_mark_cell(target_section,target_enrolment,target_assessment);
  if linked_issue is not null and (d.status not in ('submitted','reviewing') or d.section_id is distinct from target_section
    or d.enrolment_id is distinct from target_enrolment or d.assessment_id is distinct from target_assessment
    or not exists(select 1 from public.enrolments where id=target_enrolment and student_id=d.student_id)) then
    raise exception 'CAMS: This report is closed or no longer matches the selected mark.';
  end if;
  if linked_issue is null and (expected_version is null or expected_version<>m.version) then
    raise exception 'CAMS: The Released mark has changed. Refresh the correction before saving.';
  end if;
  if length(trim(coalesce(correction_reason,''))) not between 1 and 2000 then raise exception 'CAMS: A correction reason of 1 to 2000 characters is required.'; end if;
  select max_score into maximum from public.assessments where id=target_assessment;
  if new_score is null or new_score::text in ('NaN','Infinity','-Infinity') or new_score<0 or new_score>maximum or new_score<>round(new_score,2) then
    raise exception 'CAMS: Enter a score from 0 to the assessment maximum with at most two decimal places.';
  end if;
  if new_score=m.score then raise exception 'CAMS: The corrected score must differ from the original score.'; end if;
  source:=case when linked_issue is null then 'lecturer' else 'student_issue' end;
  select * into r from public.mark_correction_requests where enrolment_id=target_enrolment and assessment_id=target_assessment
    and status in ('pending','approved','corrected') for update;
  if found then
    if r.dispute_id is distinct from linked_issue then raise exception 'CAMS: An active correction already exists for this mark. Open its existing correction before continuing.'; end if;
    r:=public.lock_mark_correction(r.id);
    if r.status='corrected' then
      if r.corrected_score=new_score and r.reason=trim(correction_reason) then return r.id; end if;
      raise exception 'CAMS: A correction is already awaiting release. Refresh its status.';
    end if;
    update public.mark_correction_requests set status='corrected',corrected_score=new_score,corrected_at=now(),maximum_score=maximum,reason=trim(correction_reason) where id=r.id;
    result:=r.id;
  else
    insert into public.mark_correction_requests(dispute_id,student_id,offering_id,section_id,enrolment_id,assessment_id,mark_id,lecturer_id,term_id,
      original_score,original_version,original_release_id,maximum_score,reason,snapshot,status,corrected_score,corrected_at,initiation_source)
      select linked_issue,e.student_id,o.id,c.id,e.id,a.id,m.id,auth.uid(),o.term_id,m.score,m.version,sub.release_id,maximum,trim(correction_reason),
        jsonb_build_object('student_name',s.full_name,'student_number',s.matrix_no,'subject_code',su.code,'subject_name',coalesce(o.subject_name_override,su.name),
          'class_label',c.label,'assessment_name',a.name,'lecturer_name',p.full_name,'academic_year',t.academic_year,'semester_code',t.semester_code),
        'corrected',new_score,now(),source
      from public.enrolments e join public.students s on s.id=e.student_id join public.class_sections c on c.id=e.section_id
      join public.subject_offerings o on o.id=c.offering_id join public.subjects su on su.id=o.subject_id
      join public.assessments a on a.id=target_assessment and a.offering_id=o.id join public.submissions sub on sub.section_id=c.id
      join public.profiles p on p.id=o.lecturer_id join public.academic_terms t on t.id=o.term_id
      where e.id=target_enrolment and c.id=target_section returning id into result;
  end if;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(result,linked_issue,auth.uid(),'corrected',jsonb_build_object('old_score',m.score,'new_score',new_score,'reason',trim(correction_reason),
      'initiation_source',source,'previous_status',r.status,'previous_reason',r.reason));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data)
    values(auth.uid(),'staged mark correction','mark_correction',result,jsonb_build_object('mark_id',m.id,'score',m.score,'version',m.version),
      jsonb_build_object('score',new_score,'reason',trim(correction_reason),'initiation_source',source,'dispute_id',linked_issue,
        'enrolment_id',target_enrolment,'assessment_id',target_assessment,'section_id',target_section));
  return result;
end;
$$;

create or replace function public.stage_mark_issue_correction(target_issue uuid,new_score numeric,correction_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.mark_disputes;
begin
  d:=public.lock_mark_issue(target_issue);
  if d.status not in ('submitted','reviewing') then raise exception 'CAMS: This report is already closed.'; end if;
  if d.enrolment_id is null or d.assessment_id is null or d.section_id is null then
    raise exception 'CAMS: This legacy report has ambiguous links. The original student, class and assessment must be identified before correction.';
  end if;
  return public.stage_exact_mark_correction(d.section_id,d.enrolment_id,d.assessment_id,new_score,correction_reason,d.id,null);
end;
$$;

-- Fresh server metadata, score/version and any resumable draft for this one cell.
-- VOLATILE so the staging RPC can return its own confirmed write in one response.
create function public.get_released_mark_correction_context(target_section uuid,target_enrolment uuid,target_assessment uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.marks; result jsonb;
begin
  m:=public.lock_released_mark_cell(target_section,target_enrolment,target_assessment);
  select jsonb_build_object('section_id',c.id,'enrolment_id',e.id,'assessment_id',a.id,'mark_id',m.id,'version',m.version,
    'current_score',m.score,'maximum_score',a.max_score,
    'student_name',s.full_name,'student_number',s.matrix_no,'subject_code',su.code,'class_label',c.label,'assessment_name',a.name,
    'correction',(select to_jsonb(r) from public.mark_correction_requests r where r.enrolment_id=e.id and r.assessment_id=a.id and r.status in ('pending','approved','corrected')),
    'history',coalesce((select jsonb_agg(to_jsonb(r) order by r.sequence_no desc) from public.mark_correction_requests r where r.enrolment_id=e.id and r.assessment_id=a.id),'[]')) into result
  from public.enrolments e join public.students s on s.id=e.student_id join public.class_sections c on c.id=e.section_id
    join public.subject_offerings o on o.id=c.offering_id join public.subjects su on su.id=o.subject_id join public.assessments a on a.id=target_assessment and a.offering_id=o.id
  where e.id=target_enrolment and c.id=target_section;
  return result;
end;
$$;
create function public.stage_released_mark_correction(target_section uuid,target_enrolment uuid,target_assessment uuid,
  expected_version integer,new_score numeric,correction_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.stage_exact_mark_correction(target_section,target_enrolment,target_assessment,new_score,correction_reason,null,expected_version);
  return public.get_released_mark_correction_context(target_section,target_enrolment,target_assessment);
end;
$$;

create or replace function public.release_corrected_mark(target_request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.mark_correction_requests;
begin
  r:=public.lock_mark_correction(target_request);
  if r.status='released' then return; end if;
  if r.dispute_id is not null and not exists(select 1 from public.mark_disputes where id=r.dispute_id and status in ('submitted','reviewing')) then
    raise exception 'CAMS: This report is already closed.';
  end if;
  if r.status<>'corrected' or r.corrected_score is null then raise exception 'CAMS: Save the correction before releasing it.'; end if;
  if not exists(select 1 from public.assessments a where a.id=r.assessment_id and r.corrected_score::text not in ('NaN','Infinity','-Infinity')
    and r.corrected_score>=0 and r.corrected_score<=a.max_score and r.corrected_score=round(r.corrected_score,2) and r.corrected_score<>r.original_score) then
    raise exception 'CAMS: The corrected score is no longer valid for this assessment.';
  end if;
  insert into cams_private.mark_release_permits(mark_id,transaction_id,actor_id,version,score)
    values(r.mark_id,txid_current(),auth.uid(),r.original_version,r.corrected_score);
  update public.marks set score=r.corrected_score,entered_by=auth.uid() where id=r.mark_id;
  if exists(select 1 from cams_private.mark_release_permits where mark_id=r.mark_id) then raise exception 'CAMS: Correction permit was not consumed.'; end if;
  update public.mark_correction_requests set status='released',released_at=now() where id=r.id;
  if r.dispute_id is not null then
    update public.mark_disputes set status='resolved',response=r.reason,responded_by=auth.uid(),responded_at=now() where id=r.dispute_id;
  end if;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(r.id,r.dispute_id,auth.uid(),'released',jsonb_build_object('old_score',r.original_score,'new_score',r.corrected_score,'reason',r.reason,
      'initiation_source',r.initiation_source,'corrected_at',r.corrected_at,'released_at',now()));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,subject_code_snapshot,old_data,new_data)
    values(auth.uid(),'released mark correction','mark_correction',r.id,r.snapshot->>'subject_code',
      jsonb_build_object('mark_id',r.mark_id,'score',r.original_score,'version',r.original_version),
      jsonb_build_object('score',r.corrected_score,'dispute_id',r.dispute_id,'reason',r.reason,'initiation_source',r.initiation_source,
        'student_id',r.student_id,'offering_id',r.offering_id,'section_id',r.section_id,'assessment_id',r.assessment_id,'lecturer_id',r.lecturer_id));
  insert into public.notifications(recipient_id,student_id,type,title,body,related_entity_id,data,release_id,delivery_status)
    values(null,r.student_id,'marks_released','Mark Updated',
      'Your mark for '||(r.snapshot->>'assessment_name')||' in '||(r.snapshot->>'subject_code')||' has been updated and released.',r.section_id,
      jsonb_build_object('offeringId',r.offering_id,'sectionId',r.section_id,'assessmentId',r.assessment_id,'correctionId',r.id,
        'route','/subject/'||r.offering_id::text),r.id,'pending');
end;
$$;

revoke all on function public.lock_released_mark_cell(uuid,uuid,uuid),public.stage_exact_mark_correction(uuid,uuid,uuid,numeric,text,uuid,integer)
  from public,anon,authenticated;
revoke all on function public.get_released_mark_correction_context(uuid,uuid,uuid),public.stage_released_mark_correction(uuid,uuid,uuid,integer,numeric,text) from public,anon;
grant execute on function public.get_released_mark_correction_context(uuid,uuid,uuid),public.stage_released_mark_correction(uuid,uuid,uuid,integer,numeric,text) to authenticated;
notify pgrst,'reload schema';
