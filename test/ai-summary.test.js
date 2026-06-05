import assert from "node:assert/strict";
import test from "node:test";
import { getSummaryLimit } from "../src/ai-summary.js";

test("summary limit defaults to a small batch to keep builds fast", () => {
  assert.equal(getSummaryLimit(undefined), 12);
});

test("summary limit accepts explicit workflow variable values", () => {
  assert.equal(getSummaryLimit("6"), 6);
  assert.equal(getSummaryLimit("20"), 20);
});

test("summary limit falls back when the value is invalid", () => {
  assert.equal(getSummaryLimit("not-a-number"), 12);
});
