import { haversine } from "./geo";

export interface Node {
  key: string;
  lat: number;
  lon: number;
}

// Group pilots into "gaggles": clusters where each member is within `thresholdM`
// (2D) of at least one other gaggle member (single-linkage via union-find).
export function gaggles(nodes: Node[], thresholdM = 2000): Map<string, number> {
  const parent = nodes.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dm = haversine(nodes[i].lat, nodes[i].lon, nodes[j].lat, nodes[j].lon);
      if (dm <= thresholdM) union(i, j);
    }
  }
  const roots = new Map<number, number>();
  const out = new Map<string, number>();
  let gid = 0;
  for (let i = 0; i < nodes.length; i++) {
    const r = find(i);
    if (!roots.has(r)) roots.set(r, gid++);
    out.set(nodes[i].key, roots.get(r)!);
  }
  return out;
}

// Order keys so that closest-together pilots are adjacent: group by gaggle,
// gaggles sorted by size (biggest first), members sorted by mutual proximity.
export function orderByProximity(nodes: Node[], g: Map<string, number>): string[] {
  const byGaggle = new Map<number, Node[]>();
  for (const n of nodes) {
    const id = g.get(n.key)!;
    (byGaggle.get(id) ?? byGaggle.set(id, []).get(id)!).push(n);
  }
  const groups = [...byGaggle.entries()].sort((a, b) => b[1].length - a[1].length);
  const out: string[] = [];
  for (const [, members] of groups) {
    // greedy nearest-neighbour chain within the gaggle
    const rem = members.slice();
    let cur = rem.shift()!;
    out.push(cur.key);
    while (rem.length) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < rem.length; i++) {
        const dm = haversine(cur.lat, cur.lon, rem[i].lat, rem[i].lon);
        if (dm < bd) { bd = dm; bi = i; }
      }
      cur = rem.splice(bi, 1)[0];
      out.push(cur.key);
    }
  }
  return out;
}
