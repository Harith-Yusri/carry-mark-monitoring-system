-- Released marks are never reopened at class level. Corrections are staged in
-- a private request record, then an exact-cell permit is consumed at re-release.
alter table public.mark_disputes
  add column assessment_id uuid references public.assessments(id) on delete restrict,
  add column enrolment_id uuid references public.enrolments(id) on delete restrict,
  add column section_id uuid references public.class_sections(id) on delete restrict,
  add column response text,
  add column responded_by uuid references public.profiles(id) on delete restrict,
  add column responded_at timestamptz,
  add column client_request_id uuid;
create unique index mark_disputes_client_request_idx on public.mark_disputes(student_id,client_request_id) where client_request_id is not null;
-- Backfill only unambiguous original links. Never infer a class by programme.
update public.mark_disputes d set assessment_id=a.id
from public.assessments a where a.offering_id=d.offering_id and a.name=d.assessment_name;
update public.mark_disputes d set enrolment_id=e.id, section_id=e.section_id
from public.enrolments e join public.class_sections c on c.id=e.section_id
where e.student_id=d.student_id and c.offering_id=d.offering_id
  and (select count(*) from public.enrolments e2 join public.class_sections c2 on c2.id=e2.section_id
    where e2.student_id=d.student_id and c2.offering_id=d.offering_id)=1;

create table public.mark_correction_requests (
  id uuid primary key default gen_random_uuid(),
  sequence_no bigint generated always as identity unique,
  dispute_id uuid not null references public.mark_disputes(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  offering_id uuid not null references public.subject_offerings(id) on delete restrict,
  section_id uuid not null references public.class_sections(id) on delete restrict,
  enrolment_id uuid not null references public.enrolments(id) on delete restrict,
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  mark_id uuid not null references public.marks(id) on delete restrict,
  lecturer_id uuid not null references public.profiles(id) on delete restrict,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  original_score numeric not null,
  original_version integer not null,
  original_release_id uuid not null,
  maximum_score numeric not null,
  reason text not null check(length(trim(reason)) between 1 and 2000),
  status text not null default 'pending' check(status in ('pending','approved','rejected','corrected','released')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  decision_note text,
  corrected_score numeric check(corrected_score>=0),
  corrected_at timestamptz,
  released_at timestamptz,
  snapshot jsonb not null
);
-- Stronger than per-report: two reports cannot concurrently unlock one cell.
create unique index mark_correction_active_cell_idx on public.mark_correction_requests(enrolment_id,assessment_id)
  where status in ('pending','approved','corrected');
create index mark_correction_queue_idx on public.mark_correction_requests(status,requested_at);
create index mark_correction_dispute_idx on public.mark_correction_requests(dispute_id,requested_at desc);
create table public.mark_correction_events (
  id bigint generated always as identity primary key,
  request_id uuid references public.mark_correction_requests(id) on delete restrict,
  dispute_id uuid not null references public.mark_disputes(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.mark_correction_requests enable row level security;
alter table public.mark_correction_events enable row level security;
revoke all on public.mark_correction_requests,public.mark_correction_events from public,anon,authenticated;
-- Read access is via role-checked RPCs. Students never receive draft corrections,
-- internal reasons or Admin review notes. No direct correction-table write grants.
create schema if not exists cams_private;
revoke all on schema cams_private from public,anon,authenticated;
create table cams_private.mark_release_permits (
  mark_id uuid primary key,
  transaction_id bigint not null,
  actor_id uuid not null,
  version integer not null,
  score numeric not null
);
revoke all on cams_private.mark_release_permits from public,anon,authenticated;

create function public.lock_mark_issue(target_issue uuid) returns public.mark_disputes
language plpgsql security definer set search_path='' as $$
declare d public.mark_disputes; t uuid;
begin
  select * into d from public.mark_disputes where id=target_issue;
  if not found or not(public.is_admin() or public.owns_offering(d.offering_id)) then
    raise exception 'CAMS: This mark issue is not available to your account.';
  end if;
  select term_id into t from public.subject_offerings where id=d.offering_id;
  perform 1 from public.academic_terms where id=t and is_current and status='active' for share;
  if not found then raise exception 'CAMS: Previous-semester academic records are read-only.'; end if;
  perform 1 from public.subject_offerings where id=d.offering_id for update;
  select * into d from public.mark_disputes where id=target_issue for update;
  return d;
end;
$$;

create function public.submit_student_mark_issue(target_enrolment uuid,target_assessment uuid,explanation text,request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare e record; a record; student uuid; existing public.mark_disputes; result uuid;
begin
  select id into student from public.students where auth_user_id=auth.uid() and is_active;
  if student is null then raise exception 'CAMS: An active student account is required.'; end if;
  if request_key is null or length(trim(coalesce(explanation,''))) not between 1 and 2000 then
    raise exception 'CAMS: Enter an explanation between 1 and 2000 characters.';
  end if;
  -- Serialise this student's duplicate submissions; network retries reuse key.
  perform 1 from public.students where id=student for update;
  select * into existing from public.mark_disputes where student_id=student and client_request_id=request_key;
  if found then
    if existing.enrolment_id<>target_enrolment or existing.assessment_id<>target_assessment or existing.explanation<>trim(explanation) then
      raise exception 'CAMS: This submission key was already used for a different report.';
    end if;
    return existing.id;
  end if;
  select en.id,en.section_id,c.offering_id,o.term_id into e from public.enrolments en
    join public.class_sections c on c.id=en.section_id join public.subject_offerings o on o.id=c.offering_id
    join public.academic_terms t on t.id=o.term_id
    where en.id=target_enrolment and en.student_id=student and en.status='enrolled' and t.is_current and t.status='active';
  if not found then raise exception 'CAMS: You are not enrolled in this active-semester class.'; end if;
  perform 1 from public.academic_terms where id=e.term_id and is_current and status='active' for share;
  if not found then raise exception 'CAMS: Previous-semester academic records are read-only.'; end if;
  select * into a from public.assessments where id=target_assessment and offering_id=e.offering_id;
  if not found then raise exception 'CAMS: Select an assessment belonging to this class.'; end if;
  select id into result from public.mark_disputes where student_id=student and enrolment_id=target_enrolment
    and assessment_id=target_assessment and status in ('submitted','reviewing') order by created_at desc limit 1;
  if result is not null then raise exception 'CAMS: An open report already exists for this assessment. Check its status below.'; end if;
  insert into public.mark_disputes(student_id,offering_id,assessment_id,enrolment_id,section_id,assessment_name,explanation,client_request_id)
    values(student,e.offering_id,a.id,e.id,e.section_id,a.name,trim(explanation),request_key) returning id into result;
  return result;
end;
$$;
-- Backward-compatible entry point for older app versions; publication is not
-- mark release, and visible assessment definitions must be reportable.
create or replace function public.submit_mark_dispute(target_offering uuid,target_assessment text,target_explanation text)
returns uuid language plpgsql security definer set search_path='' as $$
declare enrol uuid; assessment uuid;
begin
  if (select count(*) from public.enrolments e join public.students s on s.id=e.student_id
    join public.class_sections c on c.id=e.section_id where s.auth_user_id=auth.uid() and s.is_active
    and e.status='enrolled' and c.offering_id=target_offering)<>1 then
    raise exception 'CAMS: Select the exact class in the latest app before reporting this issue.';
  end if;
  select e.id into enrol from public.enrolments e join public.students s on s.id=e.student_id
    join public.class_sections c on c.id=e.section_id where s.auth_user_id=auth.uid() and s.is_active and e.status='enrolled' and c.offering_id=target_offering;
  select id into assessment from public.assessments where offering_id=target_offering and name=trim(target_assessment);
  return public.submit_student_mark_issue(enrol,assessment,target_explanation,gen_random_uuid());
end;
$$;

create function public.respond_to_mark_issue(target_issue uuid,decision text,lecturer_response text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.mark_disputes;
begin
  d:=public.lock_mark_issue(target_issue);
  if not public.owns_offering(d.offering_id) then raise exception 'CAMS: Only the assigned lecturer can respond.'; end if;
  if decision not in ('reviewing','resolved','rejected') or decision is null
    or length(trim(coalesce(lecturer_response,''))) not between 1 and 2000 then
    raise exception 'CAMS: Select a response and enter a note between 1 and 2000 characters.';
  end if;
  if d.status not in ('submitted','reviewing') then raise exception 'CAMS: This report is already closed. Refresh its status.'; end if;
  if exists(select 1 from public.mark_correction_requests where dispute_id=d.id and status in ('pending','approved','corrected')) then
    raise exception 'CAMS: Complete the active correction request before closing this report.';
  end if;
  update public.mark_disputes set status=decision,response=trim(lecturer_response),responded_by=auth.uid(),responded_at=now() where id=d.id;
  insert into public.mark_correction_events(dispute_id,actor_id,action,details)
    values(d.id,auth.uid(),'report_'||decision,jsonb_build_object('response',trim(lecturer_response)));
end;
$$;

create function public.request_mark_correction(target_issue uuid,correction_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.mark_disputes; m public.marks; sub public.submissions; result uuid; snap jsonb;
begin
  d:=public.lock_mark_issue(target_issue);
  if not public.owns_offering(d.offering_id) then raise exception 'CAMS: Only the assigned lecturer can request correction.'; end if;
  if d.status not in ('submitted','reviewing') then raise exception 'CAMS: This report is already closed.'; end if;
  if length(trim(coalesce(correction_reason,''))) not between 1 and 2000 then raise exception 'CAMS: A correction reason of 1 to 2000 characters is required.'; end if;
  if d.enrolment_id is null or d.assessment_id is null or d.section_id is null then
    raise exception 'CAMS: This legacy report has ambiguous links. An administrator must investigate before correction.';
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
  if exists(select 1 from public.mark_correction_requests where enrolment_id=d.enrolment_id and assessment_id=d.assessment_id and status in ('pending','approved','corrected')) then
    raise exception 'CAMS: An active correction request already exists for this student and assessment.';
  end if;
  select jsonb_build_object('student_name',s.full_name,'student_number',s.matrix_no,'subject_code',su.code,
    'subject_name',coalesce(o.subject_name_override,su.name),'class_label',c.label,'assessment_name',a.name,
    'lecturer_name',p.full_name,'academic_year',t.academic_year,'semester_code',t.semester_code)
    into snap from public.students s,public.class_sections c join public.subject_offerings o on o.id=c.offering_id
    join public.subjects su on su.id=o.subject_id join public.assessments a on a.offering_id=o.id
    join public.profiles p on p.id=o.lecturer_id join public.academic_terms t on t.id=o.term_id
    where s.id=d.student_id and c.id=d.section_id and a.id=d.assessment_id;
  insert into public.mark_correction_requests(dispute_id,student_id,offering_id,section_id,enrolment_id,assessment_id,mark_id,lecturer_id,term_id,
    original_score,original_version,original_release_id,maximum_score,reason,snapshot)
    select d.id,d.student_id,d.offering_id,d.section_id,d.enrolment_id,d.assessment_id,m.id,auth.uid(),o.term_id,
      m.score,m.version,sub.release_id,a.max_score,trim(correction_reason),snap
    from public.subject_offerings o join public.assessments a on a.offering_id=o.id where o.id=d.offering_id and a.id=d.assessment_id returning id into result;
  update public.mark_disputes set status='reviewing' where id=d.id;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(result,d.id,auth.uid(),'requested',jsonb_build_object('original_score',m.score,'reason',trim(correction_reason)));
  return result;
end;
$$;

create function public.lock_mark_correction(target_request uuid) returns public.mark_correction_requests
language plpgsql security definer set search_path='' as $$
declare r public.mark_correction_requests; d public.mark_disputes;
begin
  select * into r from public.mark_correction_requests where id=target_request;
  if not found then raise exception 'CAMS: Correction request not found.'; end if;
  d:=public.lock_mark_issue(r.dispute_id);
  select * into r from public.mark_correction_requests where id=target_request for update;
  if not exists(select 1 from public.subject_offerings where id=r.offering_id and lecturer_id=r.lecturer_id)
    or not exists(select 1 from public.profiles where id=r.lecturer_id and role='lecturer' and is_active) then
    raise exception 'CAMS: The assigned lecturer has changed or is inactive.';
  end if;
  perform 1 from public.submissions where section_id=r.section_id and status='finalised' and release_id=r.original_release_id for update;
  if not found then
    raise exception 'CAMS: The class release has changed. This request cannot modify it.';
  end if;
  perform 1 from public.marks where id=r.mark_id and enrolment_id=r.enrolment_id and assessment_id=r.assessment_id
    and version=r.original_version and score=r.original_score for update;
  if not found then raise exception 'CAMS: The mark has changed since the request. Refresh and investigate before correcting.'; end if;
  return r;
end;
$$;

create function public.review_mark_correction(target_request uuid,approve boolean,admin_note text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.mark_correction_requests; d public.mark_disputes;
begin
  if not public.is_admin() then raise exception 'CAMS: Administrator approval is required.'; end if;
  if approve is null or length(coalesce(admin_note,''))>2000 then raise exception 'CAMS: Enter a valid review decision and a note of at most 2000 characters.'; end if;
  if approve then
    r:=public.lock_mark_correction(target_request);
  else
    -- Rejection/revocation must remain possible if another Admin workflow has
    -- changed the release/score. It never writes a mark, and frees a stale grant.
    select * into r from public.mark_correction_requests where id=target_request;
    if not found then raise exception 'CAMS: Correction request not found.'; end if;
    d:=public.lock_mark_issue(r.dispute_id);
    select * into r from public.mark_correction_requests where id=target_request for update;
  end if;
  if (approve and r.status<>'pending') or (not approve and r.status not in ('pending','approved','corrected')) then
    raise exception 'CAMS: This request has already been reviewed. Refresh its status.';
  end if;
  update public.mark_correction_requests set status=case when approve then 'approved' else 'rejected' end,
    reviewed_by=auth.uid(),reviewed_at=now(),decision_note=nullif(trim(admin_note),'') where id=r.id;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(r.id,r.dispute_id,auth.uid(),case when approve then 'approved' else 'rejected' end,jsonb_build_object('note',nullif(trim(admin_note),'')));
end;
$$;

create function public.update_approved_mark(target_request uuid,new_score numeric) returns void
language plpgsql security definer set search_path='' as $$
declare r public.mark_correction_requests; maximum numeric;
begin
  r:=public.lock_mark_correction(target_request);
  if r.lecturer_id<>auth.uid() or not public.owns_offering(r.offering_id) then raise exception 'CAMS: Only the assigned lecturer can correct this mark.'; end if;
  if r.status<>'approved' then raise exception 'CAMS: This mark is not approved for correction or the approval has already been used.'; end if;
  select max_score into maximum from public.assessments where id=r.assessment_id;
  if new_score is null or new_score::text in ('NaN','Infinity','-Infinity') or new_score<0 or new_score>maximum or new_score<>round(new_score,2) then
    raise exception 'CAMS: Enter a score from 0 to the assessment maximum with at most two decimal places.';
  end if;
  if new_score=r.original_score then raise exception 'CAMS: The corrected score must differ from the original score.'; end if;
  update public.mark_correction_requests set corrected_score=new_score,corrected_at=now(),status='corrected' where id=r.id;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(r.id,r.dispute_id,auth.uid(),'corrected',jsonb_build_object('old_score',r.original_score,'new_score',new_score));
  -- No marks UPDATE: students retain the last Released value until re-release.
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
    if not coalesce(permitted,false) then raise exception 'CAMS: Released marks are locked. Use an approved correction and Release Updated Mark.'; end if;
  end if;
  if new.score is not null and (new.score<0 or new.score>maximum) then raise exception 'CAMS: Score cannot exceed the assessment maximum or be negative.'; end if;
  if tg_op='UPDATE' then new.version=old.version+1; end if;
  new.updated_at=now(); return new;
end;
$$;

create function public.release_corrected_mark(target_request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.mark_correction_requests;
begin
  -- A repeat/retried release is a no-op only for its original owning lecturer.
  select * into r from public.mark_correction_requests where id=target_request;
  if r.lecturer_id is distinct from auth.uid() or not public.owns_offering(r.offering_id) then raise exception 'CAMS: Only the assigned lecturer can release this correction.'; end if;
  if r.status='released' then return; end if;
  r:=public.lock_mark_correction(target_request);
  if r.status<>'corrected' or r.corrected_score is null then raise exception 'CAMS: Save the approved correction before releasing it.'; end if;
  -- Lock helper verifies exact old score/version and the unchanged class release.
  insert into cams_private.mark_release_permits(mark_id,transaction_id,actor_id,version,score)
    values(r.mark_id,txid_current(),auth.uid(),r.original_version,r.corrected_score);
  update public.marks set score=r.corrected_score,entered_by=auth.uid() where id=r.mark_id;
  if exists(select 1 from cams_private.mark_release_permits where mark_id=r.mark_id) then raise exception 'CAMS: Correction permit was not consumed.'; end if;
  update public.mark_correction_requests set status='released',released_at=now() where id=r.id;
  update public.mark_disputes set status='resolved',response='The corrected mark has been released.',responded_by=auth.uid(),responded_at=now() where id=r.dispute_id;
  insert into public.mark_correction_events(request_id,dispute_id,actor_id,action,details)
    values(r.id,r.dispute_id,auth.uid(),'released',jsonb_build_object('old_score',r.original_score,'new_score',r.corrected_score));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,subject_code_snapshot,old_data,new_data)
    values(auth.uid(),'released approved mark correction','mark_correction',r.id,r.snapshot->>'subject_code',
      jsonb_build_object('mark_id',r.mark_id,'score',r.original_score,'version',r.original_version),
      jsonb_build_object('score',r.corrected_score,'dispute_id',r.dispute_id,'approved_by',r.reviewed_by,'reason',r.reason));
  -- Reuse the existing marks_released push webhook and per-device preference /
  -- delivery deduplication. Do not create/reopen a class submission/release.
  insert into public.notifications(recipient_id,student_id,type,title,body,related_entity_id,data,release_id,delivery_status)
    values(null,r.student_id,'marks_released','Mark Updated',
      'Your mark for '||(r.snapshot->>'assessment_name')||' in '||(r.snapshot->>'subject_code')||' has been updated and released.',r.section_id,
      jsonb_build_object('offeringId',r.offering_id,'sectionId',r.section_id,'assessmentId',r.assessment_id,'correctionId',r.id,
        'route','/subject/'||r.offering_id::text),r.id,'pending');
end;
$$;

-- Private helpers must never be callable by PostgREST users.
revoke all on function public.lock_mark_issue(uuid),public.lock_mark_correction(uuid) from public,anon,authenticated;
revoke all on function public.submit_student_mark_issue(uuid,uuid,text,uuid),public.submit_mark_dispute(uuid,text,text),
  public.respond_to_mark_issue(uuid,text,text),public.request_mark_correction(uuid,text),
  public.review_mark_correction(uuid,boolean,text),public.update_approved_mark(uuid,numeric),public.release_corrected_mark(uuid)
  from public,anon;
grant execute on function public.submit_student_mark_issue(uuid,uuid,text,uuid),public.submit_mark_dispute(uuid,text,text),
  public.respond_to_mark_issue(uuid,text,text),public.request_mark_correction(uuid,text),
  public.review_mark_correction(uuid,boolean,text),public.update_approved_mark(uuid,numeric),public.release_corrected_mark(uuid)
  to authenticated;
notify pgrst,'reload schema';
