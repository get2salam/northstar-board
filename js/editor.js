// editor.js — side panel for creating and editing stars.

import { NODE_STATUSES, NODE_TYPES } from "./store.js";

const STATUS_LABELS = {
  plan: "Planned",
  active: "In flight",
  done: "Achieved",
  blocked: "Blocked",
};

const TYPE_LABELS = {
  north: "Northstar",
  goal: "Goal",
  milestone: "Milestone",
};

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function createEditor(mountEl, store, board) {
  let currentId = null;

  const panel = h("aside", { class: "editor", "aria-hidden": "true" });
  mountEl.appendChild(panel);

  function renderEmpty() {
    panel.replaceChildren(
      h("div", { class: "editor-empty" }, [
        h("h3", {}, ["No star selected"]),
        h("p", {}, ["Click a star on the board to edit it, or create a new one."]),
        h(
          "button",
          {
            class: "btn primary",
            onclick: () => {
              const node = store.addNode({
                title: "New star",
                x: Math.round((Math.random() - 0.5) * 400),
                y: Math.round((Math.random() - 0.5) * 240),
              });
              board.select(node.id);
              open(node.id);
            },
          },
          ["Create star"],
        ),
      ]),
    );
  }

  function renderForm(node) {
    const title = h("input", {
      class: "input",
      type: "text",
      value: node.title,
      placeholder: "Name this star",
      oninput: (e) => store.updateNode(node.id, { title: e.target.value }),
    });

    const notes = h("textarea", {
      class: "input textarea",
      rows: "4",
      placeholder: "Notes, context, links…",
      oninput: (e) => store.updateNode(node.id, { notes: e.target.value }),
    });
    notes.value = node.notes ?? "";

    const typeSelect = h(
      "select",
      {
        class: "input",
        onchange: (e) => store.updateNode(node.id, { type: e.target.value }),
      },
      NODE_TYPES.map((t) =>
        h("option", { value: t, ...(t === node.type ? { selected: "" } : {}) }, [
          TYPE_LABELS[t],
        ]),
      ),
    );

    const statusButtons = h(
      "div",
      { class: "pills" },
      NODE_STATUSES.map((s) =>
        h(
          "button",
          {
            class: `pill pill-${s} ${s === node.status ? "active" : ""}`,
            onclick: () => store.updateNode(node.id, { status: s }),
          },
          [STATUS_LABELS[s]],
        ),
      ),
    );

    const magnitude = h("input", {
      class: "input range",
      type: "range",
      min: "1",
      max: "4",
      step: "1",
      value: String(node.magnitude ?? 2),
      oninput: (e) =>
        store.updateNode(node.id, { magnitude: Number(e.target.value) }),
    });

    const setNorth = h(
      "button",
      {
        class: "btn ghost tiny",
        onclick: () => store.setNorthstar(node.id),
      },
      ["Make northstar"],
    );

    const deleteBtn = h(
      "button",
      {
        class: "btn danger tiny",
        onclick: () => {
          if (confirm(`Delete "${node.title}"? This also removes its links.`)) {
            store.removeNode(node.id);
            close();
          }
        },
      },
      ["Delete"],
    );

    panel.replaceChildren(
      h("header", { class: "editor-head" }, [
        h("div", { class: "editor-title" }, ["Edit star"]),
        h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, ["×"]),
      ]),
      h("div", { class: "editor-body" }, [
        h("label", { class: "field" }, [h("span", {}, ["Title"]), title]),
        h("label", { class: "field" }, [h("span", {}, ["Type"]), typeSelect]),
        h("label", { class: "field" }, [h("span", {}, ["Status"]), statusButtons]),
        h("label", { class: "field" }, [
          h("span", {}, [`Magnitude · ${node.magnitude ?? 2}`]),
          magnitude,
        ]),
        h("label", { class: "field" }, [h("span", {}, ["Notes"]), notes]),
      ]),
      h("footer", { class: "editor-foot" }, [setNorth, deleteBtn]),
    );
  }

  function open(id) {
    currentId = id;
    panel.setAttribute("aria-hidden", id ? "false" : "true");
    panel.classList.toggle("open", Boolean(id));
    if (!id) {
      renderEmpty();
      return;
    }
    const node = store.get().nodes.find((n) => n.id === id);
    if (!node) {
      close();
      return;
    }
    renderForm(node);
  }

  function close() {
    currentId = null;
    board.select(null);
    panel.setAttribute("aria-hidden", "true");
    panel.classList.remove("open");
    renderEmpty();
  }

  store.subscribe((state) => {
    if (!currentId) return;
    const node = state.nodes.find((n) => n.id === currentId);
    if (!node) {
      close();
      return;
    }
    // Only re-render if title/status/type/magnitude changed via board/other UI.
    // We preserve focus by not re-rendering on every keystroke the user types
    // here: the input handlers update the store, and this callback would redraw.
    // Guard: skip if active element lives inside this panel.
    if (panel.contains(document.activeElement)) return;
    renderForm(node);
  });

  renderEmpty();

  return { open, close, toggle: () => open(currentId ? null : store.get().nodes[0]?.id) };
}
