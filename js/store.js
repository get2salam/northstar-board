// store.js — data model, localStorage persistence, tiny pub/sub.
// The store is the single source of truth. Views subscribe and re-render.

const STORAGE_KEY = "northstar-board:v1";
const SCHEMA_VERSION = 1;

export const NODE_TYPES = ["north", "goal", "milestone"];
export const NODE_STATUSES = ["plan", "active", "done", "blocked"];
export const LINK_KINDS = ["depends", "relates"];

export const MAGNITUDE_MIN = 1;
export const MAGNITUDE_MAX = 4;

const UPDATABLE_NODE_FIELDS = new Set([
  "title", "notes", "type", "status", "x", "y", "magnitude",
]);

function clampMagnitude(value, fallback = 2) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAGNITUDE_MAX, Math.max(MAGNITUDE_MIN, n));
}

function safeText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function uid(prefix = "n") {
  // Short, sortable-ish id: prefix + base36 timestamp + random tail.
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyBoard() {
  return {
    version: SCHEMA_VERSION,
    meta: {
      name: "Untitled board",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      northstar: null,
    },
    nodes: [],
    links: [],
  };
}

function validate(board) {
  if (!board || typeof board !== "object") return false;
  if (board.version !== SCHEMA_VERSION) return false;
  if (!board.meta || typeof board.meta !== "object") return false;
  if (typeof board.meta.name !== "string") return false;
  if (!Array.isArray(board.nodes) || !Array.isArray(board.links)) return false;
  const nodeIds = new Set();
  for (const n of board.nodes) {
    if (!n || typeof n.id !== "string" || nodeIds.has(n.id)) return false;
    if (typeof n.title !== "string") return false;
    if (n.notes !== undefined && typeof n.notes !== "string") return false;
    if (!NODE_TYPES.includes(n.type)) return false;
    if (!NODE_STATUSES.includes(n.status)) return false;
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return false;
    if (!Number.isInteger(n.magnitude) ||
        n.magnitude < MAGNITUDE_MIN || n.magnitude > MAGNITUDE_MAX) return false;
    nodeIds.add(n.id);
  }
  const linkIds = new Set();
  for (const l of board.links) {
    if (!l || typeof l.id !== "string" || linkIds.has(l.id)) return false;
    if (!nodeIds.has(l.from) || !nodeIds.has(l.to)) return false;
    if (l.from === l.to) return false;
    if (!LINK_KINDS.includes(l.kind)) return false;
    linkIds.add(l.id);
  }
  const star = board.meta.northstar;
  if (star !== null && star !== undefined && !nodeIds.has(star)) return false;
  return true;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyBoard();
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) return emptyBoard();
    return parsed;
  } catch {
    return emptyBoard();
  }
}

function save(board) {
  board.meta.updatedAt = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

// ---------- Store factory ----------

export function createStore() {
  let state = load();
  const listeners = new Set();

  const emit = () => {
    save(state);
    for (const fn of listeners) fn(state);
  };

  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },

    // ----- node ops -----

    addNode(partial = {}) {
      const node = {
        id: uid("n"),
        title: safeText(partial.title).trim() || "Untitled star",
        notes: safeText(partial.notes),
        type: NODE_TYPES.includes(partial.type) ? partial.type : "goal",
        status: NODE_STATUSES.includes(partial.status) ? partial.status : "plan",
        x: typeof partial.x === "number" ? partial.x : 0,
        y: typeof partial.y === "number" ? partial.y : 0,
        magnitude: clampMagnitude(partial.magnitude),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.nodes.push(node);
      emit();
      return node;
    },

    updateNode(id, patch) {
      const node = state.nodes.find((n) => n.id === id);
      if (!node || !patch) return null;
      const safe = {};
      for (const [k, v] of Object.entries(patch)) {
        if (!UPDATABLE_NODE_FIELDS.has(k)) continue;
        if (k === "type" && !NODE_TYPES.includes(v)) continue;
        if (k === "status" && !NODE_STATUSES.includes(v)) continue;
        if (k === "magnitude") { safe[k] = clampMagnitude(v, node.magnitude); continue; }
        if ((k === "x" || k === "y") && !Number.isFinite(v)) continue;
        if ((k === "title" || k === "notes") && typeof v !== "string") continue;
        safe[k] = v;
      }
      Object.assign(node, safe, { updatedAt: nowIso() });
      emit();
      return node;
    },

    removeNode(id) {
      state.nodes = state.nodes.filter((n) => n.id !== id);
      state.links = state.links.filter((l) => l.from !== id && l.to !== id);
      if (state.meta.northstar === id) state.meta.northstar = null;
      emit();
    },

    setNorthstar(id) {
      if (id === null || id === undefined) {
        state.meta.northstar = null;
      } else if (state.nodes.some((n) => n.id === id)) {
        state.meta.northstar = id;
      } else {
        return;
      }
      emit();
    },

    // ----- link ops -----

    addLink(from, to, kind = "depends") {
      if (from === to) return null;
      if (!LINK_KINDS.includes(kind)) return null;
      if (!state.nodes.some((n) => n.id === from)) return null;
      if (!state.nodes.some((n) => n.id === to)) return null;
      const exists = state.links.find(
        (l) => l.from === from && l.to === to && l.kind === kind,
      );
      if (exists) return exists;
      const link = { id: uid("l"), from, to, kind };
      state.links.push(link);
      emit();
      return link;
    },

    removeLink(id) {
      state.links = state.links.filter((l) => l.id !== id);
      emit();
    },

    // ----- board ops -----

    rename(name) {
      state.meta.name = safeText(name).trim() || "Untitled board";
      emit();
    },

    replace(next) {
      if (!validate(next)) throw new Error("Invalid board file");
      state = next;
      emit();
    },

    reset() {
      state = emptyBoard();
      emit();
    },
  };
}

export { SCHEMA_VERSION, STORAGE_KEY, uid, emptyBoard, validate };
