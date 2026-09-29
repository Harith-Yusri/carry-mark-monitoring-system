update public.profiles
set full_name = 'Dr. Rashidah Rosman',
    updated_at = now()
where lower(full_name) = lower('Dr. Hafizah Hanun');
