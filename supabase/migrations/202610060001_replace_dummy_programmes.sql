-- Keep the programme catalogue in Supabase as the single source of truth used by
-- forms, filters, reports, deadlines, profiles, subjects and students.
do $$
declare
  programme_mapping record;
  source_id uuid;
  destination_id uuid;
begin
  for programme_mapping in
    select *
    from (values
      ('IT', 'CS240', 'Bachelor Of Information Technology (Hons.)'),
      ('CS', 'CS251', 'Bachelor Of Computer Science (Hons.) Netcentric Computing'),
      ('IS', 'CS255', 'Bachelor Of Computer Science (Hons.) Computer Networks')
    ) as mapping(old_code, new_code, new_name)
  loop
    select id into source_id
    from public.programmes
    where code = programme_mapping.old_code;

    select id into destination_id
    from public.programmes
    where code = programme_mapping.new_code;

    if source_id is not null and destination_id is null then
      update public.programmes
      set code = programme_mapping.new_code,
          name = programme_mapping.new_name,
          is_active = true
      where id = source_id;
    elsif source_id is not null and destination_id is not null and source_id <> destination_id then
      -- Preserve a deadline already configured for the real programme. Otherwise,
      -- carry over the deadline from the dummy programme before removing it.
      insert into public.programme_deadlines (term_id, programme_id, deadline_at)
      select term_id, destination_id, deadline_at
      from public.programme_deadlines
      where programme_id = source_id
      on conflict (term_id, programme_id) do nothing;

      delete from public.programme_deadlines where programme_id = source_id;
      update public.profiles set programme_id = destination_id where programme_id = source_id;
      update public.subjects set programme_id = destination_id where programme_id = source_id;
      update public.students set programme_id = destination_id where programme_id = source_id;
      delete from public.programmes where id = source_id;
    end if;

    insert into public.programmes (code, name, is_active)
    values (programme_mapping.new_code, programme_mapping.new_name, true)
    on conflict (code) do update
      set name = excluded.name,
          is_active = true;
  end loop;

  insert into public.programmes (code, name, is_active)
  values ('CS248', 'Bachelor Of Science (Hons.) Management Mathematics', true)
  on conflict (code) do update
    set name = excluded.name,
        is_active = true;
end
$$;
