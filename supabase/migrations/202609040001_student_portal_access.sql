create function public.is_current_student(target_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students
    where id = target_student
      and auth_user_id = (select auth.uid())
      and is_active
  );
$$;

create policy profiles_student_read_lecturers
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.students st
    join public.enrolments e on e.student_id = st.id
    join public.class_sections cs on cs.id = e.section_id
    join public.subject_offerings so on so.id = cs.offering_id
    where st.auth_user_id = (select auth.uid())
      and so.lecturer_id = profiles.id
  )
);

create policy offerings_student_read
on public.subject_offerings for select to authenticated
using (
  exists (
    select 1
    from public.students st
    join public.enrolments e on e.student_id = st.id
    join public.class_sections cs on cs.id = e.section_id
    where st.auth_user_id = (select auth.uid())
      and cs.offering_id = subject_offerings.id
  )
);

create policy sections_student_read
on public.class_sections for select to authenticated
using (
  exists (
    select 1
    from public.students st
    join public.enrolments e on e.student_id = st.id
    where st.auth_user_id = (select auth.uid())
      and e.section_id = class_sections.id
  )
);

create policy students_read_self
on public.students for select to authenticated
using (auth_user_id = (select auth.uid()));

create policy enrolments_student_read
on public.enrolments for select to authenticated
using (public.is_current_student(student_id));

create policy assessments_student_read
on public.assessments for select to authenticated
using (
  exists (
    select 1
    from public.students st
    join public.enrolments e on e.student_id = st.id
    join public.class_sections cs on cs.id = e.section_id
    where st.auth_user_id = (select auth.uid())
      and cs.offering_id = assessments.offering_id
  )
);

create policy marks_student_read
on public.marks for select to authenticated
using (
  exists (
    select 1
    from public.enrolments e
    where e.id = marks.enrolment_id
      and public.is_current_student(e.student_id)
  )
);

create policy submissions_student_read
on public.submissions for select to authenticated
using (
  exists (
    select 1
    from public.enrolments e
    where e.section_id = submissions.section_id
      and public.is_current_student(e.student_id)
  )
);

create or replace function public.get_my_subjects()
returns table (
  offering_id uuid,
  subject_code text,
  subject_name text,
  lecturer_name text,
  section_label text,
  academic_year text,
  semester_no smallint,
  carry_mark numeric,
  carry_max numeric,
  eligible boolean,
  finalised boolean,
  last_updated timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select
    so.id,
    sub.code,
    sub.name,
    lecturer.full_name,
    cs.label,
    term.academic_year,
    term.semester_no,
    totals.total_carry,
    term.carry_max,
    totals.eligible,
    coalesce(submission.status = 'finalised', false),
    max(m.updated_at)
  from public.students student
  join public.enrolments e on e.student_id = student.id and e.status = 'enrolled'
  join public.class_sections cs on cs.id = e.section_id
  join public.subject_offerings so on so.id = cs.offering_id
  join public.subjects sub on sub.id = so.subject_id
  join public.profiles lecturer on lecturer.id = so.lecturer_id
  join public.academic_terms term on term.id = so.term_id
  left join public.student_carry_totals totals on totals.enrolment_id = e.id
  left join public.submissions submission on submission.section_id = cs.id
  left join public.marks m on m.enrolment_id = e.id
  where student.auth_user_id = (select auth.uid())
  group by so.id, sub.code, sub.name, lecturer.full_name, cs.label,
           term.academic_year, term.semester_no, totals.total_carry,
           term.carry_max, totals.eligible, submission.status
  order by sub.code;
$$;

grant execute on function public.get_my_subjects() to authenticated;
revoke execute on function public.get_my_subjects() from anon;

