-- Delivery addresses are independent of generated login aliases.
alter table public.profiles add column reminder_email text;
alter table public.profiles add constraint profiles_reminder_email_valid
  check (reminder_email is null or (
    length(reminder_email) <= 254
    and reminder_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ));
