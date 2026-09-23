import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createCsv } from "./csv.js";

describe("CSV export", () => {
  it("preserves Unicode and escapes commas and quotes", () => {
    const csv = createCsv(["Name", "Note"], [["မောင်မောင်", 'Late, said "traffic"']]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes("မောင်မောင်"));
    assert.ok(csv.includes('"Late, said ""traffic"""'));
  });
});
