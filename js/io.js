// io.js — import, export, and sample board loading.

import { SCHEMA_VERSION, validate } from "./store.js";
import { SAMPLE_BOARD } from "./sample.js";

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function slugify(name) {
  return (name || "northstar-board")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "northstar-board";
}

export function exportBoard(store) {
  const state = store.get();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${slugify(state.meta.name)}-${stamp}.northstar.json`;
  download(filename, JSON.stringify(state, null, 2));
}

export function importBoard(store) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!validate(parsed)) {
        alert(
          `That file doesn't look like a Northstar board (expected schema v${SCHEMA_VERSION}).`,
        );
        return;
      }
      if (store.get().nodes.length > 0) {
        const ok = confirm(
          "Replace the current board with the imported one? This cannot be undone.",
        );
        if (!ok) return;
      }
      store.replace(parsed);
    } catch (err) {
      alert(`Couldn't read file: ${err.message}`);
    }
  });
  input.click();
}

// Try to fetch data/sample.json; fall back to the embedded sample module when
// the file isn't served (e.g. user opened index.html directly as file://).
export async function loadSampleIfEmpty(store) {
  if (store.get().nodes.length > 0) return false;
  let payload = null;
  try {
    const res = await fetch("data/sample.json", { cache: "no-store" });
    if (res.ok) payload = await res.json();
  } catch {
    // ignore, we'll fall back below.
  }
  if (!payload) payload = SAMPLE_BOARD;
  if (!validate(payload)) return false;
  // Freshen timestamps so the user sees "saved just now".
  payload.meta.updatedAt = new Date().toISOString();
  store.replace(payload);
  return true;
}
