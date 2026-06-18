// evaluation.test.mjs — deterministic readiness scoring for agent/eval workflows.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SAMPLE_BOARD } from "../js/sample.js";
import { evaluateBoard } from "../js/evaluation.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("sample board earns a deterministic healthy readiness score", () => {
  const result = evaluateBoard(clone(SAMPLE_BOARD));

  assert.equal(result.score, 88);
  assert.equal(result.grade, "ready");
  assert.deepEqual(result.breakdown, {
    schema: 20,
    northstar: 15,
    progress: 8,
    dependencyCoverage: 15,
    blockedRisk: 10,
    focusLoad: 10,
    context: 10,
  });
  assert.match(result.signals.join("\n"), /clear northstar/);
});

test("invalid boards fail closed for automated reviewers", () => {
  const result = evaluateBoard({ version: 1, meta: {}, nodes: [], links: [] });

  assert.equal(result.score, 0);
  assert.equal(result.grade, "invalid");
  assert.deepEqual(result.breakdown, { schema: 0 });
  assert.match(result.signals[0], /does not match/);
});

test("readiness score highlights unfocused boards without a northstar", () => {
  const board = clone(SAMPLE_BOARD);
  board.meta.northstar = null;
  board.links = [];
  for (const node of board.nodes) {
    node.status = "plan";
    node.notes = "";
  }

  const result = evaluateBoard(board);

  assert.equal(result.grade, "needs-focus");
  assert.equal(result.breakdown.northstar, 0);
  assert.equal(result.breakdown.progress, 0);
  assert.equal(result.breakdown.dependencyCoverage, 0);
  assert.ok(result.signals.some((signal) => signal.includes("Pick one northstar")));
  assert.ok(result.signals.some((signal) => signal.includes("Connect more stars")));
});
