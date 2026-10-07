-- Remove presentation-only fallbacks from the authenticated student read model.
-- Notification items are derived from real finalised submissions because the
-- existing notifications table targets staff profiles, not student accounts.
create or replace function public.get_my_mobile_portal()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (
    select student.id, student.matrix_no, student.full_name, programme.name as programme_name
    from public.students student
    join public.programmes programme on programme.id = student.programme_id
    where student.auth_user_id = (select auth.uid()) and student.is_active
  ), my_enrolments as (
    select
      enrolment.id as enrolment_id,
      offering.id as offering_id,
      section.id as section_id,
      subject.code,
      coalesce(offering.subject_name_override, subject.name) as name,
      lecturer.full_name as lecturer_name,
      section.label as section_label,
      term.id as term_id,
      term.academic_year,
      term.semester_no,
      coalesce(offering.carry_max, term.carry_max) as carry_max,
      totals.total_carry,
      totals.eligible,
      totals.eligible_threshold,
      submission.status = 'finalised' as finalised,
      submission.finalised_at,
      coalesce((select max(mark.updated_at) from public.marks mark where mark.enrolment_id = enrolment.id), enrolment.enrolled_at) as last_updated
    from me
    join public.enrolments enrolment on enrolment.student_id = me.id and enrolment.status = 'enrolled'
    join public.class_sections section on section.id = enrolment.section_id
    join public.subject_offerings offering on offering.id = section.offering_id
    join public.subjects subject on subject.id = offering.subject_id
    join public.profiles lecturer on lecturer.id = offering.lecturer_id
    join public.academic_terms term on term.id = offering.term_id
    left join public.student_carry_totals totals on totals.enrolment_id = enrolment.id
    left join public.submissions submission on submission.section_id = section.id
  )
  select jsonb_build_object(
    'student', (
      select jsonb_build_object(
        'matrix_number', me.matrix_no,
        'name', me.full_name,
        'programme', me.programme_name,
        'faculty', 'Faculty of Computer & Mathematical Sciences',
        'semester', (select semester_no || ' / ' || academic_year from my_enrolments order by academic_year desc, semester_no desc limit 1),
        'academic_advisor', null
      ) from me
    ),
    'subjects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'offering_id', item.offering_id,
          'code', item.code,
          'name', item.name,
          'lecturer', item.lecturer_name,
          'group', item.section_label,
          'carry_mark', item.total_carry,
          'carry_maximum', item.carry_max,
          'eligible', item.eligible,
          'eligible_threshold', item.eligible_threshold,
          'is_finalised', coalesce(item.finalised, false),
          'last_updated', item.last_updated,
          'assessments', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', assessment.name,
                'assessment_type', assessment.assessment_type,
                'score', mark.score,
                'maximum', assessment.max_score,
                'carry_contribution', case when mark.score is null then null else round(mark.score / assessment.max_score * assessment.carry_weight, 2) end,
                'weight', assessment.carry_weight::integer
              ) order by assessment.position
            )
            from public.assessments assessment
            left join public.marks mark on mark.assessment_id = assessment.id and mark.enrolment_id = item.enrolment_id
            where assessment.offering_id = item.offering_id and assessment.is_published
          ), '[]'::jsonb)
        ) order by item.code
      ) from my_enrolments item
    ), '[]'::jsonb),
    'notifications_enabled', (
      select setting.notify_students
      from public.notification_settings setting
      join public.academic_terms term on term.id = setting.term_id
      where term.is_current
      limit 1
    ),
    'notifications', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.section_id,
          'title', item.code || ' carry marks finalised',
          'body', item.name || ' results were finalised by ' || item.lecturer_name || '.',
          'created_at', item.finalised_at
        ) order by item.finalised_at desc
      )
      from my_enrolments item
      where item.finalised
        and item.finalised_at is not null
        and exists (
          select 1 from public.notification_settings setting
          where setting.term_id = item.term_id and setting.notify_students
        )
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_my_mobile_portal() from public, anon;
grant execute on function public.get_my_mobile_portal() to authenticated;
