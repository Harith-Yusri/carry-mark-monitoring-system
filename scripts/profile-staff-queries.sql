-- Read-only numeric measurements under staff RLS. Temporary objects are rolled back.
-- Run: npx supabase db query --linked --file scripts/profile-staff-queries.sql
begin;
create temporary table perf_samples(label text, iteration int, duration_ms numeric, bytes int, row_count int) on commit drop;
create function pg_temp.measure(label text, query text) returns void language plpgsql as $$
declare started timestamptz; result jsonb; iteration int;
begin
 for iteration in 1..6 loop
  started := clock_timestamp(); execute query into result;
  insert into perf_samples values(label,iteration,extract(epoch from clock_timestamp()-started)*1000,octet_length(result::text),case when jsonb_typeof(result)='array' then jsonb_array_length(result) else null end);
 end loop;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and is_active limit 1),true);
grant select,insert on perf_samples to authenticated;
set local role authenticated;
select pg_temp.measure('admin_overview','select public.get_admin_current_overview()');
select pg_temp.measure('semester_history','select coalesce(jsonb_agg(t), ''[]''::jsonb) from public.get_admin_semester_history() t');
select pg_temp.measure('admin_profile','select to_jsonb(p) from public.profiles p where id=auth.uid()');
select set_config('request.jwt.claim.sub',(select p.id::text from public.profiles p join public.subject_offerings o on o.lecturer_id=p.id join public.class_sections c on c.offering_id=o.id where p.role='lecturer' and p.is_active group by p.id order by count(*) desc limit 1),true);
select pg_temp.measure('lecturer_dashboard','select public.get_my_lecturer_subject_dashboard()');
select pg_temp.measure('lecturer_profile','select to_jsonb(p) from public.profiles p where id=auth.uid()');
select pg_temp.measure('programmes','select coalesce(jsonb_agg(p), ''[]''::jsonb) from (select id,code,name from public.programmes where is_active order by code) p');
do $$ declare offering record; idx int := 0; begin
for offering in select o.id from public.subject_offerings o join public.academic_terms t on t.id=o.term_id where o.lecturer_id=auth.uid() and t.is_current order by o.id loop
 idx := idx+1;
 perform pg_temp.measure('assessments_'||idx,format('select coalesce(jsonb_agg(a), ''[]''::jsonb) from (select id,name,assessment_type,max_score,carry_weight,position from public.assessments where offering_id=%L order by position) a',offering.id));
 perform pg_temp.measure('settings_'||idx,format('select jsonb_build_object(''carry_max'',o.carry_max,''academic_terms'',jsonb_build_object(''eligible_threshold'',t.eligible_threshold)) from public.subject_offerings o join public.academic_terms t on t.id=o.term_id where o.id=%L',offering.id));
 perform pg_temp.measure('classes_'||idx,format('select coalesce(jsonb_agg(s), ''[]''::jsonb) from (select c.id,c.programme_id,c.label,c.day_of_week,c.starts_at,c.ends_at,c.room,c.capacity,c.join_code,jsonb_build_object(''code'',p.code,''name'',p.name) as programmes from public.class_sections c join public.programmes p on p.id=c.programme_id where c.offering_id=%L order by c.label) s',offering.id));
 perform pg_temp.measure('enrolments_'||idx,format('select coalesce(jsonb_agg(e), ''[]''::jsonb) from (select e.id,e.section_id,e.student_id,jsonb_build_object(''matrix_no'',s.matrix_no,''full_name'',s.full_name) as students from public.enrolments e join public.students s on s.id=e.student_id join public.class_sections c on c.id=e.section_id where c.offering_id=%L and e.status=''enrolled'') e',offering.id));
 perform pg_temp.measure('submissions_'||idx,format('select coalesce(jsonb_agg(s), ''[]''::jsonb) from (select s.section_id,s.status from public.submissions s join public.class_sections c on c.id=s.section_id where c.offering_id=%L) s',offering.id));
 perform pg_temp.measure('marks_'||idx,format('select coalesce(jsonb_agg(m), ''[]''::jsonb) from (select m.enrolment_id,m.assessment_id,m.score from public.marks m join public.enrolments e on e.id=m.enrolment_id join public.class_sections c on c.id=e.section_id where c.offering_id=%L and e.status=''enrolled'') m',offering.id));
 perform pg_temp.measure('totals_'||idx,format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from public.get_offering_student_totals(%L) t',offering.id));
end loop; end $$;
do $$ declare chosen record; begin
 select c.id,c.offering_id into chosen from public.class_sections c join public.subject_offerings o on o.id=c.offering_id where o.lecturer_id=auth.uid() and exists(select 1 from public.enrolments e where e.section_id=c.id and e.status='enrolled') limit 1;
 perform pg_temp.measure('selected_class_marks_join',format('select coalesce(jsonb_agg(m), ''[]''::jsonb) from (select m.enrolment_id,m.assessment_id,m.score from public.marks m join public.enrolments e on e.id=m.enrolment_id where e.section_id=%L and e.status=''enrolled'') m',chosen.id));
 perform pg_temp.measure('class_selector_summary',format('select coalesce(jsonb_agg(s), ''[]''::jsonb) from (select c.id,c.offering_id,c.programme_id,c.label,c.day_of_week,c.starts_at,c.ends_at,c.room,c.capacity,c.join_code,jsonb_build_object(''code'',p.code,''name'',p.name) as programmes,(select jsonb_build_array(jsonb_build_object(''count'',count(*))) from public.enrolments e where e.section_id=c.id and e.status=''enrolled'') as enrolments,(select jsonb_agg(jsonb_build_object(''status'',s.status)) from public.submissions s where s.section_id=c.id) as submissions from public.class_sections c join public.programmes p on p.id=c.programme_id where c.offering_id=%L order by c.label) s',chosen.offering_id));
end $$;
select jsonb_agg(s order by s.label,s.iteration) as measurements from perf_samples s;
rollback;
