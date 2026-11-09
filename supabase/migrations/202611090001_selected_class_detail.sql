-- One narrowly scoped staff read. SECURITY INVOKER keeps all existing table RLS
-- and grants; in particular this cannot expose draft marks to a student.
create function public.get_staff_class_detail(target_section uuid)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; target_offering uuid;
begin
  select c.offering_id into target_offering from public.class_sections c where c.id=target_section;
  if target_offering is null or not (public.is_admin() or public.owns_offering(target_offering)) then
    raise exception 'CAMS: Only the assigned lecturer or an administrator can view class marks.';
  end if;
  with chosen as materialized (
    select c.*, p.code as programme_code, p.name as programme_name, o.carry_max, t.eligible_threshold
    from public.class_sections c join public.programmes p on p.id=c.programme_id
    join public.subject_offerings o on o.id=c.offering_id
    join public.academic_terms t on t.id=o.term_id where c.id=target_section
  ), roster as materialized (
    select e.id,e.student_id,s.matrix_no,s.full_name
    from public.enrolments e join public.students s on s.id=e.student_id
    where e.section_id=target_section and e.status='enrolled'
  ), components as materialized (
    select a.id,a.name,a.assessment_type,a.max_score,a.carry_weight,a.position
    from public.assessments a where a.offering_id=target_offering
  ), cells as materialized (
    select m.enrolment_id,m.assessment_id,m.score from public.marks m
    join roster r on r.id=m.enrolment_id
  ), totals as (
    -- Same expression and rounding as student_carry_totals; only selected roster.
    select r.id,round(coalesce(sum(m.score/a.max_score*a.carry_weight),0::numeric),2) as total_carry
    from roster r left join components a on true
    left join cells m on m.enrolment_id=r.id and m.assessment_id=a.id group by r.id
  )
  select jsonb_build_object(
    'settings',jsonb_build_object('carryMax',c.carry_max,'eligibleThreshold',c.eligible_threshold),
    'data',jsonb_build_object(
      'assessments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'type',a.assessment_type,
        'maxMarks',a.max_score,'weightage',a.carry_weight,'position',a.position) order by a.position) from components a),'[]'::jsonb),
      'sections',jsonb_build_array(jsonb_build_object(
        'id',c.id,'programmeId',c.programme_id,'programmeCode',c.programme_code,'programmeName',c.programme_name,
        'label',c.label,'dayOfWeek',c.day_of_week,'startsAt',c.starts_at,'endsAt',c.ends_at,'room',c.room,
        'capacity',c.capacity,'joinCode',c.join_code,
        'finalised',exists(select 1 from public.submissions s where s.section_id=c.id and s.status='finalised'),
        'students',coalesce((select jsonb_agg(jsonb_build_object(
          'enrolmentId',r.id,'studentId',r.student_id,'matrixNo',r.matrix_no,'name',r.full_name,
          'scores',coalesce((select jsonb_object_agg(m.assessment_id::text,m.score) from cells m where m.enrolment_id=r.id),'{}'::jsonb),
          'totalCarry',t.total_carry,'eligible',t.total_carry>=c.eligible_threshold
        ) order by r.matrix_no,r.id) from roster r join totals t on t.id=r.id),'[]'::jsonb)
      ))
    )
  ) into result from chosen c;
  return result;
end;
$$;
revoke all on function public.get_staff_class_detail(uuid) from public,anon;
grant execute on function public.get_staff_class_detail(uuid) to authenticated;
