import assert from "node:assert/strict";
import test from "node:test";
import { isAccessCodeValid } from "../public/access-code.js";

test("access gate accepts only the configured code", () => {
  assert.equal(isAccessCodeValid("paperpulse2026"), true);
  assert.equal(isAccessCodeValid(" paperpulse2026 "), true);
  assert.equal(isAccessCodeValid("paperpulse2025"), false);
  assert.equal(isAccessCodeValid(""), false);
});
