-- Academic session lifecycle: one active session, archived academic data is read-only.
alter table public.academic_terms
  add column if not exists activated_at timestamptz,
  add column if not exists closed_at timestamptz;

update public.academic_terms
set activated_at = coalesce(activated_at, created_at)
where status = 'active' or is_current;

create or replace function public.create_academic_session(
  p_academic_year text,
  p_session_no smallint,
  p_starts_on date,
  p_ends_on date,
  p_default_deadline timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if nullif(trim(p_academic_year), '') is null then raise exception 'Academic year is required'; end if;
  if p_session_no not between 1 and 3 then raise exception 'Session number must be between 1 and 3'; end if;
  if p_starts_on >= p_ends_on then raise exception 'Session start must be before session end'; end if;
  if p_default_deadline::date < p_starts_on or p_default_deadline::date > p_ends_on then
    raise exception 'The default deadline must fall within the session dates';
  end if;

  insert into public.academic_terms (
    academic_year, semester_no, starts_on, ends_on, default_deadline,
    carry_max, eligible_threshold, status, is_current
  )
  select trim(p_academic_year), p_session_no, p_starts_on, p_ends_on, p_default_deadline,
         coalesce(current_term.carry_max, 50), coalesce(current_term.eligible_threshold, 40),
         'draft', false
  from (select 1) seed
  left join lateral (
    select carry_max, eligible_threshold from public.academic_terms where is_current limit 1
  ) current_term on true
  returning id into new_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'created academic session', 'academic_term', new_id,
    jsonb_build_object('academic_year', trim(p_academic_year), 'session_no', p_session_no));
  return new_id;
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
  if target_status <> 'draft' then raise exception 'Only a draft academic session can be activated'; end if;

  select id into previous_term from public.academic_terms where is_current for update;
  if previous_term is not null then
    update public.subject_offerings set status = 'completed'
    where term_id = previous_term and status <> 'completed';
    update public.academic_terms
    set status = 'closed', is_current = false, closed_at = now()
    where id = previous_term;
  end if;

  update public.academic_terms
  set status = 'active', is_current = true, activated_at = now(), closed_at = null
  where id = target_term;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data)
  values (auth.uid(), 'activated academic session', 'academic_term', target_term,
    jsonb_build_object('previous_term_id', previous_term), jsonb_build_object('active_term_id', target_term));
end;
$$;

create or replace function public.session_for_record(table_name text, record jsonb) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare result uuid;
begin
  case table_name
    when 'subject_offerings' then result := (record->>'term_id')::uuid;
    when 'programme_deadlines', 'notification_settings' then result := (record->>'term_id')::uuid;
    when 'class_sections', 'assessments' then
      select term_id into result from public.subject_offerings where id = (record->>'offering_id')::uuid;
    when 'enrolments', 'submissions' then
      select offering.term_id into result
      from public.class_sections section
      join public.subject_offerings offering on offering.id = section.offering_id
      where section.id = (record->>'section_id')::uuid;
    when 'marks' then
      select offering.term_id into result
      from public.enrolments enrolment
      join public.class_sections section on section.id = enrolment.section_id
      join public.subject_offerings offering on offering.id = section.offering_id
      where enrolment.id = (record->>'enrolment_id')::uuid;
  end case;
  return result;
end;
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
    raise exception 'Archived academic session data is read-only';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'subject_offerings', 'class_sections', 'assessments', 'enrolments', 'marks',
    'submissions', 'programme_deadlines', 'notification_settings'
  ] loop
    execute format('drop trigger if exists enforce_active_session_write on public.%I', table_name);
    execute format(
      'create trigger enforce_active_session_write before insert or update or delete on public.%I for each row execute function public.enforce_active_session_write()',
      table_name
    );
  end loop;
end $$;

create or replace function public.get_my_archived_lecturer_subjects()
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
    (select count(*) from public.class_sections section
      join public.enrolments enrolment on enrolment.section_id = section.id
      where section.offering_id = offering.id and enrolment.status in ('enrolled', 'completed')),
    offering.status::text,
    offering.updated_at,
    term.academic_year,
    term.semester_no
  from public.subject_offerings offering
  join public.subjects subject on subject.id = offering.subject_id
  join public.academic_terms term on term.id = offering.term_id
  left join lateral (
    select array_agg(programme.id order by programme.code) ids,
           array_agg(programme.code order by programme.code) codes,
           array_agg(programme.name order by programme.code) names
    from (select distinct section.programme_id from public.class_sections section where section.offering_id = offering.id) assigned
    join public.programmes programme on programme.id = assigned.programme_id
  ) class_programmes on true
  where offering.lecturer_id = (select auth.uid())
    and term.status = 'closed' and not term.is_current
    and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.role = 'lecturer' and profile.is_active)
  order by term.starts_on desc, offering.updated_at desc;
$$;

revoke all on function public.create_academic_session(text, smallint, date, date, timestamptz) from public, anon;
revoke all on function public.activate_academic_session(uuid) from public, anon;
revoke all on function public.get_my_archived_lecturer_subjects() from public, anon;
revoke all on function public.session_for_record(text, jsonb) from public, anon, authenticated;
revoke all on function public.enforce_active_session_write() from public, anon, authenticated;
grant execute on function public.create_academic_session(text, smallint, date, date, timestamptz) to authenticated;
grant execute on function public.activate_academic_session(uuid) to authenticated;
grant execute on function public.get_my_archived_lecturer_subjects() to authenticated;

-- Students may read academic records only through enrolments in the active
-- session. Admins and owning lecturers retain archived read access.
create or replace function public.can_access_offering(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.owns_offering(target) or exists (
    select 1 from public.students student
    join public.enrolments enrolment on enrolment.student_id = student.id
    join public.class_sections section on section.id = enrolment.section_id
    join public.subject_offerings offering on offering.id = section.offering_id
    join public.academic_terms term on term.id = offering.term_id
    where student.auth_user_id = (select auth.uid()) and student.is_active
      and enrolment.status = 'enrolled' and section.offering_id = target
      and term.is_current and term.status = 'active'
  );
$$;

create or replace function public.can_access_section(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (select 1 from public.class_sections section where section.id = target and public.owns_offering(section.offering_id))
    or exists (
      select 1 from public.students student
      join public.enrolments enrolment on enrolment.student_id = student.id
      join public.class_sections section on section.id = enrolment.section_id
      join public.subject_offerings offering on offering.id = section.offering_id
      join public.academic_terms term on term.id = offering.term_id
      where student.auth_user_id = (select auth.uid()) and student.is_active
        and enrolment.status = 'enrolled' and enrolment.section_id = target
        and term.is_current and term.status = 'active'
    );
$$;

create or replace function public.can_access_enrolment(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (
      select 1 from public.enrolments enrolment join public.class_sections section on section.id = enrolment.section_id
      where enrolment.id = target and public.owns_offering(section.offering_id)
    )
    or exists (
      select 1 from public.enrolments enrolment
      join public.students student on student.id = enrolment.student_id
      join public.class_sections section on section.id = enrolment.section_id
      join public.subject_offerings offering on offering.id = section.offering_id
      join public.academic_terms term on term.id = offering.term_id
      where enrolment.id = target and student.auth_user_id = (select auth.uid()) and student.is_active
        and term.is_current and term.status = 'active'
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
    where student.auth_user_id = (select auth.uid()) and student.is_active
      and enrolment.status = 'enrolled' and offering.lecturer_id = target
      and term.is_current and term.status = 'active'
  );
$$;

-- The normal student app contains only enrolments from the active session.
create or replace function public.get_my_mobile_portal()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (
    select student.id, student.matrix_no, student.full_name, programme.name as programme_name
    from public.students student
    join public.programmes programme on programme.id = student.programme_id
    where student.auth_user_id = (select auth.uid()) and student.is_active
  ), my_enrolments as (
    select enrolment.id enrolment_id, offering.id offering_id, section.id section_id,
      subject.code, coalesce(offering.subject_name_override, subject.name) name,
      lecturer.full_name lecturer_name, section.label section_label,
      term.academic_year, term.semester_no,
      coalesce(offering.carry_max, term.carry_max) carry_max,
      totals.total_carry, totals.eligible, totals.eligible_threshold,
      submission.status = 'finalised' finalised, submission.finalised_at,
      coalesce((select max(mark.updated_at) from public.marks mark where mark.enrolment_id = enrolment.id), enrolment.enrolled_at) last_updated
    from me
    join public.enrolments enrolment on enrolment.student_id = me.id and enrolment.status = 'enrolled'
    join public.class_sections section on section.id = enrolment.section_id
    join public.subject_offerings offering on offering.id = section.offering_id
    join public.subjects subject on subject.id = offering.subject_id
    join public.profiles lecturer on lecturer.id = offering.lecturer_id
    join public.academic_terms term on term.id = offering.term_id and term.is_current and term.status = 'active'
    left join public.student_carry_totals totals on totals.enrolment_id = enrolment.id
    left join public.submissions submission on submission.section_id = section.id
  )
  select jsonb_build_object(
    'student', (select jsonb_build_object('matrix_number', me.matrix_no, 'name', me.full_name,
      'programme', me.programme_name, 'faculty', 'Faculty of Computer & Mathematical Sciences',
      'semester', (select semester_no || ' / ' || academic_year from my_enrolments limit 1),
      'academic_advisor', null) from me),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object(
      'offering_id', item.offering_id, 'code', item.code, 'name', item.name,
      'lecturer', item.lecturer_name, 'group', item.section_label,
      'carry_mark', item.total_carry, 'carry_maximum', item.carry_max,
      'eligible', item.eligible, 'eligible_threshold', item.eligible_threshold,
      'is_finalised', coalesce(item.finalised, false), 'last_updated', item.last_updated,
      'assessments', coalesce((select jsonb_agg(jsonb_build_object(
        'name', assessment.name, 'assessment_type', assessment.assessment_type,
        'score', mark.score, 'maximum', assessment.max_score,
        'carry_contribution', case when mark.score is null then null else round(mark.score / assessment.max_score * assessment.carry_weight, 2) end,
        'weight', assessment.carry_weight::integer) order by assessment.position)
        from public.assessments assessment
        left join public.marks mark on mark.assessment_id = assessment.id and mark.enrolment_id = item.enrolment_id
        where assessment.offering_id = item.offering_id and assessment.is_published), '[]'::jsonb)
      ) order by item.code) from my_enrolments item), '[]'::jsonb),
    'notifications_enabled', true,
    'notifications', coalesce((select jsonb_agg(jsonb_build_object(
      'id', item.section_id, 'title', item.code || ' carry marks finalised',
      'body', item.name || ' results were finalised by ' || item.lecturer_name || '.',
      'created_at', item.finalised_at) order by item.finalised_at desc)
      from my_enrolments item where item.finalised and item.finalised_at is not null), '[]'::jsonb)
  );
$$;

revoke all on function public.get_my_mobile_portal() from public, anon;
grant execute on function public.get_my_mobile_portal() to authenticated;
notify pgrst, 'reload schema';
