-- Keep programme on classes. Existing offering/assessment/mark IDs are preserved.

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
    offering.status::text, offering.updated_at, term.academic_year, term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.academic_terms term on term.id = offering.term_id
  left join lateral (
    select array_agg(p.id order by p.code) ids, array_agg(p.code order by p.code) codes,
      array_agg(p.name order by p.code) names
    from public.programmes p
    where p.id in (select section.programme_id from public.class_sections section where section.offering_id = offering.id)
  ) programme on true
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
    offering.status::text, offering.updated_at, term.academic_year, term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.academic_terms term on term.id = offering.term_id
  left join lateral (
    select array_agg(p.id order by p.code) ids, array_agg(p.code order by p.code) codes,
      array_agg(p.name order by p.code) names
    from public.programmes p
    where p.id in (select section.programme_id from public.class_sections section where section.offering_id = offering.id)
  ) programme on true
  where offering.lecturer_id = (select auth.uid()) and term.status = 'closed' and not term.is_current
    and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.role = 'lecturer' and profile.is_active)
  order by term.starts_on desc, offering.programme_semester, subject.code, offering.id;
$function$;

CREATE OR REPLACE FUNCTION public.validate_class_programme()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.programmes where id = new.programme_id and is_active) then
    raise exception 'Select an active programme for this class.';
  end if;
  if tg_op = 'UPDATE' and new.programme_id <> old.programme_id and exists (
    select 1 from public.enrolments enrolment
    join public.students student on student.id = enrolment.student_id
    where enrolment.section_id = old.id and enrolment.status = 'enrolled'
      and student.programme_id <> new.programme_id
  ) then
    raise exception 'The class programme cannot be changed while students from another programme are enrolled.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_lecturer_subject(target_offering uuid, subject_name text, offering_semester integer, teaching_programme_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'lecturer' and is_active) then
    raise exception 'An active lecturer account is required.';
  end if;
  if not exists (select 1 from public.programmes where id = teaching_programme_id and is_active) then
    raise exception 'Select an active programme for this subject offering.';
  end if;
  if subject_name is null or length(trim(subject_name)) not between 1 and 200 then
    raise exception 'Enter a subject name of up to 200 characters.';
  end if;
  if offering_semester is null or offering_semester not between 1 and 12 then
    raise exception 'Programme semester must be between 1 and 12.';
  end if;

  begin
    update public.subject_offerings
    set subject_name_override = trim(subject_name), programme_id = teaching_programme_id,
        programme_semester = offering_semester, updated_at = now()
    where id = target_offering and lecturer_id = auth.uid();
    if not found then raise exception 'You can only edit subjects assigned to your lecturer account.'; end if;
    -- Subject edits never rewrite individual class programme relationships.
  exception when unique_violation then
    raise exception 'This subject already has an offering for the selected programme and semester in the current academic session.';
  end;
end;
$function$;

notify pgrst, 'reload schema';
