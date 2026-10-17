-- Security hardening: active-role ownership, finalisation integrity, narrowly
-- scoped notification writes, bounded student input and join-code throttling.

create or replace function public.owns_offering(target_offering uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.subject_offerings offering
    join public.profiles lecturer on lecturer.id = offering.lecturer_id
    where offering.id = target_offering
      and offering.lecturer_id = (select auth.uid())
      and lecturer.role = 'lecturer'
      and lecturer.is_active
  );
$$;

create or replace function public.student_can_read_lecturer(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students student
    join public.enrolments enrolment on enrolment.student_id = student.id
    join public.class_sections section on section.id = enrolment.section_id
    join public.subject_offerings offering on offering.id = section.offering_id
    join public.academic_terms term on term.id = offering.term_id
    join public.profiles lecturer on lecturer.id = offering.lecturer_id
    where student.auth_user_id = (select auth.uid()) and student.is_active
      and enrolment.status = 'enrolled' and offering.lecturer_id = target
      and term.is_current and term.status = 'active'
      and lecturer.role = 'lecturer' and lecturer.is_active
  );
$$;

drop policy if exists mark_disputes_staff_read on public.mark_disputes;
create policy mark_disputes_staff_read on public.mark_disputes
for select to authenticated using (
  public.is_admin() or public.owns_offering(offering_id)
);

-- A finalised class must be explicitly reopened before any academic structure,
-- roster or marks beneath it can be changed or removed.
create function public.prevent_finalised_academic_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare locked boolean := false;
declare target_id uuid;
begin
  if tg_table_name = 'marks' then
    select exists (
      select 1 from public.enrolments enrolment
      join public.submissions submission on submission.section_id = enrolment.section_id
      where enrolment.id = old.enrolment_id and submission.status = 'finalised'
    ) into locked;
  elsif tg_table_name = 'assessments' then
    target_id := case when tg_op = 'DELETE' then old.offering_id else new.offering_id end;
    select exists (
      select 1 from public.class_sections section
      join public.submissions submission on submission.section_id = section.id
      where section.offering_id = target_id and submission.status = 'finalised'
    ) into locked;
  elsif tg_table_name = 'class_sections' then
    target_id := old.id;
    select exists (
      select 1 from public.submissions
      where section_id = target_id and status = 'finalised'
    ) into locked;
  elsif tg_table_name = 'enrolments' then
    select exists (
      select 1 from public.submissions
      where status = 'finalised' and (
        section_id = case when tg_op = 'INSERT' then new.section_id else old.section_id end
        or (tg_op = 'UPDATE' and section_id = new.section_id)
      )
    ) into locked;
  elsif tg_table_name = 'subject_offerings' then
    target_id := old.id;
    select exists (
      select 1 from public.class_sections section
      join public.submissions submission on submission.section_id = section.id
      where section.offering_id = target_id and submission.status = 'finalised'
    ) into locked;
  end if;

  if locked then raise exception 'Reopen the finalised class before changing its academic records.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists marks_prevent_finalised_delete on public.marks;
create trigger marks_prevent_finalised_delete before delete on public.marks
for each row execute function public.prevent_finalised_academic_mutation();

drop trigger if exists assessments_prevent_finalised_mutation on public.assessments;
create trigger assessments_prevent_finalised_mutation
before insert or update or delete on public.assessments
for each row execute function public.prevent_finalised_academic_mutation();

drop trigger if exists sections_prevent_finalised_mutation on public.class_sections;
create trigger sections_prevent_finalised_mutation
before update or delete on public.class_sections
for each row execute function public.prevent_finalised_academic_mutation();

drop trigger if exists enrolments_prevent_finalised_mutation on public.enrolments;
create trigger enrolments_prevent_finalised_mutation
before insert or update or delete on public.enrolments
for each row execute function public.prevent_finalised_academic_mutation();

drop trigger if exists offerings_prevent_finalised_structure_change on public.subject_offerings;
create trigger offerings_prevent_finalised_structure_change
before update of subject_id, lecturer_id, programme_id, programme_semester, carry_max, subject_name_override
or delete on public.subject_offerings
for each row execute function public.prevent_finalised_academic_mutation();

-- Users may acknowledge their own notification, but may not rewrite its
-- recipient, title, body, type or related entity.
revoke update on public.notifications from authenticated;
grant update (delivery_status) on public.notifications to authenticated;

-- Per-student throttling makes class-code guessing impractical even with a
-- valid account. No client-controlled identifier is used for this decision.
create table public.class_join_attempts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0)
);
alter table public.class_join_attempts enable row level security;
revoke all on public.class_join_attempts from public, anon, authenticated;

create function public.consume_class_join_attempt() returns boolean
language plpgsql security definer set search_path = '' as $$
declare attempt_count integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.class_join_attempts as attempts (auth_user_id)
  values (auth.uid())
  on conflict (auth_user_id) do update set
    attempts = case when attempts.window_started_at <= now() - interval '15 minutes' then 1 else attempts.attempts + 1 end,
    window_started_at = case when attempts.window_started_at <= now() - interval '15 minutes' then now() else attempts.window_started_at end
  returning attempts.attempts into attempt_count;
  return attempt_count <= 10;
end;
$$;
revoke all on function public.consume_class_join_attempt() from public, anon, authenticated;

create or replace function public.join_class_by_code(invitation_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target_student uuid; student_programme uuid; target_section uuid;
  target_offering uuid; class_programme uuid; enrolled_count integer; section_capacity integer;
begin
  if not public.consume_class_join_attempt() then return null; end if;
  if invitation_code is null or trim(invitation_code) !~ '^[A-Za-z0-9_-]{4,40}$' then
    return null;
  end if;
  select id, programme_id into target_student, student_programme
  from public.students where auth_user_id = auth.uid() and is_active;
  if target_student is null then raise exception 'No active student record is linked to this account'; end if;

  select section.id, section.offering_id, section.capacity, section.programme_id
  into target_section, target_offering, section_capacity, class_programme
  from public.class_sections section
  join public.subject_offerings offering on offering.id = section.offering_id
  join public.academic_terms term on term.id = offering.term_id
  where upper(section.join_code) = upper(trim(invitation_code))
    and offering.status in ('active', 'draft') and term.is_current and term.status = 'active'
  for update of section;
  if target_section is null then return null; end if;
  if student_programme <> class_programme then raise exception 'This class invitation is for a different programme'; end if;
  if exists (
    select 1 from public.enrolments enrolment
    join public.class_sections section on section.id = enrolment.section_id
    where enrolment.student_id = target_student and section.offering_id = target_offering
      and enrolment.status = 'enrolled'
  ) then raise exception 'You are already enrolled in this subject'; end if;
  select count(*) into enrolled_count from public.enrolments
  where section_id = target_section and status = 'enrolled';
  if enrolled_count >= section_capacity then raise exception 'This class is full'; end if;
  insert into public.enrolments(section_id, student_id, status)
  values (target_section, target_student, 'enrolled')
  on conflict (section_id, student_id) do update set status = 'enrolled';
  delete from public.class_join_attempts where auth_user_id = auth.uid();
  return target_section;
end;
$$;
revoke all on function public.join_class_by_code(text) from public, anon;
grant execute on function public.join_class_by_code(text) to authenticated;

create or replace function public.submit_mark_dispute(
  target_offering uuid, target_assessment text, target_explanation text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target_student uuid; dispute_id uuid;
begin
  select id into target_student from public.students
  where auth_user_id = auth.uid() and is_active;
  if target_student is null then raise exception 'No active student record is linked to this account'; end if;
  if length(trim(coalesce(target_assessment, ''))) not between 1 and 200 then
    raise exception 'Select a valid assessment.';
  end if;
  if length(trim(coalesce(target_explanation, ''))) not between 1 and 2000 then
    raise exception 'Explanation must be between 1 and 2000 characters.';
  end if;
  if not exists (
    select 1 from public.enrolments enrolment
    join public.class_sections section on section.id = enrolment.section_id
    join public.subject_offerings offering on offering.id = section.offering_id
    join public.academic_terms term on term.id = offering.term_id
    where enrolment.student_id = target_student and enrolment.status = 'enrolled'
      and section.offering_id = target_offering and term.is_current and term.status = 'active'
  ) then raise exception 'You are not enrolled in this subject'; end if;
  if not exists (
    select 1 from public.assessments
    where offering_id = target_offering and is_published and name = trim(target_assessment)
  ) then raise exception 'Select a valid published assessment.';
  end if;
  insert into public.mark_disputes(student_id, offering_id, assessment_name, explanation)
  values (target_student, target_offering, trim(target_assessment), trim(target_explanation))
  returning id into dispute_id;
  return dispute_id;
end;
$$;
revoke all on function public.submit_mark_dispute(uuid, text, text) from public, anon;
grant execute on function public.submit_mark_dispute(uuid, text, text) to authenticated;

revoke all on function public.prevent_finalised_academic_mutation() from public, anon, authenticated;
notify pgrst, 'reload schema';
