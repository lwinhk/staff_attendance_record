import { Router } from "express";
import type { Pool } from "@attendance/database";
import { authenticate } from "../middleware/auth.js";
export const createSyncRouter=(database:Pool):Router=>{const router=Router();router.use(authenticate(database));router.get("/capabilities",(request,response)=>response.json({apiVersion:"1",serverTime:new Date().toISOString(),attendance:{idempotencyKey:"clientOperationId",optimisticVersion:true,batchSubmission:false},offlineMode:false,userId:request.auth!.id,tenantId:request.auth!.tenantId}));return router;};
