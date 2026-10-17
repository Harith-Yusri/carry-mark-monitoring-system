-- Keep the established portal payload, but source its displayed academic
-- session directly from the one active academic_terms row.
alter function public.get_my_mobile_portal() rename to get_my_mobile_portal_payload;

revoke all on function public.get_my_mobile_portal_payload() from public, anon, authenticated;

create function public.get_my_mobile_portal()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_set(
    public.get_my_mobile_portal_payload(),
    '{student,semester}',
    coalesce((
      select to_jsonb(('Session ' || term.semester_no || ' · ' || term.academic_year)::text)
      from public.academic_terms term
      where term.is_current and term.status = 'active'
      limit 1
    ), 'null'::jsonb),
    true
  );
$$;

revoke all on function public.get_my_mobile_portal() from public, anon;
grant execute on function public.get_my_mobile_portal() to authenticated;
notify pgrst, 'reload schema';
