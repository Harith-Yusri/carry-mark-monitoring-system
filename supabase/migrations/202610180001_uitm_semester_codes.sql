-- UiTM academic semester identifiers. Existing term IDs and all dependent data
-- remain unchanged; only the semester identity and lifecycle API are extended.
alter table public.academic_terms
  drop constraint if exists academic_terms_semester_no_check;

alter table public.academic_terms
  add constraint academic_terms_semester_no_check check (semester_no between 1 and 9),
  add column if not exists semester_code text;

-- Prefer the UiTM year convention for Semesters 2 and 4. Other legacy rows
-- retain their semester number and use their start year for a safe backfill.
update public.academic_terms
set semester_code = (
  case
    when academic_year ~ '^[0-9]{4}/[0-9]{4}$' and semester_no = 2 then split_part(academic_year, '/', 2)
    when academic_year ~ '^[0-9]{4}/[0-9]{4}$' and semester_no = 4 then split_part(academic_year, '/', 1)
    else extract(year from starts_on)::integer::text
  end || semester_no::text
)
where semester_code is null;

alter table public.academic_terms
  alter column semester_code set not null,
  add constraint academic_terms_semester_code_format_check
    check (semester_code ~ '^[0-9]{5}$' and right(semester_code, 1) = semester_no::text),
  add constraint academic_terms_semester_code_key unique (semester_code);

create or replace function public.create_academic_semester(
  p_academic_year text,
  p_semester_code text,
  p_starts_on date,
  p_ends_on date,
  p_default_deadline timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
declare semester_number smallint;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if nullif(trim(p_academic_year), '') is null then raise exception 'Academic year is required'; end if;
  if trim(p_academic_year) !~ '^[0-9]{4}/[0-9]{4}$' then raise exception 'Academic year must use the format 2026/2027'; end if;
  if split_part(trim(p_academic_year), '/', 2)::integer <> split_part(trim(p_academic_year), '/', 1)::integer + 1 then
    raise exception 'Academic year must contain consecutive years';
  end if;
  if coalesce(trim(p_semester_code), '') !~ '^[0-9]{5}$' or right(trim(p_semester_code), 1) = '0' then
    raise exception 'Semester code must contain five digits, for example 20264';
  end if;
  if trim(p_academic_year) ~ '^[0-9]{4}/[0-9]{4}$'
     and left(trim(p_semester_code), 4) not in (split_part(trim(p_academic_year), '/', 1), split_part(trim(p_academic_year), '/', 2)) then
    raise exception 'Semester code year must match the academic year';
  end if;
  semester_number := right(trim(p_semester_code), 1)::smallint;
  if p_starts_on >= p_ends_on then raise exception 'Semester start must be before semester end'; end if;
  if p_default_deadline::date < p_starts_on or p_default_deadline::date > p_ends_on then
    raise exception 'The default deadline must fall within the semester dates';
  end if;

  insert into public.academic_terms (
    academic_year, semester_code, semester_no, starts_on, ends_on, default_deadline,
    carry_max, eligible_threshold, status, is_current
  )
  select trim(p_academic_year), trim(p_semester_code), semester_number,
         p_starts_on, p_ends_on, p_default_deadline,
         coalesce(current_semester.carry_max, 50), coalesce(current_semester.eligible_threshold, 40),
         'draft', false
  from (select 1) seed
  left join lateral (
    select carry_max, eligible_threshold from public.academic_terms where is_current limit 1
  ) current_semester on true
  returning id into new_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'created academic semester', 'academic_term', new_id,
    jsonb_build_object('academic_year', trim(p_academic_year), 'semester_code', trim(p_semester_code),
      'semester_no', semester_number));
  return new_id;
end;
$$;

create or replace function public.update_academic_semester(
  target_term uuid,
  p_academic_year text,
  p_semester_code text,
  p_starts_on date,
  p_ends_on date,
  p_default_deadline timestamptz
) returns void
language plpgsql security definer set search_path = '' as $$
declare semester_number smallint;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if nullif(trim(p_academic_year), '') is null then raise exception 'Academic year is required'; end if;
  if trim(p_academic_year) !~ '^[0-9]{4}/[0-9]{4}$' then raise exception 'Academic year must use the format 2026/2027'; end if;
  if split_part(trim(p_academic_year), '/', 2)::integer <> split_part(trim(p_academic_year), '/', 1)::integer + 1 then
    raise exception 'Academic year must contain consecutive years';
  end if;
  if coalesce(trim(p_semester_code), '') !~ '^[0-9]{5}$' or right(trim(p_semester_code), 1) = '0' then
    raise exception 'Semester code must contain five digits, for example 20264';
  end if;
  if trim(p_academic_year) ~ '^[0-9]{4}/[0-9]{4}$'
     and left(trim(p_semester_code), 4) not in (split_part(trim(p_academic_year), '/', 1), split_part(trim(p_academic_year), '/', 2)) then
    raise exception 'Semester code year must match the academic year';
  end if;
  semester_number := right(trim(p_semester_code), 1)::smallint;
  if p_starts_on >= p_ends_on then raise exception 'Semester start must be before semester end'; end if;
  if p_default_deadline::date < p_starts_on or p_default_deadline::date > p_ends_on then
    raise exception 'The default deadline must fall within the semester dates';
  end if;

  update public.academic_terms
  set academic_year = trim(p_academic_year), semester_code = trim(p_semester_code),
      semester_no = semester_number, starts_on = p_starts_on, ends_on = p_ends_on,
      default_deadline = p_default_deadline
  where id = target_term;
  if not found then raise exception 'Academic semester not found'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'updated academic semester', 'academic_term', target_term,
    jsonb_build_object('academic_year', trim(p_academic_year), 'semester_code', trim(p_semester_code),
      'semester_no', semester_number, 'starts_on', p_starts_on, 'ends_on', p_ends_on,
      'default_deadline', p_default_deadline));
end;
$$;

create or replace function public.activate_academic_semester(target_term uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target_status public.term_status;
declare previous_term uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  perform pg_advisory_xact_lock(hashtext('public.academic_terms.active'));

  select status into target_status from public.academic_terms where id = target_term for update;
  if target_status is null then raise exception 'Academic semester not found'; end if;
  if target_status not in ('draft', 'closed') then
    if exists (select 1 from public.academic_terms where id = target_term and is_current and status = 'active') then return; end if;
    raise exception 'Only a draft or archived academic semester can be activated';
  end if;

  select id into previous_term from public.academic_terms where is_current for update;
  if previous_term is not null and previous_term <> target_term then
    update public.subject_offerings
    set status_before_archive = status, status = 'completed'
    where term_id = previous_term;
    update public.academic_terms
    set status = 'closed', is_current = false, closed_at = now()
    where id = previous_term;
  end if;

  update public.academic_terms
  set status = 'active', is_current = true, activated_at = now(), closed_at = null
  where id = target_term;

  update public.subject_offerings
  set status = coalesce(status_before_archive, 'active'::public.offering_status),
      status_before_archive = null
  where term_id = target_term;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), case when target_status = 'closed' then 'reopened academic semester' else 'activated academic semester' end,
    'academic_term', target_term, jsonb_build_object('previous_term_id', previous_term),
    jsonb_build_object('active_term_id', target_term));
end;
$$;

create or replace function public.delete_academic_semester(target_term uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target_semester public.academic_terms%rowtype;
declare offering_total bigint;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into target_semester from public.academic_terms where id = target_term for update;
  if not found then raise exception 'Academic semester not found'; end if;
  if target_semester.is_current or target_semester.status = 'active' then
    raise exception 'The active academic semester cannot be deleted. Activate another semester first.';
  end if;
  select count(*) into offering_total from public.subject_offerings where term_id = target_term;
  if offering_total > 0 then
    raise exception 'This semester contains teaching data and cannot be deleted. Keep it archived or reopen it for testing.';
  end if;
  delete from public.academic_terms where id = target_term;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data)
  values (auth.uid(), 'deleted empty test semester', 'academic_term', target_term,
    jsonb_build_object('academic_year', target_semester.academic_year,
      'semester_code', target_semester.semester_code, 'semester_no', target_semester.semester_no,
      'status', target_semester.status));
end;
$$;

create or replace function public.get_academic_semester_summaries()
returns table (
  id uuid, academic_year text, semester_code text, semester_no smallint,
  starts_on date, ends_on date, default_deadline timestamptz, status text,
  is_current boolean, activated_at timestamptz, closed_at timestamptz,
  offering_count bigint, class_count bigint, mark_count bigint,
  submission_count bigint, finalised_count bigint
)
language sql stable security definer set search_path = '' as $$
  select term.id, term.academic_year, term.semester_code, term.semester_no,
    term.starts_on, term.ends_on, term.default_deadline, term.status::text,
    term.is_current, term.activated_at, term.closed_at,
    count(distinct offering.id), count(distinct section.id), count(distinct mark.id),
    count(distinct submission.section_id),
    count(distinct submission.section_id) filter (where submission.status = 'finalised')
  from public.academic_terms term
  left join public.subject_offerings offering on offering.term_id = term.id
  left join public.class_sections section on section.offering_id = offering.id
  left join public.enrolments enrolment on enrolment.section_id = section.id
  left join public.marks mark on mark.enrolment_id = enrolment.id
  left join public.submissions submission on submission.section_id = section.id
  where public.is_admin()
  group by term.id
  order by term.starts_on desc;
$$;

create or replace function public.enforce_active_session_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare record_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
declare record_term uuid;
begin
  record_term := public.session_for_record(tg_table_name, record_data);
  if record_term is null or not exists (
    select 1 from public.academic_terms where id = record_term and is_current and status = 'active'
  ) then
    raise exception 'Archived academic semester data is read-only';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Keep the established student payload shape, but publish the active semester
-- label and code from the single active academic_terms row.
create or replace function public.get_my_mobile_portal()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_set(
    jsonb_set(
      public.get_my_mobile_portal_payload(),
      '{student,semester}',
      coalesce((select to_jsonb(('Semester ' || term.semester_no || ' · ' || term.academic_year)::text)
        from public.academic_terms term where term.is_current and term.status = 'active' limit 1), 'null'::jsonb),
      true
    ),
    '{student,semester_code}',
    coalesce((select to_jsonb(term.semester_code) from public.academic_terms term
      where term.is_current and term.status = 'active' limit 1), 'null'::jsonb),
    true
  );
$$;

revoke all on function public.create_academic_semester(text, text, date, date, timestamptz) from public, anon;
revoke all on function public.update_academic_semester(uuid, text, text, date, date, timestamptz) from public, anon;
revoke all on function public.activate_academic_semester(uuid) from public, anon;
revoke all on function public.delete_academic_semester(uuid) from public, anon;
revoke all on function public.get_academic_semester_summaries() from public, anon;
revoke all on function public.enforce_active_session_write() from public, anon, authenticated;
revoke all on function public.get_my_mobile_portal() from public, anon;
grant execute on function public.create_academic_semester(text, text, date, date, timestamptz) to authenticated;
grant execute on function public.update_academic_semester(uuid, text, text, date, date, timestamptz) to authenticated;
grant execute on function public.activate_academic_semester(uuid) to authenticated;
grant execute on function public.delete_academic_semester(uuid) to authenticated;
grant execute on function public.get_academic_semester_summaries() to authenticated;
grant execute on function public.get_my_mobile_portal() to authenticated;

-- Remove the superseded lifecycle API after the semester functions exist.
drop function if exists public.create_academic_session(text, smallint, date, date, timestamptz);
drop function if exists public.update_academic_session(uuid, text, smallint, date, date, timestamptz);
drop function if exists public.activate_academic_session(uuid);
drop function if exists public.delete_academic_session(uuid);
drop function if exists public.get_academic_session_summaries();

notify pgrst, 'reload schema';
