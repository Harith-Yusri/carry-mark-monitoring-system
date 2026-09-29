-- Keep password-based ID login while using recognisable UiTM email addresses
-- internally in Supabase Auth.
update auth.users as auth_user
set email = lower(student.matrix_no) || '@student.uitm.edu.my',
    raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('email', lower(student.matrix_no) || '@student.uitm.edu.my'),
    updated_at = now()
from public.students as student
where student.auth_user_id = auth_user.id;

update auth.users as auth_user
set email = lower(profile.staff_no) || '@uitm.edu.my',
    raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('email', lower(profile.staff_no) || '@uitm.edu.my'),
    updated_at = now()
from public.profiles as profile
where profile.id = auth_user.id
  and profile.role in ('lecturer', 'admin');

update auth.identities as identity
set identity_data = coalesce(identity.identity_data, '{}'::jsonb)
  || jsonb_build_object(
    'email', auth_user.email,
    'email_verified', true
  ),
  updated_at = now()
from auth.users as auth_user
where identity.user_id = auth_user.id
  and identity.provider = 'email';
