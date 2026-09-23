import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "@attendance/database";
import { withTransaction } from "@attendance/database";
import { Router } from "express";
import { z } from "zod";
import { writeAuditEvent } from "../lib/audit.js";
import { ApiError } from "../lib/errors.js";
import { normalizeWeekdays } from "../lib/roster-rules.js";
import { authenticate, authorize, requireTenant } from "../middleware/auth.js";

const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const assignmentSchema = z.object({
  employeeId: z.string().uuid(), siteId: z.string().uuid(), effectiveFrom: dateString, effectiveTo: dateString.nullish(),
  assignedWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7), confirmConflicts: z.boolean().default(false),
}).refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, { message: "End date must not precede start date" });

interface ConflictRow { id: string; site_id: string; site_name: string; effective_from: string; effective_to: string | null; assigned_weekdays: number[] }

const findConflicts = async (database: Pool | PoolClient, tenantId: string, input: z.infer<typeof assignmentSchema>, excludeId?: string): Promise<ConflictRow[]> => {
  const result = await database.query<ConflictRow>(
    `select a.id,a.site_id,s.site_name,a.effective_from,a.effective_to,a.assigned_weekdays
       from employee_site_assignments a join sites s on s.id=a.site_id
      where a.tenant_id=$1 and a.employee_id=$2 and a.deleted_at is null
        and a.effective_from<=coalesce($4::date,'infinity'::date)
        and (a.effective_to is null or a.effective_to>=$3::date)
        and a.assigned_weekdays && $5::smallint[]
        and ($6::uuid is null or a.id<>$6::uuid)
      order by a.effective_from`,
    [tenantId, input.employeeId, input.effectiveFrom, input.effectiveTo ?? null, normalizeWeekdays(input.assignedWeekdays), excludeId ?? null],
  );
  return result.rows;
};

const notifySiteSupervisors = async (
  client: PoolClient, tenantId: string, siteId: string, start: string, end: string | null,
  event: { type: string; titleKey: string; payload: Record<string, unknown> },
): Promise<void> => {
  const supervisors = await client.query<{ supervisor_user_id: string }>(
    `select distinct supervisor_user_id from supervisor_site_assignments
      where tenant_id=$1 and site_id=$2 and deleted_at is null
        and effective_from<=coalesce($4::date,'infinity'::date)
        and (effective_to is null or effective_to>=$3::date)`,
    [tenantId, siteId, start, end],
  );
  for (const supervisor of supervisors.rows) {
    await client.query(
      "insert into notifications (id,tenant_id,user_id,notification_type,title_key,payload) values ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), tenantId, supervisor.supervisor_user_id, event.type, event.titleKey, event.payload],
    );
  }
};

export const createRosterRouter = (database: Pool): Router => {
  const router = Router(); router.use(authenticate(database));

  router.get("/assignments", authorize("tenant_admin", "operations_admin"), async (request,response,next)=>{try{const tenantId=requireTenant(request);const query=z.object({siteId:z.string().uuid().optional(),employeeId:z.string().uuid().optional(),activeOn:dateString.optional()}).parse(request.query);const result=await database.query(`select a.id,a.employee_id,e.employee_code,e.full_name,a.site_id,s.site_code,s.site_name,a.effective_from,a.effective_to,a.assigned_weekdays,a.conflict_acknowledged from employee_site_assignments a join employees e on e.id=a.employee_id join sites s on s.id=a.site_id where a.tenant_id=$1 and a.deleted_at is null and ($2::uuid is null or a.site_id=$2) and ($3::uuid is null or a.employee_id=$3) and ($4::date is null or (a.effective_from<=$4 and (a.effective_to is null or a.effective_to>=$4))) order by a.effective_from desc,e.full_name`,[tenantId,query.siteId??null,query.employeeId??null,query.activeOn??null]);response.json({assignments:result.rows});}catch(error){next(error);}});
  router.post("/conflicts", authorize("tenant_admin", "operations_admin"), async (request,response,next)=>{try{const tenantId=requireTenant(request);const input=assignmentSchema.parse(request.body);response.json({conflicts:await findConflicts(database,tenantId,input)});}catch(error){next(error);}});
  router.post("/assignments", authorize("tenant_admin", "operations_admin"), async (request,response,next)=>{try{const tenantId=requireTenant(request);const raw=assignmentSchema.parse(request.body);const input={...raw,assignedWeekdays:normalizeWeekdays(raw.assignedWeekdays)};const assignmentId=randomUUID();const result=await withTransaction(database,async(client)=>{await client.query("select pg_advisory_xact_lock(hashtext($1))",[input.employeeId]);const employee=await client.query<{full_name:string;employee_code:string}>("select full_name,employee_code from employees where id=$1 and tenant_id=$2 and employment_status='active' and deleted_at is null",[input.employeeId,tenantId]);const site=await client.query<{site_name:string}>("select site_name from sites where id=$1 and tenant_id=$2 and status='active' and deleted_at is null",[input.siteId,tenantId]);if(!employee.rows[0])throw new ApiError(400,"INVALID_EMPLOYEE","Active employee not found");if(!site.rows[0])throw new ApiError(400,"INVALID_SITE","Active site not found");const conflicts=await findConflicts(client,tenantId,input);if(conflicts.length&&!input.confirmConflicts)throw new ApiError(409,"ROSTER_CONFLICT","Employee has an overlapping site assignment",{conflicts});await client.query(`insert into employee_site_assignments (id,tenant_id,employee_id,site_id,effective_from,effective_to,assigned_weekdays,conflict_acknowledged,conflict_acknowledged_by,created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[assignmentId,tenantId,input.employeeId,input.siteId,input.effectiveFrom,input.effectiveTo??null,input.assignedWeekdays,conflicts.length>0,conflicts.length?request.auth!.id:null,request.auth!.id]);await notifySiteSupervisors(client,tenantId,input.siteId,input.effectiveFrom,input.effectiveTo??null,{type:"employee_assigned",titleKey:"notification.employee_assigned",payload:{assignmentId,employeeId:input.employeeId,employeeName:employee.rows[0].full_name,employeeCode:employee.rows[0].employee_code,siteId:input.siteId,siteName:site.rows[0].site_name,effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo??null,assignedWeekdays:input.assignedWeekdays}});await writeAuditEvent(client,{tenantId,actorUserId:request.auth!.id,action:"employee_site_assignment.created",entityType:"employee_site_assignment",entityId:assignmentId,metadata:{employeeId:input.employeeId,siteId:input.siteId,conflicts:conflicts.map(item=>item.id)}});return conflicts;});response.status(201).json({id:assignmentId,conflicts:result});}catch(error){next(error);}});
  router.patch("/assignments/:assignmentId/end", authorize("tenant_admin", "operations_admin"), async (request,response,next)=>{try{const tenantId=requireTenant(request);const assignmentId=uuid.parse(request.params.assignmentId);const {effectiveTo,remark}=z.object({effectiveTo:dateString,remark:z.string().trim().min(1).max(1000)}).parse(request.body);await withTransaction(database,async(client)=>{const current=await client.query<{employee_id:string;site_id:string;effective_from:string;effective_to:string|null;full_name:string;site_name:string}>(`select a.employee_id,a.site_id,a.effective_from,a.effective_to,e.full_name,s.site_name from employee_site_assignments a join employees e on e.id=a.employee_id join sites s on s.id=a.site_id where a.id=$1 and a.tenant_id=$2 and a.deleted_at is null for update`,[assignmentId,tenantId]);const row=current.rows[0];if(!row||effectiveTo<row.effective_from)throw new ApiError(400,"INVALID_ASSIGNMENT_END","Assignment not found or end date precedes start date");await client.query("update employee_site_assignments set effective_to=$1,updated_at=now() where id=$2",[effectiveTo,assignmentId]);await notifySiteSupervisors(client,tenantId,row.site_id,row.effective_from,row.effective_to,{type:"employee_assignment_ended",titleKey:"notification.employee_assignment_ended",payload:{assignmentId,employeeId:row.employee_id,employeeName:row.full_name,siteId:row.site_id,siteName:row.site_name,effectiveTo,remark}});await writeAuditEvent(client,{tenantId,actorUserId:request.auth!.id,action:"employee_site_assignment.ended",entityType:"employee_site_assignment",entityId:assignmentId,metadata:{effectiveTo,remark}});});response.status(204).send();}catch(error){next(error);}});

  router.get("/sites/:siteId/expected-employees", authorize("site_supervisor"), async (request,response,next)=>{try{const tenantId=requireTenant(request);const siteId=uuid.parse(request.params.siteId);const {date}=z.object({date:dateString}).parse(request.query);const access=await database.query("select 1 from supervisor_site_assignments where tenant_id=$1 and site_id=$2 and supervisor_user_id=$3 and deleted_at is null and effective_from<=$4::date and (effective_to is null or effective_to>=$4::date)",[tenantId,siteId,request.auth!.id,date]);if(!access.rowCount)throw new ApiError(403,"SITE_NOT_ASSIGNED","Site is not assigned to this supervisor on the selected date");const result=await database.query(`select e.id,e.employee_code,e.full_name,e.contact_phone,e.contact_email,e.emergency_contact_name,e.emergency_contact_phone,e.emergency_contact_relation,r.name as role_name,coalesce(e.normal_daily_minutes_override,r.normal_daily_minutes,ts.default_daily_minutes) as normal_daily_minutes from employee_site_assignments a join employees e on e.id=a.employee_id join employee_roles r on r.id=e.employee_role_id join tenant_settings ts on ts.tenant_id=e.tenant_id where a.tenant_id=$1 and a.site_id=$2 and a.deleted_at is null and e.deleted_at is null and e.employment_status='active' and a.effective_from<=$3::date and (a.effective_to is null or a.effective_to>=$3::date) and extract(isodow from $3::date)::smallint=any(a.assigned_weekdays) order by e.full_name`,[tenantId,siteId,date]);response.json({date,employees:result.rows});}catch(error){next(error);}});
  return router;
};
