import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./security.js";

describe("security helpers", () => {
  it("hashes passwords without retaining the clear value", async () => {
    const hash = await hashPassword("a-secure-password");
    assert.notEqual(hash, "a-secure-password");
    assert.equal(await verifyPassword("a-secure-password", hash), true);
    assert.equal(await verifyPassword("a-wrong-password", hash), false);
  });

  it("creates opaque session tokens and stable non-reversible hashes", () => {
    const token = createSessionToken();
    assert.ok(token.length >= 40);
    assert.equal(hashSessionToken(token), hashSessionToken(token));
    assert.notEqual(hashSessionToken(token), token);
  });
});
