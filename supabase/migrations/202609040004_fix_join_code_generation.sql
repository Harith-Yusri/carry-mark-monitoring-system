create or replace function public.rotate_class_join_code(target_section uuid) returns text
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
    new_code := prefix || '-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6));
    exit when not exists (select 1 from public.class_sections where join_code = new_code);
  end loop;

  update public.class_sections set join_code = new_code where id = target_section;
  return new_code;
end;
$$;
