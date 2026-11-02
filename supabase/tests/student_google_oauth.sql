-- Run after 202610280001. These hook checks do not create Auth users.
begin;
do $$
declare
  result jsonb;
begin
  result := public.hook_restrict_student_google_domain(jsonb_build_object(
    'user', jsonb_build_object(
      'email', 'personal@gmail.com',
      'app_metadata', jsonb_build_object('provider', 'google', 'providers', jsonb_build_array('google'))
    )
  ));
  if result #>> '{error,message}' <> 'Please sign in using your UiTM student Google account.' then
    raise exception 'FAIL: personal Google account was not rejected';
  end if;

  result := public.hook_restrict_student_google_domain(jsonb_build_object(
    'user', jsonb_build_object(
      'email', '2023123456@student.uitm.edu.my',
      'app_metadata', jsonb_build_object('provider', 'google', 'providers', jsonb_build_array('google'))
    )
  ));
  if result <> '{}'::jsonb then
    raise exception 'FAIL: UiTM student Google account was rejected';
  end if;

  result := public.hook_restrict_student_google_domain(jsonb_build_object(
    'user', jsonb_build_object(
      'email', 'lecturer@uitm.edu.my',
      'app_metadata', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
    )
  ));
  if result <> '{}'::jsonb then
    raise exception 'FAIL: existing non-Google staff authentication was changed';
  end if;
end;
$$;
rollback;
select 'Passed: Google student-domain restriction and unchanged staff email authentication.' as result;
