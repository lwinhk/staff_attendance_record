import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { canResetUserPassword } from "./permissions.js";

describe("tenant user permissions", () => {
  it("allows Operations Admin to reset Supervisor passwords only", () => {
    assert.equal(canResetUserPassword("operations_admin", "site_supervisor"), true);
    assert.equal(canResetUserPassword("operations_admin", "operations_admin"), false);
    assert.equal(canResetUserPassword("operations_admin", "tenant_admin"), false);
  });

  it("prevents tenant roles from managing a platform Super Admin", () => {
    assert.equal(canResetUserPassword("tenant_admin", "super_admin"), false);
  });
});
