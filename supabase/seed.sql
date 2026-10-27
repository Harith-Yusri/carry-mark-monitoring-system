insert into public.academic_terms (
  academic_year, semester_code, semester_no, starts_on, ends_on, default_deadline,
  carry_max, eligible_threshold, status, is_current
) values (
  '2025/2026', '20262', 2, '2026-01-15', '2026-06-30', '2026-06-20 23:59:59+08',
  50, 40, 'active', true
)
on conflict (academic_year, semester_no) do nothing;

insert into public.subjects (code, name)
select data.code, data.name
from (values
  ('ITT593', 'Database Systems'),
  ('ITT557', 'Mobile Application Development'),
  ('ITT588', 'Front-End Web Development'),
  ('ITT569', 'Internet of Things')
) as data(code, name)
on conflict (code) do update set name = excluded.name;
