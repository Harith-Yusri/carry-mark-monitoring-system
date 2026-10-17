-- Reversible testing transitions preserve every session-owned record and each
-- offering's status before archival.
alter table public.subject_offerings
  add column if not exists status_before_archive public.offering_status;

create or replace function public.update_academic_session(
  target_term uuid,
  p_academic_year text,
  p_session_no smallint,
  p_starts_on date,
  p_ends_on date,
  p_default_deadline timestamptz
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if nullif(trim(p_academic_year), '') is null then raise exception 'Academic year is required'; end if;
  if p_session_no not between 1 and 3 then raise exception 'Session number must be between 1 and 3'; end if;
  if p_starts_on >= p_ends_on then raise exception 'Session start must be before session end'; end if;
  if p_default_deadline::date < p_starts_on or p_default_deadline::date > p_ends_on then
    raise exception 'The default deadline must fall within the session dates';
  end if;

  update public.academic_terms
  set academic_year = trim(p_academic_year), semester_no = p_session_no,
      starts_on = p_starts_on, ends_on = p_ends_on,
      default_deadline = p_default_deadline
  where id = target_term;
  if not found then raise exception 'Academic session not found'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'updated academic session', 'academic_term', target_term,
    jsonb_build_object('academic_year', trim(p_academic_year), 'session_no', p_session_no,
      'starts_on', p_starts_on, 'ends_on', p_ends_on, 'default_deadline', p_default_deadline));
end;
$$;

create or replace function public.activate_academic_session(target_term uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target_status public.term_status;
declare previous_term uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  perform pg_advisory_xact_lock(hashtext('public.academic_terms.active'));

  select status into target_status from public.academic_terms where id = target_term for update;
  if target_status is null then raise exception 'Academic session not found'; end if;
  if target_status not in ('draft', 'closed') then
    if exists (select 1 from public.academic_terms where id = target_term and is_current and status = 'active') then return; end if;
    raise exception 'Only a draft or archived academic session can be activated';
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
  values (auth.uid(), case when target_status = 'closed' then 'reopened academic session' else 'activated academic session' end,
    'academic_term', target_term, jsonb_build_object('previous_term_id', previous_term),
    jsonb_build_object('active_term_id', target_term));
end;
$$;

create or replace function public.get_academic_session_summaries()
returns table (
  id uuid, academic_year text, session_no smallint, starts_on date, ends_on date,
  default_deadline timestamptz, status text, is_current boolean,
  activated_at timestamptz, closed_at timestamptz,
  offering_count bigint, class_count bigint, mark_count bigint,
  submission_count bigint, finalised_count bigint
)
language sql stable security definer set search_path = '' as $$
  select term.id, term.academic_year, term.semester_no, term.starts_on, term.ends_on,
    term.default_deadline, term.status::text, term.is_current, term.activated_at, term.closed_at,
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

revoke all on function public.update_academic_session(uuid, text, smallint, date, date, timestamptz) from public, anon;
revoke all on function public.get_academic_session_summaries() from public, anon;
grant execute on function public.update_academic_session(uuid, text, smallint, date, date, timestamptz) to authenticated;
grant execute on function public.get_academic_session_summaries() to authenticated;
notify pgrst, 'reload schema';
