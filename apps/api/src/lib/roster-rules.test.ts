import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { dateRangesOverlap, normalizeWeekdays, weekdaysOverlap } from "./roster-rules.js";

describe("roster conflict rules", () => {
  it("detects conflicts involving open-ended date ranges", () => {
    assert.equal(dateRangesOverlap("2026-01-01", null, "2027-05-01", "2027-06-01"), true);
    assert.equal(dateRangesOverlap("2026-01-01", "2026-03-01", "2026-03-02", null), false);
  });

  it("requires at least one shared weekday for a schedule conflict", () => {
    assert.equal(weekdaysOverlap([1, 2, 3, 4, 5], [6, 7]), false);
    assert.equal(weekdaysOverlap([1, 3, 5], [2, 5, 6]), true);
  });

  it("normalizes duplicate and unordered weekday selections", () => {
    assert.deepEqual(normalizeWeekdays([7, 1, 5, 1, 3]), [1, 3, 5, 7]);
  });
});
