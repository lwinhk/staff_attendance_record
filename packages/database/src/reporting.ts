import type { Pool, PoolClient, QueryResultRow } from "pg";

export interface ReportFilters { tenantId:string; from:string; to:string; siteId?:string|null; employeeId?:string|null }
export interface Pagination { limit:number; offset:number }

const detailCte=`with expected as (
  select distinct a.employee_id,a.site_id,d.day::date as attendance_date
    from employee_site_assignments a
    cross join lateral generate_series(greatest(a.effective_from,$2::date),least(coalesce(a.effective_to,$3::date),$3::date),interval '1 day') d(day)
   where a.tenant_id=$1 and a.deleted_at is null and a.effective_from<=$3::date and (a.effective_to is null or a.effective_to>=$2::date)
     and extract(isodow from d.day)::smallint=any(a.assigned_weekdays)
     and ($4::uuid is null or a.site_id=$4) and ($5::uuid is null or a.employee_id=$5)
), detail as (
  select x.attendance_date,e.id as employee_id,e.employee_code,e.full_name,r.name as role_name,s.id as site_id,s.site_code,s.site_name,
    case when ar.id is null or ar.submitted_status='absent' then 'absent' when ar.ended_at is null then 'incomplete' else 'present' end as attendance_status,
    case when ar.id is null then 'not_submitted' else 'submitted' end as submission_state,
    ar.started_at,ar.ended_at,ar.is_late,ar.is_early_end,ar.remark,
    coalesce(e.normal_daily_minutes_override,r.normal_daily_minutes,ts.default_daily_minutes)::int as normal_minutes,
    case when ar.submitted_status='present' then floor(extract(epoch from (coalesce(ar.ended_at,ar.started_at+coalesce(e.normal_daily_minutes_override,r.normal_daily_minutes,ts.default_daily_minutes)*interval '1 minute')-ar.started_at))/60)::int else 0 end as worked_minutes,
    case when ar.submitted_status='present' and ar.ended_at is not null then greatest(0,floor(extract(epoch from (ar.ended_at-ar.started_at))/60)::int-coalesce(e.normal_daily_minutes_override,r.normal_daily_minutes,ts.default_daily_minutes)) else 0 end as overtime_minutes
  from expected x join employees e on e.id=x.employee_id join employee_roles r on r.id=e.employee_role_id join sites s on s.id=x.site_id join tenant_settings ts on ts.tenant_id=e.tenant_id
  left join attendance_records ar on ar.tenant_id=$1 and ar.employee_id=x.employee_id and ar.site_id=x.site_id and ar.attendance_date=x.attendance_date and ar.deleted_at is null
  where e.deleted_at is null and s.deleted_at is null
)`;

const parameters=(filters:ReportFilters):unknown[]=>[filters.tenantId,filters.from,filters.to,filters.siteId??null,filters.employeeId??null];
type Queryable=Pick<Pool|PoolClient,"query">;

export const getAttendanceDetail=async(database:Queryable,filters:ReportFilters,pagination?:Pagination):Promise<{rows:QueryResultRow[];total:number}>=>{
  const values=parameters(filters);const paging=pagination?` limit $${values.push(pagination.limit)} offset $${values.push(pagination.offset)}`:"";
  const result=await database.query(`${detailCte} select detail.*,count(*) over()::int as total_count from detail order by attendance_date desc,site_name,full_name${paging}`,values);
  return{rows:result.rows,total:result.rows[0]?.total_count??0};
};

export const getEmployeeSiteSummary=async(database:Queryable,filters:ReportFilters):Promise<QueryResultRow[]>=>{
  const result=await database.query(`${detailCte} select employee_id,employee_code,full_name,site_id,site_code,site_name,count(*)::int as expected_days,count(*) filter(where attendance_status='present')::int as present_days,count(*) filter(where attendance_status='absent')::int as absent_days,count(*) filter(where attendance_status='incomplete')::int as incomplete_days,count(*) filter(where is_late)::int as late_days,count(*) filter(where is_early_end)::int as early_end_days,sum(worked_minutes)::int as worked_minutes,sum(overtime_minutes)::int as overtime_minutes from detail group by employee_id,employee_code,full_name,site_id,site_code,site_name order by full_name,site_name`,parameters(filters));return result.rows;
};

export const getEmployeeSummary=async(database:Queryable,filters:ReportFilters):Promise<QueryResultRow[]>=>{
  const result=await database.query(`${detailCte} select employee_id,employee_code,full_name,count(*)::int as expected_days,count(*) filter(where attendance_status='present')::int as present_days,count(*) filter(where attendance_status='absent')::int as absent_days,count(*) filter(where attendance_status='incomplete')::int as incomplete_days,count(*) filter(where is_late)::int as late_days,count(*) filter(where is_early_end)::int as early_end_days,sum(worked_minutes)::int as worked_minutes,sum(overtime_minutes)::int as overtime_minutes from detail group by employee_id,employee_code,full_name order by full_name`,parameters(filters));return result.rows;
};

export const getPeriodSummary=async(database:Queryable,filters:ReportFilters,period:"day"|"week"|"month"):Promise<QueryResultRow[]>=>{
  const unit=period==="day"?"day":period==="week"?"week":"month";
  const result=await database.query(`${detailCte} select date_trunc('${unit}',attendance_date)::date as period_start,count(*)::int as expected_count,count(*) filter(where attendance_status='present')::int as present_count,count(*) filter(where attendance_status='absent')::int as absent_count,count(*) filter(where attendance_status='incomplete')::int as incomplete_count,count(*) filter(where is_late)::int as late_count,sum(worked_minutes)::int as worked_minutes,sum(overtime_minutes)::int as overtime_minutes from detail group by period_start order by period_start`,parameters(filters));return result.rows;
};
