-- Reduce client round trips for the two largest initial data loads while
-- retaining role checks inside security-definer functions.

create index if not exists subject_offerings_term_lecturer_idx
  on public.subject_offerings(term_id, lecturer_id);
create index if not exists profiles_active_lecturer_idx
  on public.profiles(role, is_active) where is_active;
create index if not exists students_programme_idx
  on public.students(programme_id);
create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists mark_disputes_student_created_idx
  on public.mark_disputes(student_id, created_at desc);
create index if not exists mark_disputes_offering_created_idx
  on public.mark_disputes(offering_id, created_at desc);

create or replace function public.get_admin_current_overview()
returns jsonb
language sql
stable
security definer
set search_path = '' as $$
  with current_term as (
    select term.id, term.academic_year, term.semester_code, term.semester_no,
      term.default_deadline
    from public.academic_terms term
    where term.is_current and term.status = 'active'
    limit 1
  ), allocation_rows as (
    select offering.lecturer_id,
      jsonb_build_object(
        'offering_id', offering.id,
        'offering_status', offering.status::text,
        'offering_updated_at', offering.updated_at,
        'subject_code', subject.code,
        'subject_name', coalesce(offering.subject_name_override, subject.name),
        'section_id', section.id,
        'class_label', section.label,
        'programme_id', programme.id,
        'programme_code', programme.code,
        'programme_name', programme.name,
        'section_updated_at', section.updated_at,
        'student_count', count(enrolment.id) filter (where enrolment.status = 'enrolled'),
        'deadline_at', coalesce(offering.deadline_at, deadline.deadline_at, term.default_deadline),
        'submission_status', submission.status::text,
        'submission_updated_at', submission.updated_at
      ) as allocation
    from current_term term
    join public.subject_offerings offering on offering.term_id = term.id
    join public.subjects subject on subject.id = offering.subject_id
    left join public.class_sections section on section.offering_id = offering.id
    left join public.programmes programme on programme.id = section.programme_id
    left join public.programme_deadlines deadline
      on deadline.term_id = term.id and deadline.programme_id = section.programme_id
    left join public.enrolments enrolment on enrolment.section_id = section.id
    left join public.submissions submission on submission.section_id = section.id
    group by offering.id, subject.id, section.id, programme.id,
      deadline.deadline_at, term.default_deadline, submission.id
  ), allocations_by_lecturer as (
    select allocation_rows.lecturer_id,
      jsonb_agg(allocation_rows.allocation order by allocation_rows.allocation->>'subject_code', allocation_rows.allocation->>'class_label') as allocations
    from allocation_rows
    group by allocation_rows.lecturer_id
  ), lecturer_payload as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'auth_id', profile.id,
      'staff_no', profile.staff_no,
      'full_name', profile.full_name,
      'allocations', coalesce(grouped.allocations, '[]'::jsonb)
    ) order by profile.full_name), '[]'::jsonb) as lecturers
    from public.profiles profile
    left join allocations_by_lecturer grouped on grouped.lecturer_id = profile.id
    where profile.role = 'lecturer' and profile.is_active
  ), programme_payload as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', programme.id, 'code', programme.code, 'name', programme.name
    ) order by programme.code), '[]'::jsonb) as programmes
    from public.programmes programme
    where programme.is_active
  )
  select jsonb_build_object(
    'term', (
      select jsonb_build_object(
        'id', term.id,
        'academic_year', term.academic_year,
        'semester_code', term.semester_code,
        'semester_no', term.semester_no,
        'default_deadline', term.default_deadline
      ) from current_term term
    ),
    'programmes', programme_payload.programmes,
    'lecturers', lecturer_payload.lecturers
  )
  from lecturer_payload cross join programme_payload
  where public.is_admin();
$$;

revoke all on function public.get_admin_current_overview() from public, anon;
grant execute on function public.get_admin_current_overview() to authenticated;

create or replace function public.get_admin_semester_history()
returns table (
  id uuid,
  academic_year text,
  semester_code text,
  semester_no smallint,
  starts_on date,
  ends_on date,
  offering_count bigint,
  class_count bigint,
  enrolment_count bigint,
  finalised_count bigint
)
language sql
stable
security definer
set search_path = '' as $$
  select term.id, term.academic_year, term.semester_code, term.semester_no,
    term.starts_on, term.ends_on,
    count(distinct offering.id),
    count(distinct section.id),
    count(distinct enrolment.id),
    count(distinct submission.section_id) filter (where submission.status = 'finalised')
  from public.academic_terms term
  left join public.subject_offerings offering on offering.term_id = term.id
  left join public.class_sections section on section.offering_id = offering.id
  left join public.enrolments enrolment on enrolment.section_id = section.id
  left join public.submissions submission on submission.section_id = section.id
  where public.is_admin() and term.status = 'closed'
  group by term.id
  order by term.starts_on desc;
$$;

revoke all on function public.get_admin_semester_history() from public, anon;
grant execute on function public.get_admin_semester_history() to authenticated;

create or replace function public.get_my_lecturer_subject_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = '' as $$
  select jsonb_build_object(
    'current', coalesce((
      select jsonb_agg(to_jsonb(subject_row))
      from public.get_my_lecturer_subjects() subject_row
    ), '[]'::jsonb),
    'archived', coalesce((
      select jsonb_agg(to_jsonb(subject_row))
      from public.get_my_archived_lecturer_subjects() subject_row
    ), '[]'::jsonb),
    'term', (
      select jsonb_build_object(
        'academic_year', term.academic_year,
        'semester_no', term.semester_no,
        'semester_code', term.semester_code
      )
      from public.academic_terms term
      where term.is_current and term.status = 'active'
      limit 1
    )
  )
  where exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.role = 'lecturer' and profile.is_active
  );
$$;

revoke all on function public.get_my_lecturer_subject_dashboard() from public, anon;
grant execute on function public.get_my_lecturer_subject_dashboard() to authenticated;

create or replace function public.get_my_student_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = '' as $$
declare
  onboarding jsonb;
  portal jsonb := null;
begin
  select to_jsonb(state) into onboarding
  from public.get_my_student_onboarding_state() state;

  if coalesce((onboarding->>'profile_complete')::boolean, false) then
    portal := public.get_my_mobile_portal();
  end if;

  return jsonb_build_object('onboarding', onboarding, 'portal', portal);
end;
$$;

revoke all on function public.get_my_student_bootstrap() from public, anon;
grant execute on function public.get_my_student_bootstrap() to authenticated;

notify pgrst, 'reload schema';
