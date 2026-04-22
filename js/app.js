// app.js — entry point. Wires the store to the UI.
// Subsequent commits will mount the board renderer, editor, and shortcuts here.

import { createStore } from "./store.js";

const store = createStore();
const statusEl = document.getElementById("status");

function render(state) {
  const n = state.nodes.length;
  const l = state.links.length;
  const when = new Date(state.meta.updatedAt).toLocaleTimeString();
  if (statusEl) {
    statusEl.textContent = `${state.meta.name} · ${n} stars · ${l} links · saved ${when}`;
  }
  const hero = document.querySelector(".empty-hero");
  if (hero) hero.style.display = n === 0 ? "" : "none";
}

store.subscribe(render);

// Expose for debugging in the console during development.
window.northstar = { store };
