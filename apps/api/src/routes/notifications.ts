import type { Pool } from "@attendance/database";
import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/errors.js";
import { authenticate, requireTenant } from "../middleware/auth.js";

export const createNotificationsRouter = (database: Pool): Router => {
  const router=Router();router.use(authenticate(database));
  router.get("/",async(request,response,next)=>{try{const tenantId=requireTenant(request);const query=z.object({unreadOnly:z.enum(["true","false"]).default("false"),limit:z.coerce.number().int().min(1).max(100).default(50)}).parse(request.query);const result=await database.query("select id,notification_type,title_key,payload,read_at,created_at from notifications where tenant_id=$1 and user_id=$2 and deleted_at is null and ($3::boolean=false or read_at is null) order by created_at desc limit $4",[tenantId,request.auth!.id,query.unreadOnly==="true",query.limit]);response.json({notifications:result.rows});}catch(error){next(error);}});
  router.patch("/:notificationId/read",async(request,response,next)=>{try{const tenantId=requireTenant(request);const id=z.string().uuid().parse(request.params.notificationId);const result=await database.query("update notifications set read_at=coalesce(read_at,now()) where id=$1 and tenant_id=$2 and user_id=$3 and deleted_at is null returning id",[id,tenantId,request.auth!.id]);if(!result.rowCount)throw new ApiError(404,"NOTIFICATION_NOT_FOUND","Notification not found");response.status(204).send();}catch(error){next(error);}});
  router.post("/read-all",async(request,response,next)=>{try{const tenantId=requireTenant(request);await database.query("update notifications set read_at=now() where tenant_id=$1 and user_id=$2 and read_at is null and deleted_at is null",[tenantId,request.auth!.id]);response.status(204).send();}catch(error){next(error);}});
  return router;
};
