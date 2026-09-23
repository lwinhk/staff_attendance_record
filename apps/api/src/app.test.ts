import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Pool } from "@attendance/database";
import request from "supertest";
import { createApp } from "./app.js";

describe("health endpoint", () => {
  it("reports API health without requiring the database", async () => {
    const database = {} as Pool;
    const response = await request(createApp({ database })).get("/api/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.service, "attendance-api");
  });
});
