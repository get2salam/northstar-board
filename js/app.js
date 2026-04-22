// app.js — entry point. Wires the store to the views.

import { createStore } from "./store.js";
import { createBoard } from "./board.js";

const store = createStore();
const statusEl = document.getElementById("status");
const boardRoot = document.getElementById("board-root");

const board = createBoard(boardRoot, store);

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

// Expose for debugging and for subsequent commits that wire more UI.
window.northstar = { store, board };
