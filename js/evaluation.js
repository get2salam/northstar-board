// evaluation.js — deterministic planning-quality score for a board.
// Useful for agent/eval workflows: given the same board JSON, it returns the
// same readiness score without calling a model or a network service.

import { validate } from "./store.js";

const WEIGHTS = {
  schema: 20,
  northstar: 15,
  progress: 15,
  dependencyCoverage: 15,
  blockedRisk: 15,
  focusLoad: 10,
  context: 10,
};

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function ratio(count, total) {
  return total <= 0 ? 0 : clamp01(count / total);
}

export function evaluateBoard(board) {
  if (!validate(board)) {
    return {
      score: 0,
      grade: "invalid",
      signals: ["Board does not match the Northstar v1 schema."],
      breakdown: { schema: 0 },
    };
  }

  const nodes = board.nodes;
  const links = board.links;
  const total = nodes.length;
  const northstarId = board.meta.northstar;
  const northstar = nodes.find((node) => node.id === northstarId);
  const activeOrDone = nodes.filter((node) => node.status === "active" || node.status === "done").length;
  const blocked = nodes.filter((node) => node.status === "blocked").length;
  const highMagnitude = nodes.filter((node) => node.magnitude >= 3);
  const highWithContext = highMagnitude.filter((node) => (node.notes ?? "").trim().length >= 24).length;

  const dependencyTarget = Math.max(1, total - 1);
  const dependencyCoverage = ratio(links.length, dependencyTarget);
  const progress = ratio(activeOrDone, total);
  const blockedRisk = total === 0 ? 0 : clamp01(1 - blocked / Math.max(1, Math.ceil(total / 3)));
  const focusLoad = total === 0 ? 0 : total <= 24 ? 1 : clamp01(1 - (total - 24) / 24);
  const context = highMagnitude.length === 0 ? 1 : ratio(highWithContext, highMagnitude.length);

  const breakdown = {
    schema: WEIGHTS.schema,
    northstar: northstar ? WEIGHTS.northstar : 0,
    progress: Math.round(progress * WEIGHTS.progress),
    dependencyCoverage: Math.round(dependencyCoverage * WEIGHTS.dependencyCoverage),
    blockedRisk: Math.round(blockedRisk * WEIGHTS.blockedRisk),
    focusLoad: Math.round(focusLoad * WEIGHTS.focusLoad),
    context: Math.round(context * WEIGHTS.context),
  };

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const signals = [];
  if (!northstar) signals.push("Pick one northstar so the board has a single guiding outcome.");
  if (progress < 0.25) signals.push("Move at least a quarter of stars into active or achieved states.");
  if (dependencyCoverage < 0.5 && total > 2) signals.push("Connect more stars so dependencies are visible instead of implicit.");
  if (blocked > Math.ceil(total / 3)) signals.push("Too many stars are blocked; prune or unblock the riskiest path first.");
  if (focusLoad < 1) signals.push("The board is getting crowded; split secondary work into another constellation.");
  if (context < 0.75) signals.push("Add notes to high-magnitude stars so future-you knows why they matter.");
  if (signals.length === 0) signals.push("Board has a clear northstar, visible progress, and useful dependency context.");

  return {
    score,
    grade: score >= 85 ? "ready" : score >= 65 ? "healthy" : score >= 40 ? "needs-focus" : "at-risk",
    signals,
    breakdown,
  };
}

export { WEIGHTS as EVALUATION_WEIGHTS };
