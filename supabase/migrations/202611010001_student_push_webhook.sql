-- Dispatch after commit through pg_net; delivery never delays mark release.
create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_student_release_push()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  webhook_secret text;
  webhook_url text;
begin
  select decrypted_secret into webhook_secret from vault.decrypted_secrets
  where name = 'cams_push_webhook_secret' limit 1;
  select decrypted_secret into webhook_url from vault.decrypted_secrets
  where name = 'cams_push_webhook_url' limit 1;
  if webhook_secret is null or webhook_url is null then
    raise warning 'CAMS push webhook is not configured; notification remains pending';
    return new;
  end if;
  perform net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT', 'schema', 'public', 'table', 'notifications',
      'record', jsonb_build_object('id', new.id, 'type', new.type)
    ),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- Keep the committed academic release and notification row even if pg_net
  -- cannot enqueue the delivery. Operational logs can be used to retry it.
  raise warning 'CAMS push dispatch could not be queued';
  return new;
end;
$$;

revoke all on function public.dispatch_student_release_push() from public, anon, authenticated;

create trigger cams_student_marks_push
after insert on public.notifications
for each row when (new.type = 'marks_released' and new.student_id is not null)
execute function public.dispatch_student_release_push();

notify pgrst, 'reload schema';
