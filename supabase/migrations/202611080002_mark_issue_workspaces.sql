create function public.get_staff_mark_issues(target_offering uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare anchor public.subject_offerings; result jsonb;
begin
  select * into anchor from public.subject_offerings where id=target_offering;
  if not found or not public.owns_offering(target_offering) then raise exception 'CAMS: Only the assigned lecturer can view this Subject Hub.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'status',d.status,'explanation',d.explanation,'created_at',d.created_at,'response',d.response,
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

create function public.get_mark_correction_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'CAMS: Administrator access is required.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object(
    'editable',t.is_current and t.status='active',
    'events',coalesce((select jsonb_agg(jsonb_build_object('action',ev.action,'actor_id',ev.actor_id,'details',ev.details,'created_at',ev.created_at) order by ev.id)
      from public.mark_correction_events ev where ev.request_id=r.id),'[]'))
    order by (r.status='pending') desc,r.sequence_no desc)
    from public.mark_correction_requests r join public.academic_terms t on t.id=r.term_id),'[]');
end;
$$;
create function public.get_mark_correction_pending_count() returns bigint
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'CAMS: Administrator access is required.'; end if;
  return (select count(*) from public.mark_correction_requests r join public.academic_terms t on t.id=r.term_id
    where r.status='pending' and t.is_current and t.status='active');
end;
$$;

create function public.get_my_mark_issue_workspace(target_offering uuid) returns jsonb
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
      'status',d.status,'created_at',d.created_at,'response',d.response,
      'correction_status',(select r.status from public.mark_correction_requests r where r.dispute_id=d.id order by r.sequence_no desc limit 1)
    ) order by d.created_at desc) from public.mark_disputes d left join public.assessments a on a.id=d.assessment_id
      left join public.class_sections c on c.id=d.section_id where d.student_id=student and d.offering_id=target_offering),'[]')
  );
end;
$$;
revoke all on function public.get_staff_mark_issues(uuid),public.get_mark_correction_queue(),public.get_mark_correction_pending_count(),public.get_my_mark_issue_workspace(uuid) from public,anon;
grant execute on function public.get_staff_mark_issues(uuid),public.get_mark_correction_queue(),public.get_mark_correction_pending_count(),public.get_my_mark_issue_workspace(uuid) to authenticated;
notify pgrst,'reload schema';
