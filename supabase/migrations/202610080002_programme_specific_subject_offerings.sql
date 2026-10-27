-- Semester is a property of a programme-specific teaching offering, never of
-- the shared subject catalogue. Split legacy multi-programme offerings without
-- deleting their classes, assessments, enrolments, marks or submissions.

-- This migration deliberately backfills archived terms. Temporarily suspend
-- the application-level archive guard for only the tables moved below; the
-- migration runs transactionally and restores every trigger before commit.
alter table public.subject_offerings disable trigger enforce_active_session_write;
alter table public.class_sections disable trigger enforce_active_session_write;
alter table public.assessments disable trigger enforce_active_session_write;
alter table public.marks disable trigger enforce_active_session_write;

alter table public.subject_offerings
  add column programme_id uuid references public.programmes(id) on delete restrict;

alter table public.subject_offerings
  rename column programme_semester_override to programme_semester;

update public.subject_offerings offering
set programme_semester = subject.programme_semester
from public.subjects subject
where subject.id = offering.subject_id
  and offering.programme_semester is null;

update public.subject_offerings offering
set programme_id = source.programme_id
from (
  select distinct on (section.offering_id)
    section.offering_id, section.programme_id
  from public.class_sections section
  join public.programmes programme on programme.id = section.programme_id
  order by section.offering_id, programme.code
) source
where offering.id = source.offering_id;

-- Record every non-primary programme branch that needs a new offering.
create temporary table offering_programme_split (
  old_offering_id uuid not null,
  programme_id uuid not null,
  new_offering_id uuid not null default gen_random_uuid(),
  primary key (old_offering_id, programme_id)
) on commit drop;

insert into offering_programme_split (old_offering_id, programme_id)
select distinct section.offering_id, section.programme_id
from public.class_sections section
join public.subject_offerings offering on offering.id = section.offering_id
where section.programme_id <> offering.programme_id;

insert into public.subject_offerings (
  id, subject_id, term_id, lecturer_id, programme_id, programme_semester,
  subject_name_override, carry_max, status, status_before_archive,
  deadline_at, created_at, updated_at
)
select split.new_offering_id, offering.subject_id, offering.term_id,
  offering.lecturer_id, split.programme_id, offering.programme_semester,
  offering.subject_name_override, offering.carry_max, offering.status,
  offering.status_before_archive, offering.deadline_at, offering.created_at,
  offering.updated_at
from offering_programme_split split
join public.subject_offerings offering on offering.id = split.old_offering_id;

create temporary table assessment_split (
  old_assessment_id uuid not null,
  new_offering_id uuid not null,
  new_assessment_id uuid not null default gen_random_uuid(),
  primary key (old_assessment_id, new_offering_id)
) on commit drop;

insert into assessment_split (old_assessment_id, new_offering_id)
select assessment.id, split.new_offering_id
from offering_programme_split split
join public.assessments assessment on assessment.offering_id = split.old_offering_id;

insert into public.assessments (
  id, offering_id, name, assessment_type, max_score, carry_weight,
  position, is_published, created_at, updated_at
)
select mapping.new_assessment_id, mapping.new_offering_id, assessment.name,
  assessment.assessment_type, assessment.max_score, assessment.carry_weight,
  assessment.position, assessment.is_published, assessment.created_at,
  assessment.updated_at
from assessment_split mapping
join public.assessments assessment on assessment.id = mapping.old_assessment_id;

-- Marks must point to the assessment copy owned by the enrolment's new branch.
update public.marks mark
set assessment_id = mapping.new_assessment_id
from public.enrolments enrolment
join public.class_sections section on section.id = enrolment.section_id
join offering_programme_split split
  on split.old_offering_id = section.offering_id
 and split.programme_id = section.programme_id
join assessment_split mapping on mapping.new_offering_id = split.new_offering_id
where mark.enrolment_id = enrolment.id
  and mapping.old_assessment_id = mark.assessment_id;

update public.mark_disputes dispute
set offering_id = split.new_offering_id
from offering_programme_split split
where dispute.offering_id = split.old_offering_id
  and exists (
    select 1 from public.enrolments enrolment
    join public.class_sections section on section.id = enrolment.section_id
    where enrolment.student_id = dispute.student_id
      and section.offering_id = split.old_offering_id
      and section.programme_id = split.programme_id
  );

update public.class_sections section
set offering_id = split.new_offering_id
from offering_programme_split split
where section.offering_id = split.old_offering_id
  and section.programme_id = split.programme_id;

alter table public.subject_offerings
  add constraint subject_offerings_programme_semester_check
    check (programme_semester between 1 and 12),
  add constraint subject_offerings_subject_term_lecturer_programme_semester_key
    unique (subject_id, term_id, lecturer_id, programme_id, programme_semester);

create index subject_offerings_programme_idx
  on public.subject_offerings(programme_id);

-- New and edited offerings must always be programme-specific. Legacy offerings
-- with no classes remain nullable because their programme cannot be inferred.
drop function if exists public.create_lecturer_subject(text, text, integer);
drop function if exists public.update_lecturer_subject(uuid, text, integer);

create or replace function public.create_lecturer_subject(
  subject_code text,
  subject_name text,
  offering_semester integer,
  teaching_programme_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_lecturer_id uuid;
  selected_subject public.subjects%rowtype;
  current_term uuid;
  offering uuid;
  normalized_code text := upper(trim(subject_code));
begin
  select id into current_lecturer_id from public.profiles
  where id = auth.uid() and role = 'lecturer' and is_active;
  if current_lecturer_id is null then raise exception 'An active lecturer account is required.'; end if;
  if not exists (select 1 from public.programmes where id = teaching_programme_id and is_active) then
    raise exception 'Select an active programme for this subject offering.';
  end if;
  select id into current_term from public.academic_terms
  where is_current and status = 'active' for share;
  if current_term is null then raise exception 'There is no active current academic session.'; end if;
  if normalized_code is null or normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{0,29}$' then
    raise exception 'Enter a valid subject code (up to 30 letters, numbers, hyphens or underscores).';
  end if;
  if offering_semester is null or offering_semester not between 1 and 12 then
    raise exception 'Programme semester must be between 1 and 12.';
  end if;
  select * into selected_subject from public.subjects where code = normalized_code for share;
  if selected_subject.id is null then
    if subject_name is null or length(trim(subject_name)) not between 1 and 200 then
      raise exception 'Enter a subject name of up to 200 characters.';
    end if;
    insert into public.subjects (code, name)
    values (normalized_code, trim(subject_name)) on conflict (code) do nothing;
    select * into selected_subject from public.subjects where code = normalized_code for share;
  end if;
  if not selected_subject.is_active then raise exception 'This subject is inactive and cannot be added.'; end if;

  begin
    insert into public.subject_offerings (
      subject_id, term_id, lecturer_id, programme_id, programme_semester, status
    ) values (
      selected_subject.id, current_term, current_lecturer_id,
      teaching_programme_id, offering_semester, 'active'
    ) returning id into offering;
  exception when unique_violation then
    raise exception 'This subject already has an offering for the selected programme and semester in the current academic session.';
  end;
  return offering;
end;
$$;

create or replace function public.update_lecturer_subject(
  target_offering uuid,
  subject_name text,
  offering_semester integer,
  teaching_programme_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
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
    update public.class_sections set programme_id = teaching_programme_id
    where offering_id = target_offering and programme_id <> teaching_programme_id;
  exception when unique_violation then
    raise exception 'This subject already has an offering for the selected programme and semester in the current academic session.';
  end;
end;
$$;

-- Classes under an offering cannot drift to another programme.
create or replace function public.validate_class_programme() returns trigger
language plpgsql set search_path = '' as $$
declare offering_programme uuid;
begin
  if not exists (select 1 from public.programmes where id = new.programme_id and is_active) then
    raise exception 'Select an active programme for this class.';
  end if;
  select programme_id into offering_programme from public.subject_offerings where id = new.offering_id;
  if offering_programme is null or new.programme_id <> offering_programme then
    raise exception 'The class programme must match its subject offering programme.';
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
$$;

create or replace function public.get_my_lecturer_subjects()
returns table (
  offering_id uuid, programme_ids uuid[], programme_codes text[], programme_names text[],
  subject_code text, subject_name text, programme_semester smallint, student_count bigint,
  offering_status text, updated_at timestamptz, academic_year text, semester_no smallint
)
language sql stable security definer set search_path = '' as $$
  select offering.id,
    case when programme.id is null then '{}'::uuid[] else array[programme.id] end,
    case when programme.id is null then '{}'::text[] else array[programme.code] end,
    case when programme.id is null then '{}'::text[] else array[programme.name] end,
    subject.code, coalesce(offering.subject_name_override, subject.name), offering.programme_semester,
    (select count(*) from public.class_sections section join public.enrolments enrolment on enrolment.section_id = section.id where section.offering_id = offering.id and enrolment.status = 'enrolled'),
    offering.status::text, offering.updated_at, term.academic_year, term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.academic_terms term on term.id = offering.term_id
  left join public.programmes programme on programme.id = offering.programme_id
  where offering.lecturer_id = (select auth.uid()) and term.is_current
    and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.role = 'lecturer' and profile.is_active)
  order by offering.programme_semester, subject.code, programme.code;
$$;

create or replace function public.get_my_archived_lecturer_subjects()
returns table (
  offering_id uuid, programme_ids uuid[], programme_codes text[], programme_names text[],
  subject_code text, subject_name text, programme_semester smallint, student_count bigint,
  offering_status text, updated_at timestamptz, academic_year text, semester_no smallint
)
language sql stable security definer set search_path = '' as $$
  select offering.id,
    case when programme.id is null then '{}'::uuid[] else array[programme.id] end,
    case when programme.id is null then '{}'::text[] else array[programme.code] end,
    case when programme.id is null then '{}'::text[] else array[programme.name] end,
    subject.code, coalesce(offering.subject_name_override, subject.name), offering.programme_semester,
    (select count(*) from public.class_sections section join public.enrolments enrolment on enrolment.section_id = section.id where section.offering_id = offering.id and enrolment.status in ('enrolled', 'completed')),
    offering.status::text, offering.updated_at, term.academic_year, term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.academic_terms term on term.id = offering.term_id
  left join public.programmes programme on programme.id = offering.programme_id
  where offering.lecturer_id = (select auth.uid()) and term.status = 'closed' and not term.is_current
    and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.role = 'lecturer' and profile.is_active)
  order by term.starts_on desc, offering.programme_semester, subject.code, programme.code;
$$;

revoke all on function public.create_lecturer_subject(text, text, integer, uuid) from public, anon;
revoke all on function public.update_lecturer_subject(uuid, text, integer, uuid) from public, anon;
grant execute on function public.create_lecturer_subject(text, text, integer, uuid) to authenticated;
grant execute on function public.update_lecturer_subject(uuid, text, integer, uuid) to authenticated;

-- The catalogue is now programme- and semester-neutral.
alter table public.subjects drop column programme_semester;

alter table public.subject_offerings enable trigger enforce_active_session_write;
alter table public.class_sections enable trigger enforce_active_session_write;
alter table public.assessments enable trigger enforce_active_session_write;
alter table public.marks enable trigger enforce_active_session_write;

notify pgrst, 'reload schema';
