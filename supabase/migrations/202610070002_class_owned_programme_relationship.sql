-- Programme belongs to a class/teaching allocation. An offering identifies the
-- lecturer, subject and term; it does not assign the lecturer to one programme.

-- The preceding class-programme migration copied every legacy offering
-- programme into its existing classes. Remove the redundant relationship only
-- after that data-preserving backfill has completed.
drop function if exists public.get_my_lecturer_subjects();
drop function if exists public.create_lecturer_subject(text, text, integer, uuid);
drop function if exists public.update_lecturer_subject(uuid, text, integer, uuid);

alter table public.subject_offerings
  drop constraint if exists subject_offerings_subject_term_lecturer_programme_key;
drop index if exists public.subject_offerings_programme_idx;
alter table public.subject_offerings drop column if exists programme_id;

-- Subject creation is programme-neutral. Programmes are selected when classes
-- are created, allowing the same offering to contain classes from many programmes.
create or replace function public.create_lecturer_subject(
  subject_code text,
  subject_name text,
  programme_semester integer
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

  -- Serialize creation for this lecturer/subject/term without imposing a new
  -- constraint that could reject preserved historical duplicate offerings.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_lecturer_id::text || subject.id::text || current_term::text, 0)
  );
  if exists (
    select 1 from public.subject_offerings
    where subject_id = subject.id and term_id = current_term and lecturer_id = current_lecturer_id
  ) then
    raise exception 'You have already added this subject for the current academic term.';
  end if;

  insert into public.subject_offerings (
    subject_id, term_id, lecturer_id, programme_semester_override, status
  ) values (
    subject.id, current_term, current_lecturer_id, programme_semester, 'active'
  ) returning id into offering;
  return offering;
end;
$$;

revoke all on function public.create_lecturer_subject(text, text, integer) from public, anon;
grant execute on function public.create_lecturer_subject(text, text, integer) to authenticated;

create or replace function public.update_lecturer_subject(
  target_offering uuid,
  subject_name text,
  programme_semester integer
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'lecturer' and is_active
  ) then
    raise exception 'An active lecturer account is required.';
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
      updated_at = now()
  where id = target_offering and lecturer_id = auth.uid();

  if not found then
    raise exception 'You can only edit subjects assigned to your lecturer account.';
  end if;
end;
$$;

revoke all on function public.update_lecturer_subject(uuid, text, integer) from public, anon;
grant execute on function public.update_lecturer_subject(uuid, text, integer) to authenticated;

-- Stable lecturer read model. The only programme relationship used here is
-- offering -> class_sections -> programmes. Offerings with no classes remain visible.
create or replace function public.get_my_lecturer_subjects()
returns table (
  offering_id uuid,
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
    coalesce(class_programmes.ids, '{}'::uuid[]),
    coalesce(class_programmes.codes, '{}'::text[]),
    coalesce(class_programmes.names, '{}'::text[]),
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

-- Ask PostgREST to discard its cached function/relationship metadata once the
-- transaction commits. This is harmless when migrations run outside Supabase.
notify pgrst, 'reload schema';
