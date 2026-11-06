-- Legacy programme-specific offerings remain intact so assessment IDs, marks,
-- enrolments and release states never need remapping. Treat their identical
-- component definitions as one logical Subject Hub structure, mutated atomically.
create function public.subject_assessment_hub_members(target_offering uuid, for_mutation boolean)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  anchor public.subject_offerings%rowtype;
  members uuid[];
  definitions jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='lecturer' and is_active) then
    raise exception 'An active lecturer account is required.';
  end if;
  select * into anchor from public.subject_offerings where id=target_offering and lecturer_id=auth.uid();
  if not found then raise exception 'Subject not found or not owned by your lecturer account.'; end if;
  if for_mutation then
    perform 1 from public.academic_terms where id=anchor.term_id and is_current and status='active' for share;
    if not found then raise exception 'Archived academic semester data is read-only.'; end if;
  end if;
  select array_agg(o.id order by o.id) into members from (
    select id from public.subject_offerings where lecturer_id=auth.uid() and subject_id=anchor.subject_id
      and term_id=anchor.term_id and programme_semester=anchor.programme_semester
    order by id for update
  ) o;
  if members is null or not(target_offering=any(members)) then raise exception 'Subject changed. Refresh and try again.'; end if;
  if for_mutation and exists(select 1 from public.class_sections c join public.submissions s on s.section_id=c.id
    where c.offering_id=any(members) and s.status='finalised') then
    raise exception 'Reopen the released classes before changing the shared assessment structure.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_array(a.position,a.name,a.assessment_type,a.max_score,a.carry_weight) order by a.position),'[]')
    into definitions from public.assessments a where a.offering_id=target_offering;
  if exists(select 1 from public.subject_offerings o where o.id=any(members) and (
    o.carry_max is distinct from anchor.carry_max or
    (select coalesce(jsonb_agg(jsonb_build_array(a.position,a.name,a.assessment_type,a.max_score,a.carry_weight) order by a.position),'[]')
      from public.assessments a where a.offering_id=o.id) <> definitions
  )) then
    -- Never choose a programme's conflicting structure or overwrite marked data.
    raise exception 'Existing assessment structures differ within this subject. Contact an administrator to reconcile them safely before editing.';
  end if;
  return members;
end;
$$;

create function public.get_my_subject_assessment_structure(target_offering uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare members uuid[]; result jsonb;
begin
  members := public.subject_assessment_hub_members(target_offering,false);
  select jsonb_build_object('carryMax',o.carry_max,'assessments',coalesce((
    select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'type',a.assessment_type,
      'maxMarks',a.max_score,'weightage',a.carry_weight,'position',a.position) order by a.position)
    from public.assessments a where a.offering_id=o.id),'[]')) into result
  from public.subject_offerings o where o.id=target_offering;
  return result;
end;
$$;

create function public.mutate_my_subject_assessment_structure(
  target_offering uuid, operation text, target_assessment uuid default null,
  component_name text default null, component_type text default null,
  maximum_score numeric default null, component_weight numeric default null,
  total_weight numeric default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  members uuid[];
  member uuid;
  component_position smallint;
begin
  members := public.subject_assessment_hub_members(target_offering,true);
  if operation not in ('create','edit','delete','weightage') or operation is null then
    raise exception 'Invalid assessment operation.';
  end if;
  if operation='weightage' then
    foreach member in array members loop
      perform public.set_offering_carry_max(member,total_weight);
    end loop;
    return;
  end if;
  if operation in ('edit','delete') then
    select position into component_position from public.assessments where id=target_assessment and offering_id=target_offering;
    if not found then raise exception 'Assessment not found in this subject. Refresh and try again.'; end if;
  else
    select coalesce(max(position),0)+1 into component_position from public.assessments where offering_id=target_offering;
  end if;
  if operation in ('create','edit') and (
    component_name is null or length(trim(component_name))=0 or component_type is null or length(trim(component_type))=0
    or maximum_score is null or maximum_score<=0 or component_weight is null or component_weight<=0
  ) then raise exception 'Enter a component name, type, positive maximum score and weightage.'; end if;
  if operation='edit' and exists(select 1 from public.marks m join public.assessments a on a.id=m.assessment_id
    where a.offering_id=any(members) and a.position=component_position and m.score>maximum_score) then
    raise exception 'Maximum score cannot be lower than existing student marks.';
  end if;
  if operation='delete' and exists(select 1 from public.marks m join public.assessments a on a.id=m.assessment_id
    where a.offering_id=any(members) and a.position=component_position) then
    raise exception 'This shared component has student marks and cannot be removed.';
  end if;
  foreach member in array members loop
    if operation='create' then
      insert into public.assessments(offering_id,name,assessment_type,max_score,carry_weight,position)
      values(member,trim(component_name),trim(component_type),maximum_score,component_weight,component_position);
    elsif operation='edit' then
      update public.assessments set name=trim(component_name),assessment_type=trim(component_type),
        max_score=maximum_score,carry_weight=component_weight where offering_id=member and position=component_position;
    else
      delete from public.assessments where offering_id=member and position=component_position;
    end if;
  end loop;
end;
$$;

revoke all on function public.subject_assessment_hub_members(uuid,boolean) from public,anon,authenticated;
revoke all on function public.get_my_subject_assessment_structure(uuid) from public,anon;
revoke all on function public.mutate_my_subject_assessment_structure(uuid,text,uuid,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.get_my_subject_assessment_structure(uuid) to authenticated;
grant execute on function public.mutate_my_subject_assessment_structure(uuid,text,uuid,text,text,numeric,numeric,numeric) to authenticated;
notify pgrst,'reload schema';
