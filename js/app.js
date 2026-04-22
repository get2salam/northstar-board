// app.js — entry point. Wires the store to the views.

import { createStore } from "./store.js";
import { createBoard } from "./board.js";
import { createEditor } from "./editor.js";
import { createShortcuts } from "./shortcuts.js";

const store = createStore();
const statusEl = document.getElementById("status");
const stage = document.querySelector(".stage");
const boardRoot = document.getElementById("board-root");

const board = createBoard(boardRoot, store);
const editor = createEditor(stage, store, board);
const shortcuts = createShortcuts({ store, board, editor });

boardRoot.addEventListener("star:select", (e) => {
  editor.open(e.detail.id);
});

function bindToolbar() {
  const buttons = document.querySelectorAll(".toolbar .btn");
  for (const btn of buttons) {
    const label = btn.textContent.trim();
    btn.disabled = false;
    if (label === "New star") {
      btn.addEventListener("click", () => {
        const node = store.addNode({
          title: "New star",
          x: Math.round((Math.random() - 0.5) * 420),
          y: Math.round((Math.random() - 0.5) * 260),
        });
        board.select(node.id);
        editor.open(node.id);
      });
    } else if (label === "Help") {
      btn.addEventListener("click", () => shortcuts.toggleHelp(true));
    } else {
      // Import / Export arrive in the next commit.
      btn.disabled = true;
      btn.title = "Coming soon";
    }
  }
}

bindToolbar();

function render(state) {
  const n = state.nodes.length;
  const l = state.links.length;
  const when = new Date(state.meta.updatedAt).toLocaleTimeString();
  if (statusEl) {
    statusEl.textContent = `${state.meta.name} · ${n} stars · ${l} links · saved ${when} · press ? for help`;
  }
  const hero = document.querySelector(".empty-hero");
  if (hero) hero.style.display = n === 0 ? "" : "none";
}

store.subscribe(render);

window.northstar = { store, board, editor, shortcuts };
