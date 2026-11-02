-- Keep lecturer contact details outside the broadly readable profile row. Students
-- can retrieve only their assigned lecturer's number, for one current enrolment,
-- through the narrowly scoped RPC below.
create table public.lecturer_contacts (
  lecturer_id uuid primary key references public.profiles(id) on delete cascade,
  whatsapp_phone text,
  updated_at timestamptz not null default now(),
  constraint lecturer_contacts_whatsapp_phone_valid
    check (whatsapp_phone is null or whatsapp_phone ~ '^601[0-9]{8,9}$')
);

alter table public.lecturer_contacts enable row level security;

create policy lecturer_contacts_admin_read
on public.lecturer_contacts for select to authenticated
using (public.is_admin());

create policy lecturer_contacts_admin_write
on public.lecturer_contacts for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Seed only the existing demo lecturers. These clearly fictional numbers can be
-- replaced later by an administrator without changing the student application.
insert into public.lecturer_contacts (lecturer_id, whatsapp_phone)
select lecturer.id,
  case lecturer.staff_no
    when 'TS001' then '601100000001'
    when 'TS003' then '601100000003'
  end
from public.profiles lecturer
where lecturer.role = 'lecturer'
  and lecturer.staff_no in ('TS001', 'TS003')
on conflict (lecturer_id) do update
set whatsapp_phone = excluded.whatsapp_phone,
    updated_at = now();

create or replace function public.get_my_lecturer_whatsapp(target_offering uuid)
returns text
language sql
stable
security definer
set search_path = '' as $$
  select contact.whatsapp_phone
  from public.students student
  join public.enrolments enrolment
    on enrolment.student_id = student.id and enrolment.status = 'enrolled'
  join public.class_sections section
    on section.id = enrolment.section_id and section.offering_id = target_offering
  join public.subject_offerings offering on offering.id = section.offering_id
  join public.academic_terms term
    on term.id = offering.term_id and term.is_current and term.status = 'active'
  join public.profiles lecturer
    on lecturer.id = offering.lecturer_id
   and lecturer.role = 'lecturer' and lecturer.is_active
  left join public.lecturer_contacts contact on contact.lecturer_id = lecturer.id
  join public.submissions submission
    on submission.section_id = section.id and submission.status = 'finalised'
  join public.student_carry_totals totals
    on totals.enrolment_id = enrolment.id and not totals.eligible
  where student.auth_user_id = (select auth.uid())
    and student.is_active
  limit 1;
$$;

revoke all on table public.lecturer_contacts from public, anon;
grant select on table public.lecturer_contacts to authenticated;
revoke all on function public.get_my_lecturer_whatsapp(uuid) from public, anon;
grant execute on function public.get_my_lecturer_whatsapp(uuid) to authenticated;

comment on table public.lecturer_contacts is
  'Private staff contact details maintained administratively for ineligible-student consultation.';
comment on column public.lecturer_contacts.whatsapp_phone is
  'Malaysian WhatsApp number normalized to digits-only international format.';

notify pgrst, 'reload schema';
