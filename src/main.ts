import Graph from "graphology";
import Sigma from "sigma";
import randomLayout from "graphology-layout/random";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { stronglyConnectedComponents } from "graphology-components";
import { generate, type GraphNode } from "./grapher";
import projectList from "../public/projects.json" assert { type: "json" };
import { createNodeBorderProgram } from "@sigma/node-border";

export const PALETTE = [
  "#f97316",  // vivid orange
  "#22c55e",  // spring green
  "#d946ef",  // bright violet
  "#a16207",  // warm brown-gold
  "#ec4899",  // hot pink
  "#14b8a6",  // deep teal
  "#a855f7",  // purple-indigo (but well away from grey-blue)
  "#84cc16",  // chartreuse
] as const;
// export const DEFAULT_COLOR = "";
export const DEFAULT_COLOR = "#6b72b8"

// ---------- build the sidebar ----------
const menu = document.getElementById("menu")!;
const sigmaDiv = document.getElementById("sigma")!;
let renderer: Sigma | null = null;

projectList.forEach((name: string) => {
  const btn = document.createElement("button");
  btn.textContent = name;
  btn.addEventListener("click", () => loadProject(name, btn));
  menu.appendChild(btn);
});

// auto-load the first project for convenience
(menu.firstElementChild as HTMLButtonElement).click();

// ---------- dynamic loader ----------
async function loadProject(project: string, btn: HTMLButtonElement) {
  // highlight active button
  const buttons = menu.querySelectorAll("button");
  Array.from(buttons).forEach(b => b.classList.toggle("active", b === btn));

  // reset the sigma container
  sigmaDiv.textContent = "";

  // kill previous graph
  if (renderer) {
    renderer.kill();
    sigmaDiv.innerHTML = "";     // wipe canvas
    renderer = null;
  }

  const url =
    `https://raw.githubusercontent.com/l2beat/l2beat/refs/heads/main/packages/config/src/projects/${project}/ethereum/discovered.json`;

  console.log(`↳ Loading ${project}…`);
  try {
    const data: GraphNode[] = await generate(url);
    renderer = renderGraph(data);
    console.log(`✓ done(${data.length} contract nodes)`);
  } catch (err) {
    console.error(err);
    sigmaDiv.textContent = `Failed to load ${project}`;
  }
}

// ---------- graph builder ----------
function renderGraph(data: GraphNode[]): Sigma {
  const graph = new Graph({ type: "directed", multi: false });

  /* nodes */
  for (const { id, name } of data)
    if (!graph.hasNode(id))
      graph.addNode(id, { label: name, size: 4 });

  /* edges */
  for (const { id: source, next } of data)
    for (const target of next) {
      if (!graph.hasNode(target))
        graph.addNode(target, { label: "", size: 4 });

      if (!graph.hasEdge(source, target)) graph.addEdge(source, target);
    }

  /* degree-based sizing */
  graph.forEachNode(n =>
    graph.setNodeAttribute(n, "size", 4 + graph.inDegree(n)),
  );



  /* ---------- SCC colouring ---------- */
  const sccs = stronglyConnectedComponents(graph);
  const sccIdByNode = new Map<string, number>();
  sccs.forEach((comp, i) => comp.forEach(n => sccIdByNode.set(n, i)));

  /* base color for every node */
  sccs.forEach((comp, i) => {
    const color = comp.length > 1 ? PALETTE[i % PALETTE.length] : DEFAULT_COLOR;
    comp.forEach(n => graph.setNodeAttribute(n, "color", color));
  });

  graph.forEachNode((n, attr) => {
    if (attr.label === "") {
      graph.setNodeAttribute(n, "color", "#cbd2f0");
    }
  });

  /* mark minimal sources in gold outline & bump size */
  const hasIncoming: boolean[] = Array(sccs.length).fill(false);
  graph.forEachEdge((_e, _attr, s, t) => {
    const cs = sccIdByNode.get(s)!;
    const ct = sccIdByNode.get(t)!;
    if (cs !== ct) hasIncoming[ct] = true;
  });
  hasIncoming.forEach((incoming, i) => {
    if (!incoming) {
      const sourceId = sccs[i][0];
      graph.mergeNode(sourceId, {
        borderColor: "#FFD700",
        type: "border",
        size: 10
      });
    }
  });

  /* ---------- layout ---------- */
  randomLayout.assign(graph);
  forceAtlas2.assign(graph, { iterations: 1000 });

  /* ---------- interactive render ---------- */
  const sizeByScc = sccs.map(c => c.length);
  let hoveredScc: number | null = null;
  const r = new Sigma(graph, sigmaDiv, {
    nodeProgramClasses: {
      border: createNodeBorderProgram({
        borders: [
          { size: { attribute: "borderSize", defaultValue: 0.5 }, color: { attribute: "borderColor" } },
          { size: { fill: true }, color: { attribute: "color" } },
        ],
      }),
    },
    defaultEdgeColor: "#bbb",
    defaultEdgeType: "arrow",
    labelDensity: 0.07,
    edgeReducer(edge, data) {
      if (hoveredScc === null) return data;
      if (sizeByScc[hoveredScc] === 1) return data;

      const same =
        sccIdByNode.get(graph.source(edge)) === hoveredScc &&
        sccIdByNode.get(graph.target(edge)) === hoveredScc;

      return {
        ...data,
        hidden: !same,                      // hide edges outside the SCC
        color: same ? "#e31a1c" : data.color,
        size: same ? 2 : data.size,
      };
    },
    nodeReducer(node, data) {
      if (hoveredScc === null) return data;
      const same = sccIdByNode.get(node) === hoveredScc;
      return {
        ...data,
        label: same ? data.label : "",
        opacity: same ? 1 : 0.25,
      };
    },
  });

  r.on("enterNode", ({ node }) => {
    hoveredScc = sccIdByNode.get(node) ?? null;
    r.refresh();
  });
  r.on("leaveNode", () => {
    hoveredScc = null;
    r.refresh();
  });

  return r;
}
