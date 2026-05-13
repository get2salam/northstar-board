// shortcuts.js — keyboard shortcuts and help overlay.
// A single SHORTCUTS array drives both the bindings and the help modal,
// so the two can never drift apart.

function isTypingContext(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function matches(spec, e) {
  const needsMeta = spec.includes("mod");
  const pressedMeta = e.metaKey || e.ctrlKey;
  if (needsMeta !== pressedMeta) return false;
  if (spec.includes("alt") !== e.altKey) return false;
  const key = spec.split("+").pop();
  if (e.key.toLowerCase() !== key.toLowerCase()) return false;
  // Only enforce Shift for keys whose character changes with it (letters).
  // Punctuation like "?" or "!" already implies Shift on most layouts, so
  // requiring it in the spec would prevent the shortcut from ever firing.
  const shiftMattersForKey = /^[a-z]$/i.test(key);
  if (shiftMattersForKey && spec.includes("shift") !== e.shiftKey) return false;
  return true;
}

export function createShortcuts({ store, board, editor }) {
  const SHORTCUTS = [
    { spec: "n",           label: "Create a new star",           run: () => {
        const node = store.addNode({
          title: "New star",
          x: Math.round((Math.random() - 0.5) * 420),
          y: Math.round((Math.random() - 0.5) * 260),
        });
        board.select(node.id);
        editor.open(node.id);
      } },
    { spec: "e",           label: "Edit selected star",          run: () => {
        const id = board.getSelectedId();
        if (id) editor.open(id);
      } },
    { spec: "delete",      label: "Delete selected star",        run: () => {
        const id = board.getSelectedId();
        if (id) store.removeNode(id);
      } },
    { spec: "backspace",   label: "Delete selected star",        run: () => {
        const id = board.getSelectedId();
        if (id) store.removeNode(id);
      }, hidden: true },
    { spec: "escape",      label: "Deselect / close panel",      run: () => {
        editor.close();
        board.select(null);
      } },
    { spec: "f",           label: "Fit constellation to view",   run: () => board.fitToContent() },
    { spec: "0",           label: "Reset zoom",                  run: () => board.resetView() },
    { spec: "mod+s",       label: "Cycle selected star status",  run: () => {
        const id = board.getSelectedId();
        if (!id) return;
        const node = store.get().nodes.find((n) => n.id === id);
        const order = ["plan", "active", "done", "blocked"];
        const next = order[(order.indexOf(node.status) + 1) % order.length];
        store.updateNode(id, { status: next });
      } },
    { spec: "?",           label: "Show this help",              run: () => toggleHelp(true) },
    { spec: "h",           label: "Show this help",              run: () => toggleHelp(true), hidden: true },
  ];

  function onKey(e) {
    if (isTypingContext(e.target)) return;
    for (const sc of SHORTCUTS) {
      if (matches(sc.spec, e)) {
        e.preventDefault();
        sc.run();
        return;
      }
    }
  }

  document.addEventListener("keydown", onKey);

  // ---- help overlay ----
  const overlay = document.createElement("div");
  overlay.className = "help-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Keyboard shortcuts");
  overlay.hidden = true;

  const panel = document.createElement("div");
  panel.className = "help-panel";

  const title = document.createElement("h2");
  title.textContent = "Shortcuts";
  panel.appendChild(title);

  const tagline = document.createElement("p");
  tagline.className = "help-tagline";
  tagline.textContent = "Navigate the constellation without leaving home row.";
  panel.appendChild(tagline);

  const list = document.createElement("dl");
  list.className = "help-list";
  for (const sc of SHORTCUTS) {
    if (sc.hidden) continue;
    const dt = document.createElement("dt");
    for (const part of sc.spec.split("+")) {
      const kbd = document.createElement("kbd");
      kbd.textContent = part === "mod" ? "⌘/Ctrl" : part.length === 1 ? part.toUpperCase() : part;
      dt.appendChild(kbd);
    }
    const dd = document.createElement("dd");
    dd.textContent = sc.label;
    list.append(dt, dd);
  }
  panel.appendChild(list);

  const footer = document.createElement("div");
  footer.className = "help-footer";

  const reset = document.createElement("button");
  reset.className = "btn ghost tiny";
  reset.textContent = "Reset board";
  reset.addEventListener("click", () => {
    if (
      confirm(
        "Clear the board and start with a blank constellation? This cannot be undone.",
      )
    ) {
      store.reset();
      toggleHelp(false);
    }
  });

  const close = document.createElement("button");
  close.className = "btn primary tiny";
  close.textContent = "Close";
  close.addEventListener("click", () => toggleHelp(false));

  footer.append(reset, close);
  panel.appendChild(footer);

  overlay.appendChild(panel);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) toggleHelp(false);
  });
  document.body.appendChild(overlay);

  function toggleHelp(show) {
    overlay.hidden = !show;
  }

  return { toggleHelp };
}
