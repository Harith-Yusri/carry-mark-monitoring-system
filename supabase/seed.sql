insert into public.programmes (code, name) values
  ('CS', 'Computer Science'),
  ('IT', 'Information Technology'),
  ('IS', 'Information Systems')
on conflict (code) do update set name = excluded.name;

insert into public.academic_terms (
  academic_year, semester_no, starts_on, ends_on, default_deadline,
  carry_max, eligible_threshold, status, is_current
) values (
  '2025/2026', 2, '2026-01-15', '2026-06-30', '2026-06-20 23:59:59+08',
  50, 40, 'active', true
)
on conflict (academic_year, semester_no) do nothing;

insert into public.subjects (code, name, programme_id, programme_semester)
select data.code, data.name, p.id, data.programme_semester
from (values
  ('ITT593', 'Database Systems', 'IT', 5),
  ('ITT557', 'Mobile Application Development', 'IT', 4),
  ('ITT588', 'Front-End Web Development', 'IT', 5),
  ('ITT569', 'Internet of Things', 'IT', 6)
) as data(code, name, programme_code, programme_semester)
join public.programmes p on p.code = data.programme_code
on conflict (code) do update set name = excluded.name;

