-- Preserve validation, account reassignment, token rotation and multiple devices.
create or replace function public.register_my_push_device(p_installation_id text, p_expo_push_token text, p_platform text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and (student_id is distinct from current_student or expo_push_token is distinct from p_expo_push_token
      or platform is distinct from p_platform or not active or last_error is not null
      or last_registered_at <= now() - interval '24 hours')
  returning id into device_id;

  if device_id is null then
    -- Repeated unchanged registrations, including old clients, are no-op reads.
    select id into device_id from public.student_push_devices
    where installation_id=p_installation_id and student_id=current_student
      and expo_push_token=p_expo_push_token and platform=p_platform and active and last_error is null;
  end if;
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
$function$;
