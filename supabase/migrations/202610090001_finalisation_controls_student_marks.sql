-- Assessment structure is visible to enrolled students, but marks, calculated
-- totals and eligibility remain private lecturer data until that class is finalised.

drop policy if exists marks_read on public.marks;
create policy marks_read on public.marks for select to authenticated using (
  public.is_admin()
  or exists (
    select 1 from public.enrolments enrolment
    join public.class_sections section on section.id = enrolment.section_id
    where enrolment.id = marks.enrolment_id
      and public.owns_offering(section.offering_id)
  )
  or exists (
    select 1 from public.enrolments enrolment
    join public.students student on student.id = enrolment.student_id
    join public.class_sections section on section.id = enrolment.section_id
    join public.subject_offerings offering on offering.id = section.offering_id
    join public.academic_terms term on term.id = offering.term_id
    join public.submissions submission on submission.section_id = section.id
    where enrolment.id = marks.enrolment_id
      and student.auth_user_id = (select auth.uid()) and student.is_active
      and enrolment.status = 'enrolled'
      and term.is_current and term.status = 'active'
      and submission.status = 'finalised'
  )
);

-- A security-invoker aggregate can otherwise reveal a misleading zero total
-- before release. Only a checked staff RPC may read this view directly.
revoke select on public.student_carry_totals from authenticated;

create function public.get_offering_student_totals(target_offering uuid)
returns table (enrolment_id uuid, total_carry numeric, eligible boolean)
language sql stable security definer set search_path = '' as $$
  select totals.enrolment_id, totals.total_carry, totals.eligible
  from public.student_carry_totals totals
  join public.enrolments enrolment on enrolment.id = totals.enrolment_id
  join public.class_sections section on section.id = enrolment.section_id
  where section.offering_id = target_offering
    and (public.is_admin() or public.owns_offering(target_offering));
$$;
revoke all on function public.get_offering_student_totals(uuid) from public, anon;
grant execute on function public.get_offering_student_totals(uuid) to authenticated;

create or replace function public.get_my_mobile_portal_payload()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (
    select student.id, student.matrix_no, student.full_name, programme.name as programme_name
    from public.students student
    join public.programmes programme on programme.id = student.programme_id
    where student.auth_user_id = (select auth.uid()) and student.is_active
  ), my_enrolments as (
    select enrolment.id enrolment_id, offering.id offering_id, section.id section_id,
      subject.code, coalesce(offering.subject_name_override, subject.name) name,
      lecturer.full_name lecturer_name, section.label section_label,
      term.academic_year, term.semester_no,
      coalesce(offering.carry_max, term.carry_max) carry_max,
      case when submission.status = 'finalised' then totals.total_carry end total_carry,
      case when submission.status = 'finalised' then totals.eligible end eligible,
      totals.eligible_threshold,
      submission.status = 'finalised' finalised, submission.finalised_at,
      case when submission.status = 'finalised' then
        coalesce((select max(mark.updated_at) from public.marks mark where mark.enrolment_id = enrolment.id), submission.finalised_at)
      end last_updated
    from me
    join public.enrolments enrolment on enrolment.student_id = me.id and enrolment.status = 'enrolled'
    join public.class_sections section on section.id = enrolment.section_id
    join public.subject_offerings offering on offering.id = section.offering_id
    join public.subjects subject on subject.id = offering.subject_id
    join public.profiles lecturer on lecturer.id = offering.lecturer_id
    join public.academic_terms term on term.id = offering.term_id and term.is_current and term.status = 'active'
    left join public.student_carry_totals totals on totals.enrolment_id = enrolment.id
    left join public.submissions submission on submission.section_id = section.id
  )
  select jsonb_build_object(
    'student', (select jsonb_build_object('matrix_number', me.matrix_no, 'name', me.full_name,
      'programme', me.programme_name, 'faculty', 'Faculty of Computer & Mathematical Sciences',
      'semester', (select semester_no || ' / ' || academic_year from my_enrolments limit 1),
      'academic_advisor', null) from me),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
      'offering_id', item.offering_id, 'code', item.code, 'name', item.name,
      'lecturer', item.lecturer_name, 'group', item.section_label,
      'carry_mark', item.total_carry, 'carry_maximum', item.carry_max,
      'eligible', item.eligible, 'eligible_threshold', item.eligible_threshold,
      'is_finalised', coalesce(item.finalised, false), 'last_updated', item.last_updated,
      'assessments', coalesce((select jsonb_agg(jsonb_build_object(
        'name', assessment.name, 'assessment_type', assessment.assessment_type,
        'score', case when item.finalised then mark.score else null end,
        'maximum', assessment.max_score,
        'carry_contribution', case when item.finalised and mark.score is not null
          then round(mark.score / assessment.max_score * assessment.carry_weight, 2) else null end,
        'weight', assessment.carry_weight::integer) order by assessment.position)
        from public.assessments assessment
        left join public.marks mark on mark.assessment_id = assessment.id and mark.enrolment_id = item.enrolment_id
        where assessment.offering_id = item.offering_id), '[]'::jsonb)
      ) order by item.code) from my_enrolments item), '[]'::jsonb),
    'notifications_enabled', true,
    'notifications', coalesce((select jsonb_agg(jsonb_build_object(
      'id', item.section_id, 'title', item.code || ' carry marks finalised',
      'body', item.name || ' results were finalised by ' || item.lecturer_name || '.',
      'created_at', item.finalised_at) order by item.finalised_at desc)
      from my_enrolments item where item.finalised and item.finalised_at is not null), '[]'::jsonb)
  );
$$;

revoke all on function public.get_my_mobile_portal_payload() from public, anon, authenticated;
notify pgrst, 'reload schema';
