-- Catalogue entries are shared; teaching offerings belong to one lecturer and term.
create function public.create_lecturer_subject(
  subject_code text,
  subject_name text,
  programme_semester integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  lecturer public.profiles%rowtype;
  subject public.subjects%rowtype;
  current_term uuid;
  offering uuid;
  normalized_code text := upper(trim(subject_code));
begin
  select * into lecturer from public.profiles
  where id = auth.uid() and role = 'lecturer' and is_active;
  if lecturer.id is null then raise exception 'An active lecturer account is required.'; end if;

  select id into current_term from public.academic_terms
  where is_current and status = 'active' for share;
  if current_term is null then raise exception 'There is no active current academic term.'; end if;
  if normalized_code is null or normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{0,29}$' then
    raise exception 'Enter a valid subject code (up to 30 letters, numbers, hyphens or underscores).';
  end if;

  select * into subject from public.subjects where code = normalized_code for share;
  if subject.id is null then
    if subject_name is null or length(trim(subject_name)) not between 1 and 200 then
      raise exception 'Enter a subject name of up to 200 characters.';
    end if;
    if programme_semester is null or programme_semester not between 1 and 12 then
      raise exception 'Programme semester must be between 1 and 12.';
    end if;
    if not exists (select 1 from public.programmes where id = lecturer.programme_id and is_active) then
      raise exception 'Your lecturer profile needs an active programme before creating a new subject.';
    end if;
    -- The unique code also prevents duplication when two lecturers create it together.
    insert into public.subjects (code, name, programme_id, programme_semester)
    values (normalized_code, trim(subject_name), lecturer.programme_id, programme_semester)
    on conflict (code) do nothing;
    select * into subject from public.subjects where code = normalized_code for share;
  end if;
  if not subject.is_active then raise exception 'This subject is inactive and cannot be added.'; end if;

  -- Reuse catalogue details without modifying another lecturer's subject or marks.
  insert into public.subject_offerings (subject_id, term_id, lecturer_id, status)
  values (subject.id, current_term, lecturer.id, 'active')
  on conflict (subject_id, term_id, lecturer_id) do nothing
  returning id into offering;
  if offering is null then raise exception 'You have already added this subject for the current academic term.'; end if;
  return offering;
end;
$$;
revoke all on function public.create_lecturer_subject(text, text, integer) from public, anon;
grant execute on function public.create_lecturer_subject(text, text, integer) to authenticated;
