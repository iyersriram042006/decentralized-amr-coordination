import { key, manhattan } from "./warehouse";

// A* on 4-connected grid. isBlocked(cell) returns true for static + dynamic obstacles.
// Returns path [start..goal] inclusive, or null.
export function astar(warehouse, start, goal, isBlocked) {
  const { width, height } = warehouse;
  const inBounds = (c) => c[0] >= 0 && c[1] >= 0 && c[0] < width && c[1] < height;
  const sK = key(start);
  const gK = key(goal);
  if (sK === gK) return [start];

  const open = new Map(); // key -> f
  const gScore = new Map();
  const came = new Map();
  gScore.set(sK, 0);
  open.set(sK, manhattan(start, goal));

  const nbrs = (c) => [
    [c[0] + 1, c[1]],
    [c[0] - 1, c[1]],
    [c[0], c[1] + 1],
    [c[0], c[1] - 1],
  ];

  let guard = 0;
  const maxIter = width * height * 4;
  while (open.size > 0 && guard++ < maxIter) {
    // pop lowest f
    let curK = null;
    let curF = Infinity;
    for (const [k, f] of open) if (f < curF) ((curF = f), (curK = k));
    open.delete(curK);
    if (curK === gK) {
      const path = [];
      let k = curK;
      while (k !== undefined) {
        path.push(k.split(",").map(Number));
        k = came.get(k);
      }
      return path.reverse();
    }
    const cur = curK.split(",").map(Number);
    const g = gScore.get(curK);
    for (const n of nbrs(cur)) {
      if (!inBounds(n)) continue;
      const nK = key(n);
      // allow goal even if it is a "blocked" pickup/drop face? goal is always free here.
      if (isBlocked(n) && nK !== gK) continue;
      const tentative = g + 1;
      if (tentative < (gScore.has(nK) ? gScore.get(nK) : Infinity)) {
        came.set(nK, curK);
        gScore.set(nK, tentative);
        open.set(nK, tentative + manhattan(n, goal));
      }
    }
  }
  return null;
}
