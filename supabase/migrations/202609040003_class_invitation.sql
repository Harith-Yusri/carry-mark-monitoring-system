create function public.join_class_by_code(invitation_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target_student uuid;
  target_section uuid;
  target_offering uuid;
  enrolled_count integer;
  section_capacity integer;
begin
  select id into target_student
  from public.students
  where auth_user_id = auth.uid() and is_active;
  if target_student is null then raise exception 'No active student record is linked to this account'; end if;

  select cs.id, cs.offering_id, cs.capacity
    into target_section, target_offering, section_capacity
  from public.class_sections cs
  join public.subject_offerings so on so.id = cs.offering_id
  where upper(cs.join_code) = upper(trim(invitation_code))
    and so.status in ('active', 'draft');
  if target_section is null then raise exception 'Invalid or inactive class invitation code'; end if;

  if exists (
    select 1 from public.enrolments e
    join public.class_sections cs on cs.id = e.section_id
    where e.student_id = target_student and cs.offering_id = target_offering
      and e.status = 'enrolled'
  ) then raise exception 'You are already enrolled in this subject'; end if;

  select count(*) into enrolled_count from public.enrolments
  where section_id = target_section and status = 'enrolled';
  if enrolled_count >= section_capacity then raise exception 'This class is full'; end if;

  insert into public.enrolments(section_id, student_id, status)
  values (target_section, target_student, 'enrolled')
  on conflict (section_id, student_id) do update set status = 'enrolled';

  return target_section;
end;
$$;

grant execute on function public.join_class_by_code(text) to authenticated;
revoke execute on function public.join_class_by_code(text) from anon;

create function public.rotate_class_join_code(target_section uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  new_code text;
  prefix text;
begin
  if not public.can_access_section(target_section) then raise exception 'Not authorized'; end if;
  if not (
    public.is_admin() or exists (
      select 1 from public.class_sections cs
      where cs.id = target_section and public.owns_offering(cs.offering_id)
    )
  ) then raise exception 'Lecturer or administrator access required'; end if;

  select sub.code into prefix
  from public.class_sections cs
  join public.subject_offerings so on so.id = cs.offering_id
  join public.subjects sub on sub.id = so.subject_id
  where cs.id = target_section;

  loop
    new_code := prefix || '-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
    exit when not exists (select 1 from public.class_sections where join_code = new_code);
  end loop;

  update public.class_sections set join_code = new_code where id = target_section;
  return new_code;
end;
$$;

grant execute on function public.rotate_class_join_code(uuid) to authenticated;
revoke execute on function public.rotate_class_join_code(uuid) from anon;
