// sample.test.mjs — guards the bundled sample board.
//
// Northstar Board ships its starter constellation in two places:
//   - data/sample.json  (fetched when the app is served over HTTP)
//   - js/sample.js      (an inline fallback used when index.html is opened
//                        directly via file://)
// The sample.js source explicitly asks us to keep them in sync, but nothing
// has enforced that until now. This suite checks parity, validates the v1
// schema documented in the README, and refuses cycles in the depends graph.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { SAMPLE_BOARD } from "../js/sample.js";
import {
  NODE_TYPES, NODE_STATUSES, LINK_KINDS,
  MAGNITUDE_MIN, MAGNITUDE_MAX, SCHEMA_VERSION, validate,
} from "../js/store.js";

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(here, "..", "data", "sample.json");

async function loadSampleJson() {
  return JSON.parse(await readFile(samplePath, "utf8"));
}

function dependsCycle(nodes, links) {
  const out = new Map(nodes.map((n) => [n.id, []]));
  for (const l of links) {
    if (l.kind === "depends" && out.has(l.from)) out.get(l.from).push(l.to);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(nodes.map((n) => [n.id, WHITE]));
  const path = [];
  const walk = (id) => {
    color.set(id, GRAY);
    path.push(id);
    for (const next of out.get(id) ?? []) {
      const c = color.get(next);
      if (c === GRAY) return path.slice(path.indexOf(next)).concat(next);
      if (c === WHITE) {
        const hit = walk(next);
        if (hit) return hit;
      }
    }
    color.set(id, BLACK);
    path.pop();
    return null;
  };
  for (const n of nodes) {
    if (color.get(n.id) === WHITE) {
      const hit = walk(n.id);
      if (hit) return hit;
    }
  }
  return null;
}

test("data/sample.json declares the documented schema version", async () => {
  const sample = await loadSampleJson();
  assert.equal(sample.version, SCHEMA_VERSION);
});

test("data/sample.json passes the store's own validator", async () => {
  const sample = await loadSampleJson();
  assert.equal(validate(sample), true);
});

test("every node honours the v1 contract from the README", async () => {
  const { nodes } = await loadSampleJson();
  assert.ok(Array.isArray(nodes) && nodes.length > 0, "sample must have nodes");
  const seen = new Set();
  for (const n of nodes) {
    assert.equal(typeof n.id, "string", `node id must be a string`);
    assert.ok(!seen.has(n.id), `duplicate node id: ${n.id}`);
    seen.add(n.id);
    assert.equal(typeof n.title, "string", `node ${n.id} title must be a string`);
    assert.ok(NODE_TYPES.includes(n.type), `node ${n.id} has unknown type ${n.type}`);
    assert.ok(NODE_STATUSES.includes(n.status), `node ${n.id} has unknown status ${n.status}`);
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `node ${n.id} needs finite x/y`);
    assert.ok(
      Number.isInteger(n.magnitude) &&
        n.magnitude >= MAGNITUDE_MIN && n.magnitude <= MAGNITUDE_MAX,
      `node ${n.id} magnitude must be an integer in [${MAGNITUDE_MIN}, ${MAGNITUDE_MAX}]`,
    );
  }
});

test("every link points at real nodes with a known kind", async () => {
  const { nodes, links, meta } = await loadSampleJson();
  const ids = new Set(nodes.map((n) => n.id));
  const linkIds = new Set();
  for (const l of links) {
    assert.equal(typeof l.id, "string", "link id must be a string");
    assert.ok(!linkIds.has(l.id), `duplicate link id: ${l.id}`);
    linkIds.add(l.id);
    assert.notEqual(l.from, l.to, `link ${l.id} cannot loop on itself`);
    assert.ok(ids.has(l.from), `link ${l.id} from unknown node ${l.from}`);
    assert.ok(ids.has(l.to), `link ${l.id} to unknown node ${l.to}`);
    assert.ok(LINK_KINDS.includes(l.kind), `link ${l.id} has unknown kind ${l.kind}`);
  }
  if (meta.northstar !== null && meta.northstar !== undefined) {
    assert.ok(
      ids.has(meta.northstar),
      `meta.northstar ${meta.northstar} is not in nodes`,
    );
  }
});

test("the 'depends' graph stays acyclic", async () => {
  const { nodes, links } = await loadSampleJson();
  const cycle = dependsCycle(nodes, links);
  assert.equal(
    cycle, null,
    cycle ? `depends cycle detected: ${cycle.join(" -> ")}` : undefined,
  );
});

test("data/sample.json matches js/sample.js SAMPLE_BOARD byte-for-byte", async () => {
  const fromFile = await loadSampleJson();
  assert.deepEqual(
    fromFile, SAMPLE_BOARD,
    "data/sample.json drifted from js/sample.js — update both together",
  );
});
