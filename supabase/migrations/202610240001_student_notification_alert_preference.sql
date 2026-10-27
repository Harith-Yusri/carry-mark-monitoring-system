-- Store notification-alert consent per student. Carry-mark finalisation remains
-- unchanged; this preference only controls whether alerts are returned to the
-- authenticated student.
alter table public.students
  add column if not exists notification_alerts_enabled boolean;

update public.students
set notification_alerts_enabled = true
where notification_alerts_enabled is null;

alter table public.students
  alter column notification_alerts_enabled set default true,
  alter column notification_alerts_enabled set not null;

comment on column public.students.notification_alerts_enabled is
  'Whether this student receives carry-mark finalisation notification alerts.';

create or replace function public.set_my_notification_alerts_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = '' as $$
begin
  if p_enabled is null then
    raise exception 'Notification preference is required';
  end if;

  update public.students
  set notification_alerts_enabled = p_enabled,
      updated_at = now()
  where auth_user_id = (select auth.uid())
    and is_active;

  if not found then
    raise exception 'No active student record is linked to this account';
  end if;

  return p_enabled;
end;
$$;

revoke all on function public.set_my_notification_alerts_enabled(boolean) from public, anon;
grant execute on function public.set_my_notification_alerts_enabled(boolean) to authenticated;

-- Preserve the current active-semester wrapper and apply the student's alert
-- preference after the protected portal payload has been assembled.
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
        base.payload,
        '{student,semester}',
        coalesce((
          select to_jsonb(('Semester ' || term.semester_no || ' · ' || term.academic_year)::text)
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
