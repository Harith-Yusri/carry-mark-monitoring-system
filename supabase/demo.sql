-- Idempotent demo data matching src/mock/mockData.ts.
-- The Auth user must already exist; all dependent inserts safely skip otherwise.

update public.profiles
set staff_no = 'TS003',
    full_name = 'Dr. Siti Rahimah',
    role = 'lecturer',
    programme_id = (select id from public.programmes where code = 'IT'),
    is_active = true
where id = 'be7c9406-4a1c-422c-8fe8-561bee674c42';

insert into public.subject_offerings (subject_id, term_id, lecturer_id, status)
select s.id, t.id, p.id,
       case s.code when 'ITT569' then 'draft'::public.offering_status
                   when 'ITT593' then 'completed'::public.offering_status
                   else 'active'::public.offering_status end
from public.subjects s
join public.academic_terms t on t.academic_year = '2025/2026' and t.semester_no = 2
join public.profiles p on p.staff_no = 'TS003'
where s.code in ('ITT593', 'ITT557', 'ITT588', 'ITT569')
on conflict (subject_id, term_id, lecturer_id) do update set status = excluded.status;

insert into public.class_sections
  (offering_id, label, day_of_week, starts_at, ends_at, room, capacity, join_code)
select so.id, v.label, v.day_of_week, v.starts_at, v.ends_at, v.room,
       case s.code
         when 'ITT593' then (array[15,16,11])[v.position]
         when 'ITT557' then (array[10,10,10])[v.position]
         when 'ITT588' then (array[12,12,12])[v.position]
         else (array[10,9,9])[v.position]
       end,
       s.code || '-' || v.suffix
from public.subject_offerings so
join public.subjects s on s.id = so.subject_id
join public.profiles p on p.id = so.lecturer_id and p.staff_no = 'TS003'
cross join (values
  (1, 'Class A', 1, '08:00'::time, '10:00'::time, 'Bilik Kuliah 1', '4X9'),
  (2, 'Class B', 2, '10:00'::time, '12:00'::time, 'Bilik Kuliah 3', '7K2'),
  (3, 'Class C', 3, '14:00'::time, '16:00'::time, 'Lab Komputer 2', '9M5')
) as v(position, label, day_of_week, starts_at, ends_at, room, suffix)
on conflict (offering_id, label) do update set
  day_of_week = excluded.day_of_week, starts_at = excluded.starts_at,
  ends_at = excluded.ends_at, room = excluded.room, capacity = excluded.capacity,
  join_code = excluded.join_code;

insert into public.students (matrix_no, full_name, programme_id)
select v.matrix_no, v.full_name, p.id
from public.programmes p
cross join (values
  ('20221123001', 'Muhammad Haziq Bin Rosli'),
  ('20221123002', 'Nurul Ain Sofea Bt Ahmad'),
  ('20221123003', 'Ahmad Farhan Bin Malik'),
  ('20221123004', 'Siti Nabilah Bt Zainudin'),
  ('20221123005', 'Amirul Hakeem Bin Aziz'),
  ('20221123006', 'Farah Liyana Bt Ismail')
) as v(matrix_no, full_name)
where p.code = 'IT'
on conflict (matrix_no) do update set full_name = excluded.full_name, programme_id = excluded.programme_id;

insert into public.enrolments (section_id, student_id, status)
select cs.id, st.id, 'enrolled'
from public.class_sections cs
join public.subject_offerings so on so.id = cs.offering_id
join public.profiles p on p.id = so.lecturer_id and p.staff_no = 'TS003'
cross join public.students st
where cs.label = 'Class A' and st.matrix_no like '20221123%'
on conflict (section_id, student_id) do update set status = excluded.status;

insert into public.assessments
  (offering_id, name, assessment_type, max_score, carry_weight, position, is_published)
select so.id, v.name, v.assessment_type, v.max_score, v.carry_weight, v.position, true
from public.subject_offerings so
join public.profiles p on p.id = so.lecturer_id and p.staff_no = 'TS003'
cross join (values
  ('Quiz 1',       'Quiz',       10::numeric,  5::numeric, 1),
  ('Assignment 1', 'Assignment', 20::numeric, 10::numeric, 2),
  ('Test 1',       'Test',       30::numeric, 15::numeric, 3),
  ('Quiz 2',       'Quiz',       10::numeric,  5::numeric, 4),
  ('Test 2',       'Test',       30::numeric, 15::numeric, 5)
) as v(name, assessment_type, max_score, carry_weight, position)
on conflict (offering_id, name) do update set
  assessment_type = excluded.assessment_type, max_score = excluded.max_score,
  carry_weight = excluded.carry_weight, position = excluded.position,
  is_published = excluded.is_published;

insert into public.marks (enrolment_id, assessment_id, score, entered_by)
select e.id, a.id,
       case a.position
         when 1 then v.quiz1 when 2 then v.assign1 when 3 then v.test1
         when 4 then v.quiz2 when 5 then v.test2
       end,
       p.id
from public.enrolments e
join public.students st on st.id = e.student_id
join public.class_sections cs on cs.id = e.section_id
join public.subject_offerings so on so.id = cs.offering_id
join public.profiles p on p.id = so.lecturer_id and p.staff_no = 'TS003'
join public.assessments a on a.offering_id = so.id
join (values
  ('20221123001', 8::numeric, 18::numeric, 25::numeric, 7::numeric, 23::numeric),
  ('20221123002', 9, 19, 27, 8, 25),
  ('20221123003', 7, 15, 20, 6, 18),
  ('20221123004', 8, 17, 23, 7, 22),
  ('20221123005', 6, 16, 22, 5, 19),
  ('20221123006', 9, 20, 28, 9, 27)
) as v(matrix_no, quiz1, assign1, test1, quiz2, test2) on v.matrix_no = st.matrix_no
on conflict (enrolment_id, assessment_id) do update set score = excluded.score, entered_by = excluded.entered_by;

insert into public.submissions (section_id, status, finalised_by, finalised_at)
select cs.id, 'finalised', p.id, '2026-06-24 14:30:12+08'::timestamptz
from public.class_sections cs
join public.subject_offerings so on so.id = cs.offering_id
join public.subjects s on s.id = so.subject_id and s.code = 'ITT593'
join public.profiles p on p.id = so.lecturer_id and p.staff_no = 'TS003'
where cs.label = 'Class A'
on conflict (section_id) do update set status = excluded.status,
  finalised_by = excluded.finalised_by, finalised_at = excluded.finalised_at;

insert into public.programme_deadlines (term_id, programme_id, deadline_at)
select t.id, p.id, '2026-06-20 23:59:59+08'::timestamptz
from public.academic_terms t cross join public.programmes p
where t.academic_year = '2025/2026' and t.semester_no = 2
on conflict (term_id, programme_id) do update set deadline_at = excluded.deadline_at;

insert into public.notification_settings
  (term_id, auto_remind, reminder_days, notify_students, alert_administrators, updated_by)
select t.id, true, 3, true, true, p.id
from public.academic_terms t
join public.profiles p on p.staff_no = 'TS003'
where t.academic_year = '2025/2026' and t.semester_no = 2
on conflict (term_id) do update set
  auto_remind = excluded.auto_remind, reminder_days = excluded.reminder_days,
  notify_students = excluded.notify_students,
  alert_administrators = excluded.alert_administrators;

insert into public.audit_logs
  (actor_id, action, entity_type, entity_id, subject_code_snapshot, created_at)
select p.id, 'finalised carry marks', 'class_section', cs.id, 'ITT593',
       '2026-06-24 14:30:12+08'::timestamptz
from public.profiles p
join public.subject_offerings so on so.lecturer_id = p.id
join public.subjects s on s.id = so.subject_id and s.code = 'ITT593'
join public.class_sections cs on cs.offering_id = so.id and cs.label = 'Class A'
where p.staff_no = 'TS003'
  and not exists (
    select 1 from public.audit_logs al
    where al.actor_id = p.id and al.action = 'finalised carry marks'
      and al.entity_id = cs.id
  );
