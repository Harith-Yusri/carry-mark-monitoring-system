-- Reuse staff recipients/read_at and the existing notifications payload. A report
-- INSERT is the event: retries returning the same dispute cannot notify twice.
create unique index notifications_mark_issue_once_idx on public.notifications(related_entity_id)
  where type='mark_issue_submitted';
create index notifications_lecturer_issue_inbox_idx on public.notifications(recipient_id,created_at desc,id desc)
  include(read_at) where type='mark_issue_submitted';

create function public.notify_lecturer_mark_issue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(recipient_id,type,title,body,related_entity_id,data,delivery_status,created_at)
    select o.lecturer_id,'mark_issue_submitted','New student mark issue',
      s.full_name||' · '||su.code||' · '||coalesce(c.label,'Class unavailable')||' · '||coalesce(a.name,new.assessment_name),
      new.id,jsonb_build_object('issueId',new.id,'offeringId',o.id,'sectionId',new.section_id,'assessmentId',new.assessment_id,
        'studentName',s.full_name,'subjectCode',su.code,'classLabel',coalesce(c.label,'Class unavailable'),
        'assessmentName',coalesce(a.name,new.assessment_name),'submittedAt',new.created_at),
      'skipped',new.created_at
    from public.subject_offerings o join public.subjects su on su.id=o.subject_id
    join public.students s on s.id=new.student_id
    left join public.class_sections c on c.id=new.section_id and c.offering_id=o.id
    left join public.assessments a on a.id=new.assessment_id and a.offering_id=o.id
    where o.id=new.offering_id
    on conflict (related_entity_id) where type='mark_issue_submitted' do nothing;
  return new;
end;
$$;
revoke all on function public.notify_lecturer_mark_issue() from public,anon,authenticated;
create trigger mark_issue_lecturer_notification after insert on public.mark_disputes
  for each row execute function public.notify_lecturer_mark_issue();

-- Keep legacy/student notification visibility, while new issue alerts are only
-- readable by their active lecturer recipient, including over Realtime.
drop policy notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (
  (type='mark_issue_submitted' and recipient_id=(select auth.uid()) and exists(
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='lecturer' and p.is_active))
  or (type<>'mark_issue_submitted' and (recipient_id=(select auth.uid()) or public.is_admin() or exists(
    select 1 from public.students s where s.id=notifications.student_id and s.auth_user_id=(select auth.uid()) and s.is_active)))
);

create function public.get_my_lecturer_notifications(before_created_at timestamptz default null,before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='lecturer' and p.is_active) then
    raise exception 'CAMS: An active lecturer account is required.';
  end if;
  if (before_created_at is null)<>(before_id is null) then raise exception 'CAMS: Refresh notifications before loading more.'; end if;
  with page as (
    select n.id,n.title,n.body,n.data,n.created_at,n.read_at from public.notifications n
    where n.recipient_id=auth.uid() and n.type='mark_issue_submitted'
      and (before_created_at is null or (n.created_at,n.id)<(before_created_at,before_id))
    order by n.created_at desc,n.id desc limit 21
  ), visible as (select * from page order by created_at desc,id desc limit 20)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id desc) from visible v),'[]'),
    'has_more',(select count(*)>20 from page),
    'unread_count',(select count(*) from public.notifications n where n.recipient_id=auth.uid() and n.type='mark_issue_submitted' and n.read_at is null)) into result;
  return result;
end;
$$;

create function public.open_my_mark_issue_notification(target_notification uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.notifications; d public.mark_disputes; anchor public.subject_offerings; rows jsonb;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='lecturer' and p.is_active) then
    raise exception 'CAMS: An active lecturer account is required.';
  end if;
  select * into n from public.notifications where id=target_notification and recipient_id=auth.uid() and type='mark_issue_submitted' for update;
  if not found then raise exception 'CAMS: This notification is not available to your account.'; end if;
  -- Route using live academic references, never a URL/recipient supplied by the student.
  select * into d from public.mark_disputes where id=n.related_entity_id;
  if not found or not public.owns_offering(d.offering_id) then raise exception 'CAMS: This subject is no longer assigned to your account.'; end if;
  select * into anchor from public.subject_offerings where id=d.offering_id;
  -- Reuse the dashboard's metadata/Hub grouping rules for current AND archived
  -- issues, retaining every original offering/assessment ID in a legacy Hub.
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into rows from (
    select * from public.get_my_lecturer_subjects()
    union all select * from public.get_my_archived_lecturer_subjects()
  ) s where s.offering_id in (select o.id from public.subject_offerings o where o.lecturer_id=auth.uid()
    and o.subject_id=anchor.subject_id and o.term_id=anchor.term_id and o.programme_semester=anchor.programme_semester);
  if jsonb_array_length(rows)=0 then raise exception 'CAMS: This subject is unavailable. Refresh notifications and try again.'; end if;
  update public.notifications set read_at=coalesce(read_at,now()) where id=n.id returning * into n;
  return jsonb_build_object('notification_id',n.id,'read_at',n.read_at,'issue_id',d.id,'subject_rows',rows,
    'unread_count',(select count(*) from public.notifications where recipient_id=auth.uid() and type='mark_issue_submitted' and read_at is null));
end;
$$;
revoke all on function public.get_my_lecturer_notifications(timestamptz,uuid),public.open_my_mark_issue_notification(uuid) from public,anon;
grant execute on function public.get_my_lecturer_notifications(timestamptz,uuid),public.open_my_mark_issue_notification(uuid) to authenticated;
-- No general read_at UPDATE grant. Only the checked open RPC acknowledges alerts.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
notify pgrst,'reload schema';
