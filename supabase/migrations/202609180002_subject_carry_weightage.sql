-- Existing subjects retain their current limits; new offerings require lecturer setup.
alter table public.subject_offerings add column carry_max numeric(6,2)
  check (carry_max > 0 and carry_max <= 100);
update public.subject_offerings so set carry_max = t.carry_max
from public.academic_terms t where t.id = so.term_id;

create function public.set_offering_carry_max(target_offering uuid, total_weight numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.subject_offerings so join public.profiles p on p.id = so.lecturer_id
  where so.id = target_offering and p.id = auth.uid() and p.role = 'lecturer' and p.is_active
  for update of so;
  if not found then raise exception 'Only the active lecturer for this subject can change its weightage.'; end if;
  if total_weight is null or total_weight <= 0 or total_weight > 100 or total_weight <> round(total_weight, 2) then
    raise exception 'Total weightage must be greater than 0 and at most 100, with up to two decimal places.';
  end if;
  if exists (select 1 from public.class_sections cs join public.submissions s on s.section_id = cs.id
    where cs.offering_id = target_offering and s.status = 'finalised') then
    raise exception 'Reopen finalised submissions before changing total weightage.';
  end if;
  if (select coalesce(sum(carry_weight), 0) from public.assessments where offering_id = target_offering) > total_weight then
    raise exception 'Total weightage cannot be less than the assessment weightage already allocated.';
  end if;
  update public.subject_offerings set carry_max = total_weight where id = target_offering;
end;
$$;
revoke all on function public.set_offering_carry_max(uuid,numeric) from public, anon;
grant execute on function public.set_offering_carry_max(uuid,numeric) to authenticated;

-- Enforce the same limit for direct API calls and concurrent assessment writes.
create function public.validate_assessment_carry_weight()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  carry_limit numeric;
  allocated numeric;
begin
  if tg_op = 'UPDATE' and new.offering_id <> old.offering_id then
    raise exception 'An assessment cannot be moved to another subject.';
  end if;
  select carry_max into carry_limit from public.subject_offerings where id = new.offering_id for update;
  if carry_limit is null then raise exception 'Set the total carry-mark weightage for this subject first.'; end if;
  select coalesce(sum(carry_weight),0) into allocated from public.assessments
  where offering_id = new.offering_id and id <> new.id;
  if allocated + new.carry_weight > carry_limit then
    raise exception 'Assessment weightage exceeds the subject total of %.', carry_limit;
  end if;
  return new;
end;
$$;
create trigger assessments_carry_limit before insert or update of carry_weight, offering_id
on public.assessments for each row execute function public.validate_assessment_carry_weight();

create or replace function public.finalise_section(target_section uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_offering uuid;
  carry_limit numeric;
  weight_total numeric;
  missing_marks bigint;
  subject_code text;
begin
  select cs.offering_id, so.carry_max, sub.code
    into target_offering, carry_limit, subject_code
  from public.class_sections cs
  join public.subject_offerings so on so.id = cs.offering_id
  join public.academic_terms t on t.id = so.term_id
  join public.subjects sub on sub.id = so.subject_id
  where cs.id = target_section;

  if target_offering is null then raise exception 'Section not found'; end if;
  if not (public.is_admin() or public.owns_offering(target_offering)) then raise exception 'Not authorized'; end if;

  select carry_max into carry_limit from public.subject_offerings where id = target_offering for update;
  if carry_limit is null then raise exception 'Set the total carry-mark weightage for this subject first.'; end if;

  select coalesce(sum(carry_weight), 0) into weight_total
  from public.assessments where offering_id = target_offering;
  if weight_total <> carry_limit then
    raise exception 'Assessment carry weights (%) must total %', weight_total, carry_limit;
  end if;

  select count(*) into missing_marks
  from public.enrolments e
  cross join public.assessments a
  left join public.marks m on m.enrolment_id = e.id and m.assessment_id = a.id
  where e.section_id = target_section and e.status = 'enrolled'
    and a.offering_id = target_offering and m.score is null;
  if missing_marks > 0 then raise exception '% assessment marks are missing', missing_marks; end if;

  insert into public.submissions(section_id, status, finalised_by, finalised_at)
  values (target_section, 'finalised', auth.uid(), now())
  on conflict (section_id) do update set
    status = 'finalised', finalised_by = auth.uid(), finalised_at = now(),
    reopened_by = null, reopened_at = null, reopen_reason = null;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, subject_code_snapshot)
  values (auth.uid(), 'finalised carry marks', 'class_section', target_section, subject_code);
end;
$$;


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
    sub.name,
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

