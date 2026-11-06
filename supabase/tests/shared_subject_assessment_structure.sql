-- Run after 202611060002. All fixtures and real-data reads roll back.
begin;
do $$
declare
  lecturer uuid; other_lecturer uuid; term uuid; pa uuid; pb uuid;
  subject uuid; a uuid; b uuid; c uuid; ca uuid; ca2 uuid; cb uuid; cc uuid;
  student_a uuid; student_b uuid; ea uuid; eb uuid; aa uuid; ab uuid; aid uuid;
  other_offering uuid; real_hub record; payload jsonb; before_marks jsonb;
  fixture_code text := 'STRUCT' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
  select id into lecturer from public.profiles where role='lecturer' and is_active limit 1;
  select id into other_lecturer from public.profiles where role='lecturer' and is_active and id<>lecturer limit 1;
  select id into term from public.academic_terms where is_current and status='active';
  select id into pa from public.programmes where is_active order by code limit 1;
  select id into pb from public.programmes where is_active and id<>pa order by code limit 1;
  if lecturer is null or other_lecturer is null or term is null or pa is null or pb is null then raise exception 'Missing fixture prerequisites'; end if;
  if has_function_privilege('anon','public.get_my_subject_assessment_structure(uuid)','execute')
    or has_function_privilege('anon','public.mutate_my_subject_assessment_structure(uuid,text,uuid,text,text,numeric,numeric,numeric)','execute')
    or has_function_privilege('authenticated','public.subject_assessment_hub_members(uuid,boolean)','execute') then
    raise exception 'Unexpected public/internal function privilege';
  end if;
  -- Verify real ITT550, single-class ISP420, and mixed-programme ITT557 loaders
  -- without modifying a single production assessment, mark or release record.
  for real_hub in select o.id,o.lecturer_id from public.subject_offerings o join public.subjects s on s.id=o.subject_id
    join public.profiles p on p.id=o.lecturer_id where s.code in ('ITT550','ISP420','ITT557') and p.is_active
  loop
    perform set_config('request.jwt.claim.sub',real_hub.lecturer_id::text,true);
    payload := public.get_my_subject_assessment_structure(real_hub.id);
    if jsonb_array_length(payload->'assessments')<>(select count(*) from public.assessments where offering_id=real_hub.id) then
      raise exception 'Real subject structure was not returned correctly';
    end if;
  end loop;
  perform set_config('request.jwt.claim.sub',lecturer::text,true);
  insert into public.subjects(code,name) values(fixture_code,'Shared structure test') returning id into subject;
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_id,programme_semester,status)
    values(subject,term,lecturer,pa,5,'active') returning id into a;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(a,pa,'A',20,fixture_code||'A') returning id into ca;
  -- Single offering / single class: the same RPC supports the normal case.
  perform public.mutate_my_subject_assessment_structure(a,'weightage',total_weight=>70);
  perform public.mutate_my_subject_assessment_structure(a,'create',component_name=>'Quiz',component_type=>'Quiz',maximum_score=>100,component_weight=>10);
  payload := public.get_my_subject_assessment_structure(a);
  if jsonb_array_length(payload->'assessments')<>1 then raise exception 'Single-class creation failed'; end if;
  -- Same-programme and cross-programme classes inside the canonical offering.
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(a,pa,'A2',20,fixture_code||'A2') returning id into ca2;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(a,pb,'Mixed',20,fixture_code||'M') returning id into cc;
  -- Legacy second offering: retain its independent assessment IDs.
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_id,programme_semester,status,carry_max)
    values(subject,term,lecturer,pb,5,'active',70) returning id into b;
  insert into public.class_sections(offering_id,programme_id,label,capacity,join_code)
    values(b,pb,'B',20,fixture_code||'B') returning id into cb;
  insert into public.assessments(offering_id,name,assessment_type,max_score,carry_weight,position)
    values(b,'Quiz','Quiz',100,10,1) returning id into ab;
  select id into aa from public.assessments where offering_id=a and position=1;
  insert into public.students(matrix_no,full_name,programme_id) values(fixture_code||'1','Fixture A',pa) returning id into student_a;
  insert into public.students(matrix_no,full_name,programme_id) values(fixture_code||'2','Fixture B',pb) returning id into student_b;
  insert into public.enrolments(section_id,student_id) values(ca,student_a) returning id into ea;
  insert into public.enrolments(section_id,student_id) values(cb,student_b) returning id into eb;
  -- Exercise actual marks table constraints/triggers with different class scores.
  insert into public.marks(enrolment_id,assessment_id,score,entered_by) values(ea,aa,81,lecturer),(eb,ab,43,lecturer);
  select jsonb_agg(to_jsonb(m) order by m.id) into before_marks from public.marks m where m.enrolment_id in(ea,eb);
  perform public.mutate_my_subject_assessment_structure(b,'edit',ab,'Quiz One','Practical',100,15);
  if (select count(*) from public.assessments where offering_id in(a,b) and name='Quiz One' and assessment_type='Practical' and carry_weight=15)<>2 then
    raise exception 'Edit was not shared across the Hub';
  end if;
  if not exists(select 1 from public.assessments where id=aa) or not exists(select 1 from public.assessments where id=ab)
    or before_marks is distinct from (select jsonb_agg(to_jsonb(m) order by m.id) from public.marks m where m.enrolment_id in(ea,eb)) then
    raise exception 'Shared edit changed assessment IDs or class/student mark records';
  end if;
  perform public.mutate_my_subject_assessment_structure(a,'create',component_name=>'Project',component_type=>'Project',maximum_score=>100,component_weight=>20);
  if (select count(*) from public.assessments where offering_id in(a,b) and name='Project')<>2 then raise exception 'Shared creation failed'; end if;
  select id into aid from public.assessments where offering_id=a and name='Project';
  perform public.mutate_my_subject_assessment_structure(a,'delete',aid);
  if exists(select 1 from public.assessments where offering_id in(a,b) and name='Project') then raise exception 'Shared delete failed'; end if;
  begin
    perform public.mutate_my_subject_assessment_structure(a,'delete',aa);
    raise exception 'Marked assessment deletion was allowed';
  exception when others then if sqlerrm<>'This shared component has student marks and cannot be removed.' then raise; end if; end;
  begin
    perform public.mutate_my_subject_assessment_structure(a,'edit',aa,'Quiz One','Practical',40,15);
    raise exception 'Score-invalidating edit was allowed';
  exception when others then if sqlerrm<>'Maximum score cannot be lower than existing student marks.' then raise; end if; end;
  begin
    perform public.mutate_my_subject_assessment_structure(a,'create',component_name=>'Too much',component_type=>'Test',maximum_score=>100,component_weight=>90);
    raise exception 'Weightage overflow was allowed';
  exception when others then if sqlerrm not like 'Assessment weightage exceeds%' then raise; end if; end;
  if exists(select 1 from public.assessments where offering_id in(a,b) and name='Too much') then raise exception 'Failed mutation partially saved'; end if;
  perform public.mutate_my_subject_assessment_structure(b,'weightage',total_weight=>60);
  if (select count(*) from public.subject_offerings where id in(a,b) and carry_max=60)<>2 then raise exception 'Shared weightage failed'; end if;
  -- Conflicting legacy structures must be reported, never overwritten.
  update public.assessments set name='Conflicting legacy name' where id=ab;
  begin
    perform public.mutate_my_subject_assessment_structure(a,'edit',aa,'Unsafe overwrite','Quiz',100,15);
    raise exception 'Conflicting structure was overwritten';
  exception when others then if sqlerrm not like 'Existing assessment structures differ%' then raise; end if; end;
  update public.assessments set name='Quiz One' where id=ab;
  insert into public.submissions(section_id,status,finalised_by,finalised_at) values(cb,'finalised',lecturer,now());
  begin
    perform public.mutate_my_subject_assessment_structure(a,'edit',aa,'Unsafe released edit','Quiz',100,15);
    raise exception 'Released sibling was editable';
  exception when others then if sqlerrm<>'Reopen the released classes before changing the shared assessment structure.' then raise; end if; end;
  -- Structure remains readable when any class is released.
  perform public.get_my_subject_assessment_structure(a);
  update public.submissions set status='draft',finalised_by=null,finalised_at=null where section_id=cb;
  -- Archive check and all simulated term changes are rolled back immediately.
  begin
    update public.academic_terms set is_current=false,status='closed' where id=term;
    begin
      perform public.mutate_my_subject_assessment_structure(a,'weightage',total_weight=>65);
      raise exception 'Archived structure was editable';
    exception when others then if sqlerrm<>'Archived academic semester data is read-only.' then raise; end if; end;
    perform public.get_my_subject_assessment_structure(a);
    raise sqlstate 'Z0001';
  exception when sqlstate 'Z0001' then null; end;
  perform set_config('request.jwt.claim.sub',other_lecturer::text,true);
  begin
    perform public.get_my_subject_assessment_structure(a);
    raise exception 'Other lecturer could read the Hub';
  exception when others then if sqlerrm<>'Subject not found or not owned by your lecturer account.' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',lecturer::text,true);
  -- Same subject, another programme semester remains a separate structure.
  insert into public.subject_offerings(subject_id,term_id,lecturer_id,programme_id,programme_semester,status)
    values(subject,term,lecturer,pa,8,'active') returning id into c;
  perform public.mutate_my_subject_assessment_structure(c,'weightage',total_weight=>50);
  perform public.mutate_my_subject_assessment_structure(c,'create',component_name=>'Separate semester',component_type=>'Test',maximum_score=>100,component_weight=>50);
  if (select count(*) from public.assessments where offering_id in(a,b))<>2 then raise exception 'Different semester changed the Hub'; end if;
  perform set_config('cams.test.hub',a::text,true);
end;
$$;
-- Exercise the public RPC through the real authenticated role, including the
-- private helper's execute boundary, not just as the privileged test runner.
set local role authenticated;
select jsonb_array_length(public.get_my_subject_assessment_structure(current_setting('cams.test.hub')::uuid)->'assessments') as authenticated_component_count;
rollback;
