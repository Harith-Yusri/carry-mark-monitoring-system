create function public.can_access_offering(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or public.owns_offering(target)
    or exists (
      select 1 from public.students st
      join public.enrolments e on e.student_id = st.id
      join public.class_sections cs on cs.id = e.section_id
      where st.auth_user_id = (select auth.uid()) and st.is_active
        and e.status = 'enrolled' and cs.offering_id = target
    );
$$;

create function public.can_access_section(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (
      select 1 from public.class_sections cs
      where cs.id = target and public.owns_offering(cs.offering_id)
    )
    or exists (
      select 1 from public.students st
      join public.enrolments e on e.student_id = st.id
      where st.auth_user_id = (select auth.uid()) and st.is_active
        and e.status = 'enrolled' and e.section_id = target
    );
$$;

create function public.can_access_enrolment(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (
      select 1 from public.enrolments e
      join public.class_sections cs on cs.id = e.section_id
      where e.id = target and public.owns_offering(cs.offering_id)
    )
    or exists (
      select 1 from public.enrolments e
      join public.students st on st.id = e.student_id
      where e.id = target and st.auth_user_id = (select auth.uid()) and st.is_active
    );
$$;

create function public.can_access_student(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or public.is_current_student(target)
    or exists (
      select 1 from public.enrolments e
      join public.class_sections cs on cs.id = e.section_id
      where e.student_id = target and public.owns_offering(cs.offering_id)
    );
$$;

create function public.student_can_read_lecturer(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.students st
    join public.enrolments e on e.student_id = st.id
    join public.class_sections cs on cs.id = e.section_id
    join public.subject_offerings so on so.id = cs.offering_id
    where st.auth_user_id = (select auth.uid()) and st.is_active
      and e.status = 'enrolled' and so.lecturer_id = target
  );
$$;

drop policy if exists profiles_student_read_lecturers on public.profiles;
create policy profiles_student_read_lecturers on public.profiles for select to authenticated
using (public.student_can_read_lecturer(id));

drop policy if exists offerings_read on public.subject_offerings;
drop policy if exists offerings_student_read on public.subject_offerings;
create policy offerings_read on public.subject_offerings for select to authenticated
using (public.can_access_offering(id));

drop policy if exists sections_read on public.class_sections;
drop policy if exists sections_student_read on public.class_sections;
create policy sections_read on public.class_sections for select to authenticated
using (public.can_access_section(id));

drop policy if exists students_read on public.students;
drop policy if exists students_read_self on public.students;
create policy students_read on public.students for select to authenticated
using (public.can_access_student(id));

drop policy if exists enrolments_read on public.enrolments;
drop policy if exists enrolments_student_read on public.enrolments;
create policy enrolments_read on public.enrolments for select to authenticated
using (public.can_access_enrolment(id));

drop policy if exists assessments_read on public.assessments;
drop policy if exists assessments_student_read on public.assessments;
create policy assessments_read on public.assessments for select to authenticated
using (public.can_access_offering(offering_id));

drop policy if exists marks_read on public.marks;
drop policy if exists marks_student_read on public.marks;
create policy marks_read on public.marks for select to authenticated
using (public.can_access_enrolment(enrolment_id));

drop policy if exists marks_write on public.marks;
create policy marks_write on public.marks for all to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.enrolments e
    join public.class_sections cs on cs.id = e.section_id
    where e.id = marks.enrolment_id and public.owns_offering(cs.offering_id)
  )
)
with check (
  entered_by = (select auth.uid()) and (
    public.is_admin() or exists (
      select 1 from public.enrolments e
      join public.class_sections cs on cs.id = e.section_id
      where e.id = marks.enrolment_id and public.owns_offering(cs.offering_id)
    )
  )
);

drop policy if exists submissions_read on public.submissions;
drop policy if exists submissions_student_read on public.submissions;
create policy submissions_read on public.submissions for select to authenticated
using (public.can_access_section(section_id));

