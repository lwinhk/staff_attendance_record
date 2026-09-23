import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isTenantObjectKey } from "./storage.js";

describe("tenant object keys", () => {
  it("accepts only keys inside the authenticated tenant prefix", () => {
    assert.equal(isTenantObjectKey("tenants/tenant-a/employees/1/photo/2", "tenant-a"), true);
    assert.equal(isTenantObjectKey("tenants/tenant-b/employees/1/photo/2", "tenant-a"), false);
    assert.equal(isTenantObjectKey("tenants/tenant-a/../tenant-b/document", "tenant-a"), false);
  });
});
