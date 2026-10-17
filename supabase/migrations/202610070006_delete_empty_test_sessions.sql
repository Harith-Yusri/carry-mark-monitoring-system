-- Testing convenience: only empty, inactive sessions may be deleted.
create or replace function public.delete_academic_session(target_term uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target_session public.academic_terms%rowtype;
declare offering_total bigint;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;

  select * into target_session from public.academic_terms where id = target_term for update;
  if not found then raise exception 'Academic session not found'; end if;
  if target_session.is_current or target_session.status = 'active' then
    raise exception 'The active academic session cannot be deleted. Activate another session first.';
  end if;

  select count(*) into offering_total from public.subject_offerings where term_id = target_term;
  if offering_total > 0 then
    raise exception 'This session contains teaching data and cannot be deleted. Keep it archived or reopen it for testing.';
  end if;

  delete from public.academic_terms where id = target_term;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, old_data)
  values (auth.uid(), 'deleted empty test session', 'academic_term', target_term,
    jsonb_build_object('academic_year', target_session.academic_year, 'session_no', target_session.semester_no,
      'status', target_session.status));
end;
$$;

revoke all on function public.delete_academic_session(uuid) from public, anon;
grant execute on function public.delete_academic_session(uuid) to authenticated;
notify pgrst, 'reload schema';
