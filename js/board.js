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
    viewBox: "-600 -400 1200 800",
  });

  const defs = el("defs");
  defs.appendChild(buildGlowFilter("glow", "3", 50));
  defs.appendChild(buildGlowFilter("glow-strong", "7", 75));
  svg.appendChild(defs);

  const linksLayer = el("g", { class: "links" });
  const starsLayer = el("g", { class: "stars" });
  svg.append(linksLayer, starsLayer);
  mountEl.appendChild(svg);

  let selectedId = null;

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
    if (selectedId === null) return;
    selectedId = null;
    render(store.get());
    mountEl.dispatchEvent(new CustomEvent("star:select", { detail: { id: null } }));
  });

  const unsubscribe = store.subscribe(render);

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
  };
}
