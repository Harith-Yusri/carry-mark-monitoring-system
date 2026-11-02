begin;
do $$
declare
  lecturer uuid;
  active_term uuid;
  programme_a uuid;
  programme_b uuid;
  subject_id uuid;
  offering uuid;
  class_a uuid;
  class_b uuid;
  code text := 'HUBTEST' || upper(substr(replace(gen_random_uuid()::text, '-', ''),1,12));
begin
  select id into lecturer from public.profiles where role='lecturer' and is_active limit 1;
  select id into active_term from public.academic_terms where is_current and status='active';
  select p.id into programme_a from public.programmes p where p.is_active order by p.code limit 1;
  select p.id into programme_b from public.programmes p where p.is_active and p.id<>programme_a order by p.code limit 1;
  if lecturer is null or active_term is null or programme_b is null then raise exception 'Missing test prerequisites'; end if;
  perform set_config('request.jwt.claim.sub', lecturer::text, true);
  insert into public.subjects(code,name) values(code,'Subject Hub regression fixture') returning id into subject_id;
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_semester,status)
    values(subject_id,active_term,lecturer,5,'active') returning id into offering;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(offering,programme_a,'Class A',10,'HUBA'||substr(code,8)) returning id into class_a;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(offering,programme_b,'Class B',20,'HUBB'||substr(code,8)) returning id into class_b;
  if not exists(select 1 from public.get_my_lecturer_subjects() r where r.offering_id=offering
    and r.programme_ids @> array[programme_a,programme_b]) then
    raise exception 'Class programmes missing from subject RPC';
  end if;
  perform public.update_lecturer_subject(offering,'Edited subject',5,programme_a);
  if not exists(select 1 from public.class_sections where id=class_b and programme_id=programme_b and capacity=20) then
    raise exception 'Subject edit rewrote class programme/data';
  end if;
end;
$$;
rollback;
