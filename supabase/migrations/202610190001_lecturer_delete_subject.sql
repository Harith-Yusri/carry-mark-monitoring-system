-- Allow lecturers to remove only their own subject offering in the active
-- semester. Existing finalisation and semester lifecycle triggers continue to
-- protect finalised and archived academic records.
create or replace function public.delete_my_lecturer_subject(target_offering uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.role = 'lecturer'
      and profile.is_active
  ) then
    raise exception 'Only an active lecturer can delete a subject.';
  end if;

  if not exists (
    select 1
    from public.subject_offerings offering
    join public.academic_terms term on term.id = offering.term_id
    where offering.id = target_offering
      and offering.lecturer_id = (select auth.uid())
      and term.is_current
      and term.status = 'active'
  ) then
    raise exception 'The subject was not found or is not editable in the active semester.';
  end if;

  delete from public.subject_offerings offering
  where offering.id = target_offering
    and offering.lecturer_id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_lecturer_subject(uuid) from public, anon;
grant execute on function public.delete_my_lecturer_subject(uuid) to authenticated;

notify pgrst, 'reload schema';
