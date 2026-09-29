create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'lecturer');
create type public.term_status as enum ('draft', 'active', 'closed');
create type public.offering_status as enum ('draft', 'active', 'completed');
create type public.enrolment_status as enum ('enrolled', 'withdrawn', 'completed');
create type public.submission_status as enum ('draft', 'finalised', 'reopened');

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  staff_no text not null unique,
  full_name text not null,
  role public.app_role not null,
  programme_id uuid references public.programmes(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  semester_no smallint not null check (semester_no between 1 and 3),
  starts_on date not null,
  ends_on date not null,
  default_deadline timestamptz not null,
  carry_max numeric(6,2) not null default 50 check (carry_max > 0),
  eligible_threshold numeric(6,2) not null default 40 check (eligible_threshold between 0 and carry_max),
  status public.term_status not null default 'draft',
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (academic_year, semester_no),
  check (starts_on < ends_on)
);

create unique index academic_terms_one_current_idx on public.academic_terms (is_current) where is_current;

create table public.programme_deadlines (
  term_id uuid not null references public.academic_terms(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  deadline_at timestamptz not null,
  primary key (term_id, programme_id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null,
  programme_id uuid not null references public.programmes(id) on delete restrict,
  programme_semester smallint check (programme_semester between 1 and 12),
  credit_hours numeric(3,1) check (credit_hours > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subject_offerings (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  lecturer_id uuid not null references public.profiles(id) on delete restrict,
  status public.offering_status not null default 'draft',
  deadline_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, term_id, lecturer_id)
);

create table public.class_sections (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.subject_offerings(id) on delete cascade,
  label text not null,
  day_of_week smallint check (day_of_week between 1 and 7),
  starts_at time,
  ends_at time,
  room text,
  capacity integer not null check (capacity > 0),
  join_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offering_id, label),
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  matrix_no text not null unique,
  full_name text not null,
  programme_id uuid not null references public.programmes(id) on delete restrict,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.class_sections(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  status public.enrolment_status not null default 'enrolled',
  external_ref text,
  enrolled_at timestamptz not null default now(),
  unique (section_id, student_id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.subject_offerings(id) on delete cascade,
  name text not null,
  assessment_type text not null,
  max_score numeric(7,2) not null check (max_score > 0),
  carry_weight numeric(6,2) not null check (carry_weight > 0),
  position smallint not null default 1 check (position > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offering_id, name),
  unique (offering_id, position)
);

create table public.marks (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.enrolments(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  score numeric(7,2) check (score >= 0),
  remarks text,
  entered_by uuid not null references public.profiles(id) on delete restrict,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (enrolment_id, assessment_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null unique references public.class_sections(id) on delete cascade,
  status public.submission_status not null default 'draft',
  finalised_by uuid references public.profiles(id) on delete restrict,
  finalised_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete restrict,
  reopened_at timestamptz,
  reopen_reason text,
  updated_at timestamptz not null default now()
);

create table public.notification_settings (
  term_id uuid primary key references public.academic_terms(id) on delete cascade,
  auto_remind boolean not null default true,
  reminder_days smallint not null default 3 check (reminder_days between 1 and 30),
  notify_students boolean not null default true,
  alert_administrators boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  related_entity_id uuid,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  subject_code_snapshot text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index subject_offerings_lecturer_idx on public.subject_offerings(lecturer_id);
create index subject_offerings_term_idx on public.subject_offerings(term_id);
create index class_sections_offering_idx on public.class_sections(offering_id);
create index enrolments_section_idx on public.enrolments(section_id);
create index enrolments_student_idx on public.enrolments(student_id);
create index assessments_offering_idx on public.assessments(offering_id);
create index marks_enrolment_idx on public.marks(enrolment_id);
create index marks_assessment_idx on public.marks(assessment_id);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger offerings_updated_at before update on public.subject_offerings for each row execute function public.set_updated_at();
create trigger sections_updated_at before update on public.class_sections for each row execute function public.set_updated_at();
create trigger students_updated_at before update on public.students for each row execute function public.set_updated_at();
create trigger assessments_updated_at before update on public.assessments for each row execute function public.set_updated_at();
create trigger submissions_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger notification_settings_updated_at before update on public.notification_settings for each row execute function public.set_updated_at();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and is_active
  );
$$;

create function public.owns_offering(target_offering uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subject_offerings
    where id = target_offering and lecturer_id = (select auth.uid())
  );
$$;

create function public.validate_mark() returns trigger
language plpgsql set search_path = '' as $$
declare
  maximum numeric;
  mark_offering uuid;
  enrolment_offering uuid;
  locked boolean;
begin
  select a.max_score, a.offering_id into maximum, mark_offering
  from public.assessments a where a.id = new.assessment_id;

  select cs.offering_id,
         coalesce(s.status = 'finalised', false)
    into enrolment_offering, locked
  from public.enrolments e
  join public.class_sections cs on cs.id = e.section_id
  left join public.submissions s on s.section_id = cs.id
  where e.id = new.enrolment_id;

  if maximum is null or enrolment_offering is null or mark_offering <> enrolment_offering then
    raise exception 'Assessment and enrolment must belong to the same offering';
  end if;
  if locked then raise exception 'Marks are locked for this finalised section'; end if;
  if new.score is not null and new.score > maximum then
    raise exception 'Score cannot exceed assessment maximum (%)', maximum;
  end if;
  if tg_op = 'UPDATE' then new.version = old.version + 1; end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger marks_validate before insert or update on public.marks for each row execute function public.validate_mark();

create function public.finalise_section(target_section uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_offering uuid;
  carry_limit numeric;
  weight_total numeric;
  missing_marks bigint;
  subject_code text;
begin
  select cs.offering_id, t.carry_max, sub.code
    into target_offering, carry_limit, subject_code
  from public.class_sections cs
  join public.subject_offerings so on so.id = cs.offering_id
  join public.academic_terms t on t.id = so.term_id
  join public.subjects sub on sub.id = so.subject_id
  where cs.id = target_section;

  if target_offering is null then raise exception 'Section not found'; end if;
  if not (public.is_admin() or public.owns_offering(target_offering)) then raise exception 'Not authorized'; end if;

  select coalesce(sum(carry_weight), 0) into weight_total
  from public.assessments where offering_id = target_offering;
  if weight_total <> carry_limit then
    raise exception 'Assessment carry weights (%) must total %', weight_total, carry_limit;
  end if;

  select count(*) into missing_marks
  from public.enrolments e
  cross join public.assessments a
  left join public.marks m on m.enrolment_id = e.id and m.assessment_id = a.id
  where e.section_id = target_section and e.status = 'enrolled'
    and a.offering_id = target_offering and m.score is null;
  if missing_marks > 0 then raise exception '% assessment marks are missing', missing_marks; end if;

  insert into public.submissions(section_id, status, finalised_by, finalised_at)
  values (target_section, 'finalised', auth.uid(), now())
  on conflict (section_id) do update set
    status = 'finalised', finalised_by = auth.uid(), finalised_at = now(),
    reopened_by = null, reopened_at = null, reopen_reason = null;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, subject_code_snapshot)
  values (auth.uid(), 'finalised carry marks', 'class_section', target_section, subject_code);
end;
$$;

create function public.reopen_section(target_section uuid, reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if nullif(trim(reason), '') is null then raise exception 'A reopen reason is required'; end if;

  update public.submissions set status = 'reopened', reopened_by = auth.uid(), reopened_at = now(), reopen_reason = reason
  where section_id = target_section and status = 'finalised';
  if not found then raise exception 'Finalised submission not found'; end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (auth.uid(), 'reopened carry marks', 'class_section', target_section, jsonb_build_object('reason', reason));
end;
$$;

create view public.student_carry_totals with (security_invoker = true) as
select e.id as enrolment_id, e.section_id, e.student_id,
       round(coalesce(sum((m.score / a.max_score) * a.carry_weight), 0), 2) as total_carry,
       t.eligible_threshold,
       round(coalesce(sum((m.score / a.max_score) * a.carry_weight), 0), 2) >= t.eligible_threshold as eligible
from public.enrolments e
join public.class_sections cs on cs.id = e.section_id
join public.subject_offerings so on so.id = cs.offering_id
join public.academic_terms t on t.id = so.term_id
left join public.assessments a on a.offering_id = so.id
left join public.marks m on m.enrolment_id = e.id and m.assessment_id = a.id
group by e.id, t.eligible_threshold;

alter table public.programmes enable row level security;
alter table public.profiles enable row level security;
alter table public.academic_terms enable row level security;
alter table public.programme_deadlines enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_offerings enable row level security;
alter table public.class_sections enable row level security;
alter table public.students enable row level security;
alter table public.enrolments enable row level security;
alter table public.assessments enable row level security;
alter table public.marks enable row level security;
alter table public.submissions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.programmes, public.academic_terms, public.programme_deadlines, public.subjects to authenticated;
grant select on public.profiles, public.subject_offerings, public.class_sections, public.students, public.enrolments, public.assessments, public.marks, public.submissions, public.notification_settings, public.notifications, public.audit_logs, public.student_carry_totals to authenticated;
grant insert, update, delete on public.assessments, public.marks, public.class_sections to authenticated;
grant insert, update, delete on public.programmes, public.profiles, public.academic_terms, public.programme_deadlines, public.subjects, public.subject_offerings, public.students, public.enrolments, public.notification_settings to authenticated;
grant update on public.notifications to authenticated;
grant execute on function public.finalise_section(uuid), public.reopen_section(uuid, text) to authenticated;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy profiles_admin_write on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy catalogue_read on public.programmes for select to authenticated using (true);
create policy terms_read on public.academic_terms for select to authenticated using (true);
create policy deadlines_read on public.programme_deadlines for select to authenticated using (true);
create policy subjects_read on public.subjects for select to authenticated using (true);
create policy admin_programmes on public.programmes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_terms on public.academic_terms for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_deadlines on public.programme_deadlines for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_subjects on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy offerings_read on public.subject_offerings for select to authenticated using (lecturer_id = (select auth.uid()) or public.is_admin());
create policy offerings_admin_write on public.subject_offerings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sections_read on public.class_sections for select to authenticated using (public.owns_offering(offering_id) or public.is_admin());
create policy sections_write on public.class_sections for all to authenticated using (public.owns_offering(offering_id) or public.is_admin()) with check (public.owns_offering(offering_id) or public.is_admin());
create policy assessments_read on public.assessments for select to authenticated using (public.owns_offering(offering_id) or public.is_admin());
create policy assessments_write on public.assessments for all to authenticated using (public.owns_offering(offering_id) or public.is_admin()) with check (public.owns_offering(offering_id) or public.is_admin());

create policy students_read on public.students for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.enrolments e join public.class_sections cs on cs.id = e.section_id
    where e.student_id = students.id and public.owns_offering(cs.offering_id)
  )
);
create policy students_admin_write on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy enrolments_read on public.enrolments for select to authenticated using (
  public.is_admin() or exists (select 1 from public.class_sections cs where cs.id = section_id and public.owns_offering(cs.offering_id))
);
create policy enrolments_admin_write on public.enrolments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy marks_read on public.marks for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.enrolments e join public.class_sections cs on cs.id = e.section_id
    where e.id = enrolment_id and public.owns_offering(cs.offering_id)
  )
);
create policy marks_write on public.marks for all to authenticated using (
  public.is_admin() or exists (
    select 1 from public.enrolments e join public.class_sections cs on cs.id = e.section_id
    where e.id = enrolment_id and public.owns_offering(cs.offering_id)
  )
) with check (
  entered_by = (select auth.uid()) and (public.is_admin() or exists (
    select 1 from public.enrolments e join public.class_sections cs on cs.id = e.section_id
    where e.id = enrolment_id and public.owns_offering(cs.offering_id)
  ))
);
create policy submissions_read on public.submissions for select to authenticated using (
  public.is_admin() or exists (select 1 from public.class_sections cs where cs.id = section_id and public.owns_offering(cs.offering_id))
);
create policy notification_settings_read on public.notification_settings for select to authenticated using (true);
create policy notification_settings_admin on public.notification_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notifications_read_own on public.notifications for select to authenticated using (recipient_id = (select auth.uid()) or public.is_admin());
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy audit_read on public.audit_logs for select to authenticated using (public.is_admin() or actor_id = (select auth.uid()));

revoke insert, update, delete on public.submissions, public.audit_logs, public.notifications from authenticated;

