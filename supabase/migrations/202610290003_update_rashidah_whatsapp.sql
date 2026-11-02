-- Store the normalized WhatsApp contact in the existing private lecturer
-- contact relationship. The mobile app continues to resolve it through the
-- student's actual class/offering assignment.
insert into public.lecturer_contacts (lecturer_id, whatsapp_phone, updated_at)
select lecturer.id, '60104595958', now()
from public.profiles lecturer
where lecturer.role = 'lecturer'
  and lower(lecturer.full_name) = lower('Dr. Rashidah Rosman')
on conflict (lecturer_id) do update
set whatsapp_phone = excluded.whatsapp_phone,
    updated_at = excluded.updated_at;

do $$
begin
  if not exists (
    select 1
    from public.lecturer_contacts contact
    join public.profiles lecturer on lecturer.id = contact.lecturer_id
    where lecturer.role = 'lecturer'
      and lower(lecturer.full_name) = lower('Dr. Rashidah Rosman')
      and contact.whatsapp_phone = '60104595958'
  ) then
    raise exception 'Dr. Rashidah Rosman lecturer contact was not found';
  end if;
end;
$$;
