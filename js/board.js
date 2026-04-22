// board.js — SVG constellation renderer.
// Draws nodes as stars, links as curved paths. Listens to store updates.

const SVG_NS = "http://www.w3.org/2000/svg";

// Base radius per magnitude (1 = dim, 4 = brilliant). Tuned to feel "starry".
const MAGNITUDE_RADIUS = { 1: 5, 2: 8, 3: 12, 4: 18 };

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function buildGlowFilter(id, stdDeviation, pad) {
  const filter = el("filter", {
    id,
    x: `${-pad}%`,
    y: `${-pad}%`,
    width: `${100 + pad * 2}%`,
    height: `${100 + pad * 2}%`,
  });
  filter.appendChild(el("feGaussianBlur", { stdDeviation, result: "b" }));
  const merge = el("feMerge");
  merge.appendChild(el("feMergeNode", { in: "b" }));
  merge.appendChild(el("feMergeNode", { in: "SourceGraphic" }));
  filter.appendChild(merge);
  return filter;
}

function curvedPath(a, b) {
  // Gentle quadratic bezier that bows perpendicular to the line.
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = -dy * 0.12;
  const ny = dx * 0.12;
  return `M ${a.x} ${a.y} Q ${mx + nx} ${my + ny} ${b.x} ${b.y}`;
}

export function createBoard(mountEl, store) {
  const svg = el("svg", {
    class: "board",
    xmlns: SVG_NS,
    preserveAspectRatio: "xMidYMid meet",
  });
  const viewBox = { x: -600, y: -400, w: 1200, h: 800 };
  const MIN_W = 300;
  const MAX_W = 4000;
  const applyViewBox = () => {
    svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  };
  applyViewBox();

  const defs = el("defs");
  defs.appendChild(buildGlowFilter("glow", "3", 50));
  defs.appendChild(buildGlowFilter("glow-strong", "7", 75));
  svg.appendChild(defs);

  const linksLayer = el("g", { class: "links" });
  const starsLayer = el("g", { class: "stars" });
  svg.append(linksLayer, starsLayer);
  mountEl.appendChild(svg);

  let selectedId = null;

  // ---- screen → board coordinates ----
  function toBoard(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    return {
      x: viewBox.x + rx * viewBox.w,
      y: viewBox.y + ry * viewBox.h,
    };
  }

  // ---- drag / pan / zoom ----
  let gesture = null; // { kind, ... }

  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const starEl = e.target.closest(".star");
    svg.setPointerCapture(e.pointerId);
    if (starEl) {
      const id = starEl.getAttribute("data-id");
      const node = store.get().nodes.find((n) => n.id === id);
      if (!node) return;
      const start = toBoard(e.clientX, e.clientY);
      gesture = {
        kind: "drag",
        id,
        offsetX: node.x - start.x,
        offsetY: node.y - start.y,
        moved: false,
      };
      starEl.classList.add("dragging");
    } else {
      gesture = {
        kind: "pan",
        startClient: { x: e.clientX, y: e.clientY },
        startView: { x: viewBox.x, y: viewBox.y },
      };
      svg.classList.add("panning");
    }
  });

  svg.addEventListener("pointermove", (e) => {
    if (!gesture) return;
    if (gesture.kind === "drag") {
      const p = toBoard(e.clientX, e.clientY);
      const nx = Math.round(p.x + gesture.offsetX);
      const ny = Math.round(p.y + gesture.offsetY);
      gesture.moved = true;
      // Live-update via the store so links follow.
      store.updateNode(gesture.id, { x: nx, y: ny });
    } else if (gesture.kind === "pan") {
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      viewBox.x = gesture.startView.x - (e.clientX - gesture.startClient.x) * scaleX;
      viewBox.y = gesture.startView.y - (e.clientY - gesture.startClient.y) * scaleY;
      applyViewBox();
    }
  });

  function endGesture(e) {
    if (!gesture) return;
    const starEl = svg.querySelector(`.star[data-id="${gesture.id}"]`);
    if (starEl) starEl.classList.remove("dragging");
    svg.classList.remove("panning");
    const wasDrag = gesture.kind === "drag" && gesture.moved;
    gesture = null;
    if (wasDrag) {
      // Suppress the click that will follow so we don't open the editor.
      svg.setAttribute("data-suppress-click", "1");
      setTimeout(() => svg.removeAttribute("data-suppress-click"), 0);
    }
    if (e && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  }

  svg.addEventListener("pointerup", endGesture);
  svg.addEventListener("pointercancel", endGesture);

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    const p = toBoard(e.clientX, e.clientY);
    const newW = Math.min(MAX_W, Math.max(MIN_W, viewBox.w * factor));
    const newH = (newW / viewBox.w) * viewBox.h;
    // Keep the cursor's board coordinate anchored during zoom.
    viewBox.x = p.x - ((p.x - viewBox.x) * newW) / viewBox.w;
    viewBox.y = p.y - ((p.y - viewBox.y) * newH) / viewBox.h;
    viewBox.w = newW;
    viewBox.h = newH;
    applyViewBox();
  }, { passive: false });

  function renderLinks(state, byId) {
    linksLayer.replaceChildren(
      ...state.links
        .map((link) => {
          const a = byId.get(link.from);
          const b = byId.get(link.to);
          if (!a || !b) return null;
          return el("path", {
            d: curvedPath(a, b),
            class: `link link-${link.kind}`,
            "data-id": link.id,
            fill: "none",
          });
        })
        .filter(Boolean),
    );
  }

  function renderStar(node, northstarId) {
    const isNorth = node.id === northstarId || node.type === "north";
    const r = MAGNITUDE_RADIUS[node.magnitude] ?? 8;
    const group = el("g", {
      class: [
        "star",
        `status-${node.status}`,
        `type-${node.type}`,
        isNorth ? "north" : "",
        node.id === selectedId ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" "),
      transform: `translate(${node.x} ${node.y})`,
      "data-id": node.id,
      tabindex: "0",
      role: "button",
      "aria-label": `${node.title} (${node.status})`,
    });

    group.appendChild(
      el("circle", {
        class: "halo",
        r: r * 3,
        filter: isNorth ? "url(#glow-strong)" : "url(#glow)",
      }),
    );
    group.appendChild(el("circle", { class: "core", r }));

    if (node.status === "active" || node.status === "done") {
      const ringR = r + 4;
      const circumference = 2 * Math.PI * ringR;
      group.appendChild(
        el("circle", {
          class: "ring",
          r: ringR,
          fill: "none",
          "stroke-dasharray":
            node.status === "done"
              ? "none"
              : `${circumference * 0.6} ${circumference}`,
        }),
      );
    }

    const label = el("text", {
      class: "label",
      y: r + 22,
      "text-anchor": "middle",
    });
    label.textContent = node.title;
    group.appendChild(label);

    group.addEventListener("click", (e) => {
      e.stopPropagation();
      if (svg.hasAttribute("data-suppress-click")) return;
      selectedId = node.id;
      render(store.get());
      mountEl.dispatchEvent(
        new CustomEvent("star:select", { detail: { id: node.id } }),
      );
    });

    return group;
  }

  function render(state) {
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    renderLinks(state, byId);
    starsLayer.replaceChildren(
      ...state.nodes.map((node) => renderStar(node, state.meta.northstar)),
    );
  }

  svg.addEventListener("click", () => {
    if (svg.hasAttribute("data-suppress-click")) return;
    if (selectedId === null) return;
    selectedId = null;
    render(store.get());
    mountEl.dispatchEvent(new CustomEvent("star:select", { detail: { id: null } }));
  });

  const unsubscribe = store.subscribe(render);

  function resetView() {
    viewBox.x = -600;
    viewBox.y = -400;
    viewBox.w = 1200;
    viewBox.h = 800;
    applyViewBox();
  }

  function fitToContent(padding = 120) {
    const nodes = store.get().nodes;
    if (!nodes.length) return resetView();
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    const w = Math.max(maxX - minX, 600);
    const h = Math.max(maxY - minY, 400);
    viewBox.x = minX - (w - (maxX - minX)) / 2;
    viewBox.y = minY - (h - (maxY - minY)) / 2;
    viewBox.w = w;
    viewBox.h = h;
    applyViewBox();
  }

  return {
    svg,
    destroy() {
      unsubscribe();
      svg.remove();
    },
    getSelectedId: () => selectedId,
    select(id) {
      selectedId = id;
      render(store.get());
    },
    resetView,
    fitToContent,
  };
}
