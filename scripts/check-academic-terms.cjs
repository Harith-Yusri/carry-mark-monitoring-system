// Disposable PostgreSQL/WASM only; no production credentials or academic writes.
const {PGlite}=require(process.env.CAMS_PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs');
(async()=>{const db=new PGlite();try{await db.exec(`
 create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create type public.term_status as enum('draft','active','closed');
 create table public.profiles(id uuid primary key,role text,is_active boolean);
 create table public.academic_terms(id uuid primary key default gen_random_uuid(),academic_year text not null,semester_code text unique not null,semester_no smallint,starts_on date,ends_on date,default_deadline timestamptz,carry_max numeric,eligible_threshold numeric,status public.term_status,is_current boolean,unique(academic_year,semester_no),check(right(semester_code,1)=semester_no::text));
 create table public.audit_logs(actor_id uuid,action text,entity_type text,entity_id uuid,new_data jsonb);
 create table public.students(id uuid default gen_random_uuid(),auth_user_id uuid,current_semester smallint,is_active boolean,notification_alerts_enabled boolean);
 create table public.subject_offerings(id uuid primary key,lecturer_id uuid,subject_id uuid,term_id uuid,programme_semester smallint);
 create table public.mark_disputes(id uuid primary key,offering_id uuid);
 create table public.notifications(id uuid primary key,recipient_id uuid,type text,related_entity_id uuid,read_at timestamptz,created_at timestamptz,title text,body text,data jsonb);
 create function public.is_admin() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active)$$;
 create function public.owns_offering(target uuid) returns boolean language sql stable as $$select exists(select 1 from public.subject_offerings where id=target and lecturer_id=auth.uid())$$;
 create function public.get_my_lecturer_subjects() returns table(offering_id uuid,academic_year text,semester_no smallint) language sql stable as $$select o.id,t.academic_year,t.semester_no from public.subject_offerings o join public.academic_terms t on t.id=o.term_id where o.lecturer_id=auth.uid() and t.is_current$$;
 create function public.get_my_archived_lecturer_subjects() returns table(offering_id uuid,academic_year text,semester_no smallint) language sql stable as $$select o.id,t.academic_year,t.semester_no from public.subject_offerings o join public.academic_terms t on t.id=o.term_id where o.lecturer_id=auth.uid() and not t.is_current$$;
 create function public.get_my_mobile_portal_payload() returns jsonb language sql stable as $$select '{"student":{"name":"Fixture Student","semester":"Semester 2"},"subjects":[{"score":41.5,"eligible":true}],"notifications":[{"id":"fixture"}]}'::jsonb$$;
 insert into public.academic_terms values('00000000-0000-4000-8000-000000000001','2025/2026','20261',1,'2026-01-01','2026-12-31','2026-12-01',50,40,'closed',false);
 `);
 await db.exec(fs.readFileSync('supabase/migrations/202611200001_academic_term_codes.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/tests/academic_term_codes.sql','utf8'));
 console.log('Passed real SQL regular code validation, direct-write guard, year/date checks, legacy preservation/edit/activation, actual-code dashboard/notification routing and independent Student programme-stage payload.');
 }finally{await db.close()}})().catch(error=>{console.error(error.message);process.exitCode=1});
