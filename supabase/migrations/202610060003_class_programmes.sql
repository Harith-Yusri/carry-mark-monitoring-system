-- Classes own their programme relationship. Existing classes inherit the
-- programme already stored on their teaching offering.
alter table public.class_sections
  add column programme_id uuid references public.programmes(id) on delete restrict;

update public.class_sections section
set programme_id = offering.programme_id
from public.subject_offerings offering
where offering.id = section.offering_id;

alter table public.class_sections
  alter column programme_id set not null;

create index class_sections_programme_idx
  on public.class_sections(programme_id);

create function public.validate_class_programme() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.programmes
    where id = new.programme_id and is_active
  ) then
    raise exception 'Select an active programme for this class.';
  end if;

  if tg_op = 'UPDATE' and new.programme_id <> old.programme_id and exists (
    select 1
    from public.enrolments enrolment
    join public.students student on student.id = enrolment.student_id
    where enrolment.section_id = old.id
      and enrolment.status = 'enrolled'
      and student.programme_id <> new.programme_id
  ) then
    raise exception 'The class programme cannot be changed while students from another programme are enrolled.';
  end if;

  return new;
end;
$$;

create trigger class_sections_validate_programme
before insert or update of programme_id on public.class_sections
for each row execute function public.validate_class_programme();

create function public.validate_enrolment_programme() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'enrolled' and not exists (
    select 1
    from public.students student
    join public.class_sections section on section.id = new.section_id
    where student.id = new.student_id
      and student.programme_id = section.programme_id
  ) then
    raise exception 'The student and class must belong to the same programme.';
  end if;
  return new;
end;
$$;

create trigger enrolments_validate_programme
before insert or update of section_id, student_id, status on public.enrolments
for each row execute function public.validate_enrolment_programme();

create or replace function public.join_class_by_code(invitation_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target_student uuid;
  student_programme uuid;
  target_section uuid;
  target_offering uuid;
  class_programme uuid;
  enrolled_count integer;
  section_capacity integer;
begin
  select id, programme_id into target_student, student_programme
  from public.students
  where auth_user_id = auth.uid() and is_active;
  if target_student is null then raise exception 'No active student record is linked to this account'; end if;

  select section.id, section.offering_id, section.capacity, section.programme_id
    into target_section, target_offering, section_capacity, class_programme
  from public.class_sections section
  join public.subject_offerings offering on offering.id = section.offering_id
  where upper(section.join_code) = upper(trim(invitation_code))
    and offering.status in ('active', 'draft');
  if target_section is null then raise exception 'Invalid or inactive class invitation code'; end if;
  if student_programme <> class_programme then
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
