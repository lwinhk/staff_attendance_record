import { strict as assert } from "node:assert";
import { describe,it } from "node:test";
import { isInsideRetentionWindow,isReportRangeAllowed,reportRangeDays } from "./report-rules.js";

describe("report ranges",()=>{
  it("counts calendar days consistently",()=>assert.equal(reportRangeDays("2026-01-01","2026-01-31"),30));
  it("allows the 36-month retention horizon and rejects larger or reversed ranges",()=>{assert.equal(isReportRangeAllowed("2026-01-01","2028-12-31"),true);assert.equal(isReportRangeAllowed("2026-01-01","2030-01-01"),false);assert.equal(isReportRangeAllowed("2026-02-01","2026-01-01"),false);});
  it("rejects report starts outside retention",()=>{const now=new Date("2026-09-16T00:00:00Z");assert.equal(isInsideRetentionWindow("2023-09-16",now),true);assert.equal(isInsideRetentionWindow("2023-09-15",now),false);});
});
