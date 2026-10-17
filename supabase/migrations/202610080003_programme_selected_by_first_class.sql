-- Creating a catalogue/teaching subject is programme-neutral. Its first class
-- selects the programme and binds the offering atomically; later classes must
-- continue to use that programme.

drop function if exists public.create_lecturer_subject(text, text, integer, uuid);

create function public.create_lecturer_subject(
  subject_code text,
  subject_name text,
  offering_semester integer
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

  insert into public.subject_offerings (
    subject_id, term_id, lecturer_id, programme_semester, status
  ) values (
    selected_subject.id, current_term, current_lecturer_id, offering_semester, 'active'
  ) returning id into offering;
  return offering;
end;
$$;

create or replace function public.validate_class_programme() returns trigger
language plpgsql set search_path = '' as $$
declare offering_programme uuid;
begin
  if not exists (select 1 from public.programmes where id = new.programme_id and is_active) then
    raise exception 'Select an active programme for this class.';
  end if;

  select programme_id into offering_programme
  from public.subject_offerings where id = new.offering_id for update;

  if offering_programme is null then
    begin
      update public.subject_offerings
      set programme_id = new.programme_id, updated_at = now()
      where id = new.offering_id;
      offering_programme := new.programme_id;
    exception when unique_violation then
      raise exception 'This subject already has an offering for the selected programme and semester in the current academic session.';
    end;
  end if;

  if new.programme_id <> offering_programme then
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

revoke all on function public.create_lecturer_subject(text, text, integer) from public, anon;
grant execute on function public.create_lecturer_subject(text, text, integer) to authenticated;

notify pgrst, 'reload schema';
