export const reportRangeDays=(from:string,to:string):number=>(Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86_400_000;
export const isReportRangeAllowed=(from:string,to:string,maxDays=1096):boolean=>reportRangeDays(from,to)>=0&&reportRangeDays(from,to)<=maxDays;
export const isInsideRetentionWindow=(from:string,now=new Date()):boolean=>{const oldest=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-36,now.getUTCDate()));return Date.parse(`${from}T00:00:00Z`)>=oldest.getTime();};
