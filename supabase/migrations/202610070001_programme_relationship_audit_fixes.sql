-- Stable lecturer read model: programme labels come from classes when classes
-- exist, with the teaching offering programme retained as the empty-state default.
create function public.get_my_lecturer_subjects()
returns table (
  offering_id uuid,
  default_programme_id uuid,
  programme_ids uuid[],
  programme_codes text[],
  programme_names text[],
  subject_code text,
  subject_name text,
  programme_semester smallint,
  student_count bigint,
  offering_status text,
  updated_at timestamptz,
  academic_year text,
  semester_no smallint
)
language sql stable security definer set search_path = '' as $$
  select
    offering.id,
    offering.programme_id,
    coalesce(class_programmes.ids, array[offering.programme_id]),
    coalesce(class_programmes.codes, array[offering_programme.code]),
    coalesce(class_programmes.names, array[offering_programme.name]),
    subject.code,
    coalesce(offering.subject_name_override, subject.name),
    coalesce(offering.programme_semester_override, subject.programme_semester),
    (
      select count(*)
      from public.class_sections section
      join public.enrolments enrolment on enrolment.section_id = section.id
      where section.offering_id = offering.id and enrolment.status = 'enrolled'
    ),
    offering.status::text,
    offering.updated_at,
    term.academic_year,
    term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.programmes offering_programme on offering_programme.id = offering.programme_id
  join public.academic_terms term on term.id = offering.term_id
  left join lateral (
    select
      array_agg(programme.id order by programme.code) as ids,
      array_agg(programme.code order by programme.code) as codes,
      array_agg(programme.name order by programme.code) as names
    from (
      select distinct section.programme_id
      from public.class_sections section
      where section.offering_id = offering.id
    ) assigned
    join public.programmes programme on programme.id = assigned.programme_id
  ) class_programmes on true
  where offering.lecturer_id = (select auth.uid())
    and term.is_current
    and exists (
      select 1 from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'lecturer'
        and profile.is_active
    )
  order by offering.updated_at desc;
$$;

revoke all on function public.get_my_lecturer_subjects() from public, anon;
grant execute on function public.get_my_lecturer_subjects() to authenticated;
