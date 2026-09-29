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
      subject.name,
      lecturer.full_name as lecturer_name,
      section.label as section_label,
      term.academic_year,
      term.semester_no,
      term.carry_max,
      totals.total_carry,
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
          'is_finalised', coalesce(item.finalised, false),
          'last_updated', item.last_updated,
          'assessments', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'name', assessment.name,
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

grant execute on function public.get_my_mobile_portal() to authenticated;
revoke execute on function public.get_my_mobile_portal() from anon;

create table if not exists public.mark_disputes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  offering_id uuid not null references public.subject_offerings(id) on delete cascade,
  assessment_name text not null,
  explanation text not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mark_disputes enable row level security;
revoke all on public.mark_disputes from anon, authenticated;
grant select on public.mark_disputes to authenticated;

create policy mark_disputes_student_read on public.mark_disputes
for select to authenticated using (public.is_current_student(student_id));

create policy mark_disputes_staff_read on public.mark_disputes
for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.subject_offerings offering
    where offering.id = mark_disputes.offering_id
      and offering.lecturer_id = (select auth.uid())
  )
);

create trigger mark_disputes_updated_at
before update on public.mark_disputes
for each row execute function public.set_updated_at();

create or replace function public.submit_mark_dispute(target_offering uuid, target_assessment text, target_explanation text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target_student uuid;
  dispute_id uuid;
begin
  select id into target_student
  from public.students
  where auth_user_id = auth.uid() and is_active;

  if target_student is null then raise exception 'No active student record is linked to this account'; end if;
  if trim(target_assessment) = '' or trim(target_explanation) = '' then raise exception 'Assessment and explanation are required'; end if;
  if not exists (
    select 1
    from public.enrolments enrolment
    join public.class_sections section on section.id = enrolment.section_id
    where enrolment.student_id = target_student
      and enrolment.status = 'enrolled'
      and section.offering_id = target_offering
  ) then raise exception 'You are not enrolled in this subject'; end if;

  insert into public.mark_disputes(student_id, offering_id, assessment_name, explanation)
  values (target_student, target_offering, trim(target_assessment), trim(target_explanation))
  returning id into dispute_id;
  return dispute_id;
end;
$$;

grant execute on function public.submit_mark_dispute(uuid, text, text) to authenticated;
revoke execute on function public.submit_mark_dispute(uuid, text, text) from anon;
