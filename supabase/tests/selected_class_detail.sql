-- Entire fixture, releases, corrections and pg_net queue work roll back.
begin;
do $$
declare
 lect uuid:=gen_random_uuid(); other_lect uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
 auth_student uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); programme uuid:=gen_random_uuid();
 term uuid; offering uuid; section uuid; second_section uuid; empty_section uuid; second_device uuid; enrol uuid; other_enrol uuid; assessment uuid;
 tag text:='PERF'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)); payload jsonb; total numeric; device uuid; before_ctid text; token text:='ExpoPushToken['||replace(gen_random_uuid()::text,'-','')||']';
begin
 insert into auth.users(id) values(lect),(other_lect),(admin_id),(auth_student);
 insert into public.profiles(id,staff_no,full_name,role) values(lect,tag,'Perf Lecturer','lecturer'),(other_lect,tag||'O','Other','lecturer'),(admin_id,tag||'A','Admin','admin');
 insert into public.programmes(code,name) values(tag,'Perf Programme') returning id into programme;
 select id into term from public.academic_terms where is_current and status='active';
 if term is null then raise exception 'Requires an existing active term'; end if;
 perform set_config('request.jwt.claim.sub',lect::text,true);
 offering:=public.create_lecturer_subject(tag,'Perf Subject',5);
 perform public.set_offering_carry_max(offering,50);
 insert into public.class_sections(offering_id,programme_id,label,capacity) values(offering,programme,'Perf A',10) returning id into section;
 insert into public.class_sections(offering_id,programme_id,label,capacity) values(offering,programme,'Perf B',10) returning id into second_section;
 insert into public.class_sections(offering_id,programme_id,label,capacity) values(offering,programme,'Perf Empty',10) returning id into empty_section;
 insert into public.students(matrix_no,full_name,programme_id,auth_user_id) values(tag,'Perf Student',programme,auth_student) returning id into student;
 insert into public.enrolments(section_id,student_id) values(section,student) returning id into enrol;
 insert into public.enrolments(section_id,student_id) values(second_section,student) returning id into other_enrol;
 insert into public.assessments(offering_id,name,assessment_type,max_score,carry_weight,position) values(offering,'Perf Quiz','Quiz',100,50,1) returning id into assessment;
 insert into public.marks(enrolment_id,assessment_id,score,entered_by) values(enrol,assessment,80,lect),(other_enrol,assessment,20,lect);
 -- Real authenticated table RLS, not a privileged/bypass-only call.
 execute 'set local role authenticated';
 payload:=public.get_staff_class_detail(section);
 select total_carry into total from public.get_offering_student_totals(offering) where enrolment_id=enrol;
 if jsonb_array_length(payload#>'{data,sections}')<>1 or jsonb_array_length(payload#>'{data,sections,0,students}')<>1 then raise exception 'Incorrect class scope'; end if;
 if (payload#>>'{data,sections,0,students,0,totalCarry}')::numeric<>total then raise exception 'Total changed'; end if;
 if payload#>>'{data,sections,0,students,0,scores}' is null or (payload#>>array['data','sections','0','students','0','scores',assessment::text])::numeric<>80 then raise exception 'Mark identity lost'; end if;
 if payload#>>'{data,sections,0,students,0,enrolmentId}'<>enrol::text then raise exception 'Other class leaked'; end if;
 if (payload#>>'{data,sections,0,finalised}')::boolean then raise exception 'Draft status changed'; end if;
 -- Empty roster is successful, with original assessment structure.
 payload:=public.get_staff_class_detail(empty_section);
 if jsonb_array_length(payload#>'{data,sections,0,students}')<>0 or jsonb_array_length(payload#>'{data,assessments}')<>1 then raise exception 'Empty class structure lost'; end if;
 perform set_config('request.jwt.claim.sub',other_lect::text,true);
 begin perform public.get_staff_class_detail(section); raise exception 'Other lecturer read succeeded'; exception when raise_exception then if sqlerrm='Other lecturer read succeeded' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',auth_student::text,true);
 begin perform public.get_staff_class_detail(section); raise exception 'Student read succeeded'; exception when raise_exception then if sqlerrm='Student read succeeded' then raise; end if; end;
 -- Repeated token writes are no-ops, while token rotation/account/device paths stay active.
 device:=public.register_my_push_device('perf-installation-'||tag,token,'android');
 select ctid::text into before_ctid from public.student_push_devices where id=device;
 if public.register_my_push_device('perf-installation-'||tag,token,'android')<>device then raise exception 'Duplicate registration changed identity'; end if;
 if exists(select 1 from public.student_push_devices where id=device and ctid::text<>before_ctid) then raise exception 'Unchanged registration rewrote row'; end if;
 perform public.unregister_my_push_device('perf-installation-'||tag);
 perform public.register_my_push_device('perf-installation-'||tag,token,'android');
 if not exists(select 1 from public.student_push_devices where id=device and active) then raise exception 'Reactivation failed'; end if;
 second_device:=public.register_my_push_device('perf-installation-2-'||tag,'ExpoPushToken['||replace(gen_random_uuid()::text,'-','')||']','android');
 if second_device=device then raise exception 'Multiple devices collapsed'; end if;
 perform public.register_my_push_device('perf-installation-'||tag,'ExpoPushToken['||replace(gen_random_uuid()::text,'-','')||']','android');
 if not exists(select 1 from public.student_push_devices where id=device and expo_push_token<>token) then raise exception 'Token rotation failed'; end if;
 perform set_config('request.jwt.claim.sub',lect::text,true);
 perform public.finalise_section(section);
 payload:=public.get_staff_class_detail(section);
 if not (payload#>>'{data,sections,0,finalised}')::boolean then raise exception 'Release state missing'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 payload:=public.get_staff_class_detail(section);
 if (payload#>>'{data,sections,0,students,0,totalCarry}')::numeric<>40 then raise exception 'Admin total mismatch'; end if;
 execute 'reset role';
end $$;
rollback;
