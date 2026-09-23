import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { calculateAttendance } from "./attendance-rules.js";

describe("attendance calculations", () => {
  it("uses normal hours for a missing end without creating overtime", () => {
    const result=calculateAttendance({submittedStatus:"present",startedAt:"2026-09-15T20:00:00.000Z",endedAt:null,normalDailyMinutes:600});
    assert.equal(result.state,"incomplete");assert.equal(result.workedMinutes,600);assert.equal(result.overtimeMinutes,0);assert.equal(result.usedCalculatedEnd,true);
  });

  it("supports overnight work and daily overtime", () => {
    const result=calculateAttendance({submittedStatus:"present",startedAt:"2026-09-15T20:00:00.000Z",endedAt:"2026-09-16T08:00:00.000Z",normalDailyMinutes:600});
    assert.equal(result.state,"present");assert.equal(result.workedMinutes,720);assert.equal(result.overtimeMinutes,120);
  });

  it("reports absence as zero worked time", () => {
    const result=calculateAttendance({submittedStatus:"absent",startedAt:null,endedAt:null,normalDailyMinutes:480});
    assert.equal(result.state,"absent");assert.equal(result.workedMinutes,0);assert.equal(result.overtimeMinutes,0);
  });
});
