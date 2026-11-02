-- Student push devices are separate from academic/profile data so one student
-- can safely register multiple installations and rotate tokens independently.
create table public.student_push_devices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  installation_id text not null unique check (char_length(installation_id) between 16 and 100),
  expo_push_token text not null unique check (
    expo_push_token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$'
  ),
  platform text not null check (platform in ('android', 'ios')),
  active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_push_devices_student_active_idx
  on public.student_push_devices(student_id) where active;

alter table public.student_push_devices enable row level security;
create policy student_push_devices_read_own
on public.student_push_devices for select to authenticated
using (exists (
  select 1 from public.students student
  where student.id = student_push_devices.student_id
    and student.auth_user_id = (select auth.uid())
    and student.is_active
));
create policy student_push_devices_delete_own
on public.student_push_devices for delete to authenticated
using (exists (
  select 1 from public.students student
  where student.id = student_push_devices.student_id
    and student.auth_user_id = (select auth.uid())
    and student.is_active
));

revoke all on public.student_push_devices from public, anon, authenticated;
grant select, delete on public.student_push_devices to authenticated;

-- Existing staff notifications keep recipient_id. Student notifications use
-- student_id and retain the section/offering identifiers in a data payload.
alter table public.notifications alter column recipient_id drop not null;
alter table public.notifications
  add column student_id uuid references public.students(id) on delete cascade,
  add column data jsonb not null default '{}'::jsonb,
  add column release_id uuid;

alter table public.notifications drop constraint notifications_delivery_status_check;
alter table public.notifications add constraint notifications_delivery_status_check
  check (delivery_status in ('pending', 'sent', 'failed', 'skipped'));
alter table public.notifications add constraint notifications_one_recipient_check
  check (num_nonnulls(recipient_id, student_id) = 1);

create unique index notifications_student_release_once_idx
  on public.notifications(student_id, type, release_id)
  where student_id is not null and release_id is not null;
create index notifications_student_created_idx
  on public.notifications(student_id, created_at desc)
  where student_id is not null;

drop policy if exists notifications_read_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_read_own
on public.notifications for select to authenticated
using (
  recipient_id = (select auth.uid())
  or exists (
    select 1 from public.students student
    where student.id = notifications.student_id
      and student.auth_user_id = (select auth.uid())
      and student.is_active
  )
  or public.is_admin()
);
create policy notifications_update_own
on public.notifications for update to authenticated
using (
  recipient_id = (select auth.uid())
  or exists (
    select 1 from public.students student
    where student.id = notifications.student_id
      and student.auth_user_id = (select auth.uid())
      and student.is_active
  )
)
with check (
  recipient_id = (select auth.uid())
  or exists (
    select 1 from public.students student
    where student.id = notifications.student_id
      and student.auth_user_id = (select auth.uid())
      and student.is_active
  )
);

-- Delivery rows make each notification/device pair idempotent and retain the
-- Expo ticket for operational troubleshooting.
create table public.student_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_id uuid not null references public.student_push_devices(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  expo_ticket_id text,
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, device_id)
);

alter table public.student_push_deliveries enable row level security;
create policy student_push_deliveries_read_own
on public.student_push_deliveries for select to authenticated
using (exists (
  select 1
  from public.student_push_devices device
  join public.students student on student.id = device.student_id
  where device.id = student_push_deliveries.device_id
    and student.auth_user_id = (select auth.uid())
    and student.is_active
));
revoke all on public.student_push_deliveries from public, anon, authenticated;
grant select on public.student_push_deliveries to authenticated;

create or replace function public.register_my_push_device(
  p_installation_id text,
  p_expo_push_token text,
  p_platform text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  current_student uuid;
  device_id uuid;
begin
  select student.id into current_student
  from public.students student
  where student.auth_user_id = (select auth.uid()) and student.is_active;
  if current_student is null then
    raise exception 'An active student account is required';
  end if;
  if char_length(trim(coalesce(p_installation_id, ''))) not between 16 and 100 then
    raise exception 'Invalid device installation identifier';
  end if;
  if p_expo_push_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid Expo push token';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform';
  end if;

  update public.student_push_devices
  set student_id = current_student,
      expo_push_token = p_expo_push_token,
      platform = p_platform,
      active = true,
      last_registered_at = now(),
      last_error = null,
      updated_at = now()
  where installation_id = p_installation_id
  returning id into device_id;

  if device_id is null then
    insert into public.student_push_devices (
      student_id, installation_id, expo_push_token, platform
    ) values (
      current_student, p_installation_id, p_expo_push_token, p_platform
    )
    on conflict (expo_push_token) do update
    set student_id = excluded.student_id,
        installation_id = excluded.installation_id,
        platform = excluded.platform,
        active = true,
        last_registered_at = now(),
        last_error = null,
        updated_at = now()
    returning id into device_id;
  end if;

  return device_id;
end;
$$;

create or replace function public.unregister_my_push_device(p_installation_id text)
returns void
language sql security definer set search_path = '' as $$
  update public.student_push_devices device
  set active = false, updated_at = now()
  where device.installation_id = p_installation_id
    and exists (
      select 1 from public.students student
      where student.id = device.student_id
        and student.auth_user_id = (select auth.uid())
    );
$$;

revoke all on function public.register_my_push_device(text, text, text) from public, anon;
revoke all on function public.unregister_my_push_device(text) from public, anon;
grant execute on function public.register_my_push_device(text, text, text) to authenticated;
grant execute on function public.unregister_my_push_device(text) to authenticated;

-- A release ID distinguishes a legitimate release after an administrator has
-- reopened a class, while an already-finalised repeat call remains idempotent.
alter table public.submissions add column release_id uuid;
update public.submissions set release_id = gen_random_uuid()
where status = 'finalised' and release_id is null;

create or replace function public.finalise_section(target_section uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_offering uuid;
  carry_limit numeric;
  weight_total numeric;
  missing_marks bigint;
  subject_code text;
  subject_name text;
  current_status public.submission_status;
  current_release uuid;
begin
  select section.offering_id, offering.carry_max, subject.code,
         coalesce(offering.subject_name_override, subject.name)
    into target_offering, carry_limit, subject_code, subject_name
  from public.class_sections section
  join public.subject_offerings offering on offering.id = section.offering_id
  join public.academic_terms term on term.id = offering.term_id
  join public.subjects subject on subject.id = offering.subject_id
  where section.id = target_section;

  if target_offering is null then raise exception 'Section not found'; end if;
  if not (public.is_admin() or public.owns_offering(target_offering)) then raise exception 'Not authorized'; end if;
  select offering.carry_max into carry_limit
  from public.subject_offerings offering
  where offering.id = target_offering for update;
  select submission.status into current_status
  from public.submissions submission
  where submission.section_id = target_section;
  if current_status = 'finalised' then return; end if;
  if carry_limit is null then raise exception 'Set the total carry-mark weightage for this subject first.'; end if;

  select coalesce(sum(assessment.carry_weight), 0) into weight_total
  from public.assessments assessment where assessment.offering_id = target_offering;
  if weight_total <> carry_limit then
    raise exception 'Assessment carry weights (%) must total %', weight_total, carry_limit;
  end if;

  select count(*) into missing_marks
  from public.enrolments enrolment
  cross join public.assessments assessment
  left join public.marks mark
    on mark.enrolment_id = enrolment.id and mark.assessment_id = assessment.id
  where enrolment.section_id = target_section and enrolment.status = 'enrolled'
    and assessment.offering_id = target_offering and mark.score is null;
  if missing_marks > 0 then raise exception '% assessment marks are missing', missing_marks; end if;

  current_release := gen_random_uuid();
  insert into public.submissions(section_id, status, finalised_by, finalised_at, release_id)
  values (target_section, 'finalised', auth.uid(), now(), current_release)
  on conflict (section_id) do update set
    status = 'finalised', finalised_by = auth.uid(), finalised_at = now(),
    reopened_by = null, reopened_at = null, reopen_reason = null,
    release_id = current_release;

  insert into public.notifications (
    recipient_id, student_id, type, title, body, related_entity_id,
    data, release_id, delivery_status
  )
  select null, student.id, 'marks_released', 'Marks Released',
    'Your continuous assessment marks for ' || subject_code || ' have been released.',
    target_section,
    jsonb_build_object(
      'offeringId', target_offering,
      'sectionId', target_section,
      'subjectCode', subject_code,
      'subjectName', subject_name,
      'route', '/subject/' || target_offering::text
    ),
    current_release,
    'pending'
  from public.enrolments enrolment
  join public.students student on student.id = enrolment.student_id and student.is_active
  where enrolment.section_id = target_section and enrolment.status = 'enrolled'
  on conflict (student_id, type, release_id)
    where student_id is not null and release_id is not null
    do nothing;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, subject_code_snapshot)
  values (auth.uid(), 'finalised carry marks', 'class_section', target_section, subject_code);
end;
$$;

revoke all on function public.finalise_section(uuid) from public, anon;
grant execute on function public.finalise_section(uuid) to authenticated;

notify pgrst, 'reload schema';
