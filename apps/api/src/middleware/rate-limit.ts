import type { NextFunction,Request,Response } from "express";
import { ApiError } from "../lib/errors.js";
const attempts=new Map<string,{count:number;resetAt:number}>();
const requestKey=(request:Request)=>request.ip??request.socket.remoteAddress??"unknown";
export const loginRateLimit=(request:Request,_response:Response,next:NextFunction):void=>{const key=requestKey(request);const now=Date.now();const current=attempts.get(key);if(!current||current.resetAt<=now){attempts.set(key,{count:1,resetAt:now+15*60_000});next();return;}current.count+=1;if(current.count>10){next(new ApiError(429,"TOO_MANY_LOGIN_ATTEMPTS","Too many login attempts; try again later"));return;}next();};
export const resetLoginRateLimit=(request:Request):void=>{attempts.delete(requestKey(request));};
