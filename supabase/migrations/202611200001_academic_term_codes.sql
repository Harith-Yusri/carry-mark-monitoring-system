-- No stored term/academic data is rewritten. semester_no is retained as the
-- legacy calendar discriminator required by existing APIs/constraints; it is
-- never a Programme Semester. New/changed regular codes must end in 2 or 4.
create function public.validate_regular_academic_term_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.semester_code is not distinct from old.semester_code then return new; end if;
  end if;
  if new.semester_code is null or new.semester_code !~ '^[0-9]{4}[24]$' then
    raise exception 'Academic Term Code must contain five digits and end in 2 or 4.';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_regular_academic_term_code() from public, anon, authenticated;
create trigger academic_terms_regular_code before insert or update of semester_code on public.academic_terms
for each row execute function public.validate_regular_academic_term_code();

create or replace function public.create_academic_semester(
  p_academic_year text,
  p_semester_code text,
  p_starts_on date,
  p_ends_on date,
  p_default_deadline timestamptz
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
declare legacy_term_discriminator smallint;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if nullif(trim(p_academic_year), '') is null then raise exception 'Academic year is required'; end if;
  if trim(p_academic_year) !~ '^[0-9]{4}/[0-9]{4}$' then raise exception 'Academic year must use the format 2026/2027'; end if;
  if split_part(trim(p_academic_year), '/', 2)::integer <> split_part(trim(p_academic_year), '/', 1)::integer + 1 then
    raise exception 'Academic year must contain consecutive years';
  end if;
  if coalesce(trim(p_semester_code), '') !~ '^[0-9]{4}[24]$' then
    raise exception 'Academic Term Code must contain five digits and end in 2 or 4.';
  end if;
  if trim(p_academic_year) ~ '^[0-9]{4}/[0-9]{4}$'
     and left(trim(p_semester_code), 4) not in (split_part(trim(p_academic_year), '/', 1), split_part(trim(p_academic_year), '/', 2)) then
    raise exception 'Academic Term Code year must match the academic year.';
  end if;
  legacy_term_discriminator := right(trim(p_semester_code), 1)::smallint;
  if p_starts_on >= p_ends_on then raise exception 'Academic term start must be before academic term end'; end if;
  if p_default_deadline::date < p_starts_on or p_default_deadline::date > p_ends_on then
    raise exception 'The default deadline must fall within the academic term dates';
  end if;

  insert into public.academic_terms (
    academic_year, semester_code, semester_no, starts_on, ends_on, default_deadline,
    carry_max, eligible_threshold, status, is_current
  )
  select trim(p_academic_year), trim(p_semester_code), legacy_term_discriminator,
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
      'semester_no', legacy_term_discriminator));
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
declare legacy_term_discriminator smallint;
declare stored_code text;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select semester_code into stored_code from public.academic_terms where id=target_term for update;
  if not found then raise exception 'Academic term not found'; end if;
  if nullif(trim(p_academic_year), '') is null then raise exception 'Academic year is required'; end if;
  if trim(p_academic_year) !~ '^[0-9]{4}/[0-9]{4}$' then raise exception 'Academic year must use the format 2026/2027'; end if;
  if split_part(trim(p_academic_year), '/', 2)::integer <> split_part(trim(p_academic_year), '/', 1)::integer + 1 then
    raise exception 'Academic year must contain consecutive years';
  end if;
  if coalesce(trim(p_semester_code), '') !~ '^[0-9]{4}[24]$' and trim(p_semester_code) is distinct from stored_code then
    raise exception 'Academic Term Code must contain five digits and end in 2 or 4.';
  end if;
  if trim(p_academic_year) ~ '^[0-9]{4}/[0-9]{4}$'
     and left(trim(p_semester_code), 4) not in (split_part(trim(p_academic_year), '/', 1), split_part(trim(p_academic_year), '/', 2)) then
    raise exception 'Academic Term Code year must match the academic year.';
  end if;
  legacy_term_discriminator := right(trim(p_semester_code), 1)::smallint;
  if p_starts_on >= p_ends_on then raise exception 'Academic term start must be before academic term end'; end if;
  if p_default_deadline::date < p_starts_on or p_default_deadline::date > p_ends_on then
    raise exception 'The default deadline must fall within the academic term dates';
  end if;

  update public.academic_terms
  set academic_year = trim(p_academic_year), semester_code = trim(p_semester_code),
      semester_no = legacy_term_discriminator, starts_on = p_starts_on, ends_on = p_ends_on,
      default_deadline = p_default_deadline
  where id = target_term;
  if not found then raise exception 'Academic term not found'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'updated academic semester', 'academic_term', target_term,
    jsonb_build_object('academic_year', trim(p_academic_year), 'semester_code', trim(p_semester_code),
      'semester_no', legacy_term_discriminator, 'starts_on', p_starts_on, 'ends_on', p_ends_on,
      'default_deadline', p_default_deadline));
end;
$$;


create or replace function public.get_my_lecturer_subject_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = '' as $$
  select jsonb_build_object(
    'current', coalesce((
      select jsonb_agg(to_jsonb(subject_row) || jsonb_build_object('semester_code', (select t.semester_code from public.academic_terms t where t.academic_year=subject_row.academic_year and t.semester_no=subject_row.semester_no)))
      from public.get_my_lecturer_subjects() subject_row
    ), '[]'::jsonb),
    'archived', coalesce((
      select jsonb_agg(to_jsonb(subject_row) || jsonb_build_object('semester_code', (select t.semester_code from public.academic_terms t where t.academic_year=subject_row.academic_year and t.semester_no=subject_row.semester_no)))
      from public.get_my_archived_lecturer_subjects() subject_row
    ), '[]'::jsonb),
    'term', (
      select jsonb_build_object(
        'academic_year', term.academic_year,
        'semester_no', term.semester_no,
        'semester_code', term.semester_code
      )
      from public.academic_terms term
      where term.is_current and term.status = 'active'
      limit 1
    )
  )
  where exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.role = 'lecturer' and profile.is_active
  );
$$;

revoke all on function public.get_my_lecturer_subject_dashboard() from public, anon;
grant execute on function public.get_my_lecturer_subject_dashboard() to authenticated;


create or replace function public.open_my_mark_issue_notification(target_notification uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.notifications; d public.mark_disputes; anchor public.subject_offerings; rows jsonb;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='lecturer' and p.is_active) then
    raise exception 'CAMS: An active lecturer account is required.';
  end if;
  select * into n from public.notifications where id=target_notification and recipient_id=auth.uid() and type='mark_issue_submitted' for update;
  if not found then raise exception 'CAMS: This notification is not available to your account.'; end if;
  -- Route using live academic references, never a URL/recipient supplied by the student.
  select * into d from public.mark_disputes where id=n.related_entity_id;
  if not found or not public.owns_offering(d.offering_id) then raise exception 'CAMS: This subject is no longer assigned to your account.'; end if;
  select * into anchor from public.subject_offerings where id=d.offering_id;
  -- Reuse the dashboard's metadata/Hub grouping rules for current AND archived
  -- issues, retaining every original offering/assessment ID in a legacy Hub.
  select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('semester_code', (select t.semester_code from public.academic_terms t where t.academic_year=s.academic_year and t.semester_no=s.semester_no))),'[]') into rows from (
    select * from public.get_my_lecturer_subjects()
    union all select * from public.get_my_archived_lecturer_subjects()
  ) s where s.offering_id in (select o.id from public.subject_offerings o where o.lecturer_id=auth.uid()
    and o.subject_id=anchor.subject_id and o.term_id=anchor.term_id and o.programme_semester=anchor.programme_semester);
  if jsonb_array_length(rows)=0 then raise exception 'CAMS: This subject is unavailable. Refresh notifications and try again.'; end if;
  update public.notifications set read_at=coalesce(read_at,now()) where id=n.id returning * into n;
  return jsonb_build_object('notification_id',n.id,'read_at',n.read_at,'issue_id',d.id,'subject_rows',rows,
    'unread_count',(select count(*) from public.notifications where recipient_id=auth.uid() and type='mark_issue_submitted' and read_at is null));
end;
$$;

create or replace function public.get_my_mobile_portal()
returns jsonb
language sql
stable
security definer
set search_path = '' as $$
  with base as (
    select public.get_my_mobile_portal_payload() as payload
  ), preference as (
    select coalesce((
      select student.notification_alerts_enabled
      from public.students student
      where student.auth_user_id = (select auth.uid())
        and student.is_active
      limit 1
    ), true) as enabled
  ), semester_payload as (
    select jsonb_set(
      jsonb_set(
        jsonb_set(jsonb_set(base.payload, '{student,programme_semester}', coalesce((select to_jsonb(s.current_semester) from public.students s where s.auth_user_id=(select auth.uid()) and s.is_active limit 1), 'null'::jsonb), true), '{student,academic_year}', coalesce((select to_jsonb(t.academic_year) from public.academic_terms t where t.is_current and t.status='active' limit 1),'null'::jsonb), true),
        '{student,semester}',
        coalesce((
          select to_jsonb(term.semester_code)
          from public.academic_terms term
          where term.is_current and term.status = 'active'
          limit 1
        ), 'null'::jsonb),
        true
      ),
      '{student,semester_code}',
      coalesce((
        select to_jsonb(term.semester_code)
        from public.academic_terms term
        where term.is_current and term.status = 'active'
        limit 1
      ), 'null'::jsonb),
      true
    ) as payload
    from base
  )
  select jsonb_set(
    jsonb_set(
      semester_payload.payload,
      '{notifications_enabled}',
      to_jsonb(preference.enabled),
      true
    ),
    '{notifications}',
    case
      when preference.enabled then coalesce(semester_payload.payload->'notifications', '[]'::jsonb)
      else '[]'::jsonb
    end,
    true
  )
  from semester_payload cross join preference;
$$;

revoke all on function public.get_my_mobile_portal() from public, anon;
grant execute on function public.get_my_mobile_portal() to authenticated;

notify pgrst, 'reload schema';
