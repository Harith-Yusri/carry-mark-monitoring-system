begin;

create function pg_temp.assert_card_status(target_ids uuid[], expected text)
returns void language plpgsql as $$
begin
  if (select count(*) from public.get_my_lecturer_subjects() r where r.offering_id = any(target_ids)) <> cardinality(target_ids)
     or exists(select 1 from public.get_my_lecturer_subjects() r where r.offering_id = any(target_ids) and r.offering_status <> expected) then
    raise exception 'Subject status did not match % for all context rows', expected;
  end if;
end;
$$;

do $$
declare
  lecturer uuid;
  term_id uuid;
  programme uuid;
  subject_id uuid;
  offering_a uuid;
  offering_b uuid;
  empty_offering uuid;
  class_a uuid;
  class_b uuid;
  class_c uuid;
  fixture_code text := 'STATUSTEST' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
begin
  select p.id into lecturer from public.profiles p where p.role='lecturer' and p.is_active limit 1;
  select t.id into term_id from public.academic_terms t where t.is_current and t.status='active';
  select p.id into programme from public.programmes p where p.is_active limit 1;
  if lecturer is null or term_id is null or programme is null then raise exception 'Missing test prerequisites'; end if;
  perform set_config('request.jwt.claim.sub',lecturer::text,true);
  insert into public.subjects(code,name) values(fixture_code,'Status regression fixture') returning id into subject_id;
  -- Deliberately stale stored statuses must never decide the card badge.
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_semester,status)
    values(subject_id,term_id,lecturer,5,'completed') returning id into offering_a;
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_semester,status)
    values(subject_id,term_id,lecturer,5,'completed') returning id into offering_b;
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_semester,status)
    values(subject_id,term_id,lecturer,6,'completed') returning id into empty_offering;
  perform pg_temp.assert_card_status(array[offering_a,offering_b,empty_offering],'active');
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(offering_a,programme,'Class A',10,'A'||fixture_code) returning id into class_a;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(offering_a,programme,'Class B',10,'B'||fixture_code) returning id into class_b;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(offering_b,programme,'Class C',10,'C'||fixture_code) returning id into class_c;
  perform pg_temp.assert_card_status(array[offering_a,offering_b],'active');
  insert into public.submissions(section_id,status,finalised_by,finalised_at)
    values(class_a,'finalised',lecturer,now())
    on conflict(section_id) do update set status='finalised',finalised_by=excluded.finalised_by,finalised_at=excluded.finalised_at;
  perform pg_temp.assert_card_status(array[offering_a,offering_b],'active');
  insert into public.submissions(section_id,status,finalised_by,finalised_at)
    values(class_b,'finalised',lecturer,now())
    on conflict(section_id) do update set status='finalised',finalised_by=excluded.finalised_by,finalised_at=excluded.finalised_at;
  -- First offering is complete, but the other programme's class is still pending.
  perform pg_temp.assert_card_status(array[offering_a,offering_b],'active');
  insert into public.submissions(section_id,status,finalised_by,finalised_at)
    values(class_c,'finalised',lecturer,now())
    on conflict(section_id) do update set status='finalised',finalised_by=excluded.finalised_by,finalised_at=excluded.finalised_at;
  perform pg_temp.assert_card_status(array[offering_a,offering_b],'completed');
  perform pg_temp.assert_card_status(array[empty_offering],'active');
end;
$$;

rollback;
