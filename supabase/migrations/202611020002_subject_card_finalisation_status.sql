-- Display-only subject status: all classes, including legacy programme-split offerings.
-- Do not mutate offering/submission status or invoke finalisation/notifications.
CREATE OR REPLACE FUNCTION public.get_my_lecturer_subjects()
 RETURNS TABLE(offering_id uuid, programme_ids uuid[], programme_codes text[], programme_names text[], subject_code text, subject_name text, programme_semester smallint, student_count bigint, offering_status text, updated_at timestamp with time zone, academic_year text, semester_no smallint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select offering.id,
    coalesce(programme.ids, '{}'::uuid[]), coalesce(programme.codes, '{}'::text[]), coalesce(programme.names, '{}'::text[]),
    subject.code, coalesce(offering.subject_name_override, subject.name), offering.programme_semester,
    (select count(*) from public.class_sections section join public.enrolments enrolment on enrolment.section_id = section.id where section.offering_id = offering.id and enrolment.status = 'enrolled'),
    case when class_release.class_count > 0 and class_release.all_finalised then 'completed' else 'active' end::text, offering.updated_at, term.academic_year, term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.academic_terms term on term.id = offering.term_id
  left join lateral (
    select array_agg(p.id order by p.code) ids, array_agg(p.code order by p.code) codes,
      array_agg(p.name order by p.code) names
    from public.programmes p
    where p.id in (select section.programme_id from public.class_sections section where section.offering_id = offering.id)
  ) programme on true
  cross join lateral (
    select count(section.id) as class_count,
      coalesce(bool_and(coalesce(submission.status = 'finalised', false)), false) as all_finalised
    from public.subject_offerings related_offering
    join public.class_sections section on section.offering_id = related_offering.id
    left join public.submissions submission on submission.section_id = section.id
    where related_offering.lecturer_id = offering.lecturer_id
      and related_offering.subject_id = offering.subject_id
      and related_offering.term_id = offering.term_id
      and related_offering.programme_semester is not distinct from offering.programme_semester
  ) class_release
  where offering.lecturer_id = (select auth.uid()) and term.is_current
    and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.role = 'lecturer' and profile.is_active)
  order by offering.programme_semester, subject.code, offering.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_archived_lecturer_subjects()
 RETURNS TABLE(offering_id uuid, programme_ids uuid[], programme_codes text[], programme_names text[], subject_code text, subject_name text, programme_semester smallint, student_count bigint, offering_status text, updated_at timestamp with time zone, academic_year text, semester_no smallint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select offering.id,
    coalesce(programme.ids, '{}'::uuid[]), coalesce(programme.codes, '{}'::text[]), coalesce(programme.names, '{}'::text[]),
    subject.code, coalesce(offering.subject_name_override, subject.name), offering.programme_semester,
    (select count(*) from public.class_sections section join public.enrolments enrolment on enrolment.section_id = section.id where section.offering_id = offering.id and enrolment.status in ('enrolled', 'completed')),
    case when class_release.class_count > 0 and class_release.all_finalised then 'completed' else 'active' end::text, offering.updated_at, term.academic_year, term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.academic_terms term on term.id = offering.term_id
  left join lateral (
    select array_agg(p.id order by p.code) ids, array_agg(p.code order by p.code) codes,
      array_agg(p.name order by p.code) names
    from public.programmes p
    where p.id in (select section.programme_id from public.class_sections section where section.offering_id = offering.id)
  ) programme on true
  cross join lateral (
    select count(section.id) as class_count,
      coalesce(bool_and(coalesce(submission.status = 'finalised', false)), false) as all_finalised
    from public.subject_offerings related_offering
    join public.class_sections section on section.offering_id = related_offering.id
    left join public.submissions submission on submission.section_id = section.id
    where related_offering.lecturer_id = offering.lecturer_id
      and related_offering.subject_id = offering.subject_id
      and related_offering.term_id = offering.term_id
      and related_offering.programme_semester is not distinct from offering.programme_semester
  ) class_release
  where offering.lecturer_id = (select auth.uid()) and term.status = 'closed' and not term.is_current
    and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.role = 'lecturer' and profile.is_active)
  order by term.starts_on desc, offering.programme_semester, subject.code, offering.id;
$function$;

notify pgrst, 'reload schema';
