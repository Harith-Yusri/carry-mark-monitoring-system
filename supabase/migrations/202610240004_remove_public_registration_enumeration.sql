-- Duplicate IDs remain protected by unique constraints and the Auth trigger.
-- Do not expose an anonymous identifier-enumeration endpoint.
revoke all on function public.registration_identifier_available(text, text) from public, anon, authenticated;
drop function public.registration_identifier_available(text, text);

notify pgrst, 'reload schema';
