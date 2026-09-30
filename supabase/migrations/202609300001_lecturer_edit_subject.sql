-- Subject catalogue records can be shared by several lecturers. Store editable
-- presentation details on the lecturer-owned offering instead of mutating the
-- shared catalogue row or any attached assessment data.
alter table public.subject_offerings
  add column subject_name_override text
    check (subject_name_override is null or length(trim(subject_name_override)) between 1 and 200),
  add column programme_semester_override smallint
    check (programme_semester_override between 1 and 12);

create function public.update_lecturer_subject(
  target_offering uuid,
  subject_name text,
  programme_semester integer
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'lecturer' and is_active
  ) then
    raise exception 'An active lecturer account is required.';
  end if;
  if subject_name is null or length(trim(subject_name)) not between 1 and 200 then
    raise exception 'Enter a subject name of up to 200 characters.';
  end if;
  if programme_semester is null or programme_semester not between 1 and 12 then
    raise exception 'Programme semester must be between 1 and 12.';
  end if;

  update public.subject_offerings
  set subject_name_override = trim(subject_name),
      programme_semester_override = programme_semester,
      updated_at = now()
  where id = target_offering and lecturer_id = auth.uid();

  if not found then
    raise exception 'You can only edit subjects assigned to your lecturer account.';
  end if;
end;
$$;

revoke all on function public.update_lecturer_subject(uuid, text, integer) from public, anon;
grant execute on function public.update_lecturer_subject(uuid, text, integer) to authenticated;

-- Keep the student web and mobile read models consistent with the lecturer's
-- offering-specific subject name. The shared subject code remains unchanged.
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
      subject.code,
      coalesce(offering.subject_name_override, subject.name) as name,
      lecturer.full_name as lecturer_name,
      section.label as section_label,
      term.academic_year,
      term.semester_no,
      coalesce(offering.carry_max, term.carry_max) as carry_max,
      totals.total_carry,
      totals.eligible,
      totals.eligible_threshold,
      submission.status = 'finalised' as finalised,
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
        'semester', coalesce((select semester_no || ' / ' || academic_year from my_enrolments limit 1), 'Current semester'),
        'academic_advisor', coalesce((select lecturer_name from my_enrolments order by code limit 1), 'Not assigned')
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
            left join public.marks mark
              on mark.assessment_id = assessment.id and mark.enrolment_id = item.enrolment_id
            where assessment.offering_id = item.offering_id and assessment.is_published
          ), '[]'::jsonb)
        ) order by item.code
      ) from my_enrolments item
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_my_subjects()
returns table (
  offering_id uuid,
  subject_code text,
  subject_name text,
  lecturer_name text,
  section_label text,
  academic_year text,
  semester_no smallint,
  carry_mark numeric,
  carry_max numeric,
  eligible boolean,
  finalised boolean,
  last_updated timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select
    so.id,
    sub.code,
    coalesce(so.subject_name_override, sub.name),
    lecturer.full_name,
    cs.label,
    term.academic_year,
    term.semester_no,
    totals.total_carry,
    coalesce(so.carry_max, term.carry_max),
    totals.eligible,
    coalesce(submission.status = 'finalised', false),
    max(m.updated_at)
  from public.students student
  join public.enrolments e on e.student_id = student.id and e.status = 'enrolled'
  join public.class_sections cs on cs.id = e.section_id
  join public.subject_offerings so on so.id = cs.offering_id
  join public.subjects sub on sub.id = so.subject_id
  join public.profiles lecturer on lecturer.id = so.lecturer_id
  join public.academic_terms term on term.id = so.term_id
  left join public.student_carry_totals totals on totals.enrolment_id = e.id
  left join public.submissions submission on submission.section_id = cs.id
  left join public.marks m on m.enrolment_id = e.id
  where student.auth_user_id = (select auth.uid())
  group by so.id, sub.code, sub.name, lecturer.full_name, cs.label,
           term.academic_year, term.semester_no, totals.total_carry,
           coalesce(so.carry_max, term.carry_max), totals.eligible, submission.status
  order by sub.code;
$$;
