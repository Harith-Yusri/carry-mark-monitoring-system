-- A programme belongs to a teaching assignment, not to a lecturer or to the
-- shared subject catalogue. Existing offerings retain their subject programme.
drop function public.create_lecturer_subject(text, text, integer);
drop function public.update_lecturer_subject(uuid, text, integer);

alter table public.subject_offerings
  add column programme_id uuid references public.programmes(id) on delete restrict;

update public.subject_offerings offering
set programme_id = subject.programme_id
from public.subjects subject
where subject.id = offering.subject_id;

alter table public.subject_offerings
  alter column programme_id set not null,
  drop constraint if exists subject_offerings_subject_id_term_id_lecturer_id_key,
  add constraint subject_offerings_subject_term_lecturer_programme_key
    unique (subject_id, term_id, lecturer_id, programme_id);

create index subject_offerings_programme_idx
  on public.subject_offerings(programme_id);

alter table public.profiles drop column programme_id;
alter table public.subjects drop column programme_id;

create function public.create_lecturer_subject(
  subject_code text,
  subject_name text,
  programme_semester integer,
  teaching_programme_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_lecturer_id uuid;
  subject public.subjects%rowtype;
  current_term uuid;
  offering uuid;
  normalized_code text := upper(trim(subject_code));
begin
  select id into current_lecturer_id from public.profiles
  where id = auth.uid() and role = 'lecturer' and is_active;
  if current_lecturer_id is null then raise exception 'An active lecturer account is required.'; end if;

  if not exists (
    select 1 from public.programmes
    where id = teaching_programme_id and is_active
  ) then
    raise exception 'Select an active programme for this teaching assignment.';
  end if;

  select id into current_term from public.academic_terms
  where is_current and status = 'active' for share;
  if current_term is null then raise exception 'There is no active current academic term.'; end if;
  if normalized_code is null or normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{0,29}$' then
    raise exception 'Enter a valid subject code (up to 30 letters, numbers, hyphens or underscores).';
  end if;
  if programme_semester is null or programme_semester not between 1 and 12 then
    raise exception 'Programme semester must be between 1 and 12.';
  end if;

  select * into subject from public.subjects where code = normalized_code for share;
  if subject.id is null then
    if subject_name is null or length(trim(subject_name)) not between 1 and 200 then
      raise exception 'Enter a subject name of up to 200 characters.';
    end if;
    insert into public.subjects (code, name, programme_semester)
    values (normalized_code, trim(subject_name), programme_semester)
    on conflict (code) do nothing;
    select * into subject from public.subjects where code = normalized_code for share;
  end if;
  if not subject.is_active then raise exception 'This subject is inactive and cannot be added.'; end if;

  insert into public.subject_offerings (
    subject_id, term_id, lecturer_id, programme_id,
    programme_semester_override, status
  ) values (
    subject.id, current_term, current_lecturer_id, teaching_programme_id,
    programme_semester, 'active'
  )
  on conflict (subject_id, term_id, lecturer_id, programme_id) do nothing
  returning id into offering;
  if offering is null then
    raise exception 'You have already added this subject for that programme in the current academic term.';
  end if;
  return offering;
end;
$$;

revoke all on function public.create_lecturer_subject(text, text, integer, uuid) from public, anon;
grant execute on function public.create_lecturer_subject(text, text, integer, uuid) to authenticated;

create function public.update_lecturer_subject(
  target_offering uuid,
  subject_name text,
  programme_semester integer,
  teaching_programme_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'lecturer' and is_active
  ) then
    raise exception 'An active lecturer account is required.';
  end if;
  if not exists (
    select 1 from public.programmes
    where id = teaching_programme_id and is_active
  ) then
    raise exception 'Select an active programme for this teaching assignment.';
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
      programme_id = teaching_programme_id,
      updated_at = now()
  where id = target_offering and lecturer_id = auth.uid();

  if not found then
    raise exception 'You can only edit subjects assigned to your lecturer account.';
  end if;
end;
$$;

revoke all on function public.update_lecturer_subject(uuid, text, integer, uuid) from public, anon;
grant execute on function public.update_lecturer_subject(uuid, text, integer, uuid) to authenticated;

-- A class inherits its programme from its offering. Keep student self-enrolment
-- inside that programme now that subjects themselves are programme-neutral.
create or replace function public.join_class_by_code(invitation_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target_student uuid;
  student_programme uuid;
  target_section uuid;
  target_offering uuid;
  offering_programme uuid;
  enrolled_count integer;
  section_capacity integer;
begin
  select id, programme_id into target_student, student_programme
  from public.students
  where auth_user_id = auth.uid() and is_active;
  if target_student is null then raise exception 'No active student record is linked to this account'; end if;

  select section.id, section.offering_id, section.capacity, offering.programme_id
    into target_section, target_offering, section_capacity, offering_programme
  from public.class_sections section
  join public.subject_offerings offering on offering.id = section.offering_id
  where upper(section.join_code) = upper(trim(invitation_code))
    and offering.status in ('active', 'draft');
  if target_section is null then raise exception 'Invalid or inactive class invitation code'; end if;
  if student_programme <> offering_programme then
    raise exception 'This class invitation is for a different programme';
  end if;

  if exists (
    select 1 from public.enrolments enrolment
    join public.class_sections section on section.id = enrolment.section_id
    where enrolment.student_id = target_student
      and section.offering_id = target_offering
      and enrolment.status = 'enrolled'
  ) then raise exception 'You are already enrolled in this subject'; end if;

  select count(*) into enrolled_count from public.enrolments
  where section_id = target_section and status = 'enrolled';
  if enrolled_count >= section_capacity then raise exception 'This class is full'; end if;

  insert into public.enrolments(section_id, student_id, status)
  values (target_section, target_student, 'enrolled')
  on conflict (section_id, student_id) do update set status = 'enrolled';

  return target_section;
end;
$$;
