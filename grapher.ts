/** A minimal node for graph libraries */
export interface GraphNode {
  name: string;          // contract name (or address if unnamed)
  id: string;            // its own address
  next: string[];        // addresses it references
}

/** Recursively collect every hex address string inside an object/array */
function collectAddresses(value: unknown, out: Set<string>) {
  const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

  if (value == null) return;

  if (typeof value === "string") {
    if (ADDRESS_REGEX.test(value)) out.add(value.toLowerCase());
  } else if (Array.isArray(value)) {
    value.forEach(v => collectAddresses(v, out));
  } else if (typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === "receivedPermissions") continue;        // ← skip this subtree entirely
      collectAddresses(v, out);
    }
  }
}

/** Convert the raw JSON into graph-friendly nodes */
function toNodes(raw: { entries: Array<Record<string, unknown>> }): GraphNode[] {
  return raw.entries
    .filter(e => e.type === "Contract")
    .map(e => {
      const id = (e.address as string).toLowerCase();
      const refs = new Set<string>();
      collectAddresses(e, refs);
      refs.delete(id);                                    // do not reference ourselves

      return {
        name: (e.name as string) || id,
        id,
        next: [...refs],
      };
    });
}

/** Fetch → transform → **return the array** (no disk I/O) */
export async function generate(url: string): Promise<GraphNode[]> {
  console.error("Fetching data from GitHub…");
  const r = await fetch(url);
  console.log(`${r.status} ${r.statusText} (${r.headers.get("content-type")})`);

  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);

  const raw = (await r.json()) as { entries: Array<Record<string, unknown>> };
  console.error(`Fetched ${raw.entries.length} entries`);

  const nodes = toNodes(raw);
  console.error(`Generated ${nodes.length} nodes`);

  return nodes;
}

