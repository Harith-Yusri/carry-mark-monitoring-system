-- Delete dependent draft records while their offering still exists so the
-- semester lifecycle trigger can resolve the correct active term. Relying on
-- the FK cascade caused child deletes to be misclassified as archived after
-- the parent offering had entered deletion.
create or replace function public.delete_my_lecturer_subject(target_offering uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_term uuid;
  target_subject uuid;
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

  select offering.term_id, offering.subject_id
  into target_term, target_subject
  from public.subject_offerings offering
  where offering.id = target_offering
    and offering.lecturer_id = (select auth.uid())
  for update;

  if target_term is null then
    raise exception 'The subject was not found or does not belong to your lecturer account.';
  end if;

  if not exists (
    select 1
    from public.academic_terms term
    where term.id = target_term
      and term.is_current
      and term.status = 'active'
  ) then
    raise exception 'Archived academic semester data is read-only.';
  end if;

  if exists (
    select 1
    from public.class_sections section
    join public.submissions submission on submission.section_id = section.id
    where section.offering_id = target_offering
      and submission.status = 'finalised'
  ) then
    raise exception 'Reopen the finalised class before deleting this subject.';
  end if;

  -- Delete in dependency order while session_for_record can still follow each
  -- child back to the current offering and active academic term.
  delete from public.marks mark
  using public.enrolments enrolment, public.class_sections section
  where mark.enrolment_id = enrolment.id
    and enrolment.section_id = section.id
    and section.offering_id = target_offering;

  delete from public.submissions submission
  using public.class_sections section
  where submission.section_id = section.id
    and section.offering_id = target_offering;

  delete from public.enrolments enrolment
  using public.class_sections section
  where enrolment.section_id = section.id
    and section.offering_id = target_offering;

  delete from public.assessments assessment
  where assessment.offering_id = target_offering;

  delete from public.class_sections section
  where section.offering_id = target_offering;

  delete from public.mark_disputes dispute
  where dispute.offering_id = target_offering;

  delete from public.subject_offerings offering
  where offering.id = target_offering
    and offering.lecturer_id = (select auth.uid());

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data)
  values ((select auth.uid()), 'deleted lecturer subject offering', 'subject_offering', target_offering,
    jsonb_build_object('term_id', target_term, 'subject_id', target_subject));
end;
$$;

revoke all on function public.delete_my_lecturer_subject(uuid) from public, anon;
grant execute on function public.delete_my_lecturer_subject(uuid) to authenticated;

notify pgrst, 'reload schema';
