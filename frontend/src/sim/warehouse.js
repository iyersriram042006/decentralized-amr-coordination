import { mulberry32, randInt } from "./rng";

export const key = (c) => c[0] + "," + c[1];
export const parse = (k) => k.split(",").map(Number);
export const manhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

// Hand-designed warehouse: 2-wide rack blocks separated by 2-wide aisles (so
// robots can pass / step aside → liveness guaranteed), with a horizontal
// cross-aisle in the middle. A few aisles are pinched to 1-wide at the
// cross-aisle to form explicit choke points for the conflict scenarios.
export function createWarehouse(seed, width = 24, height = 18, chokeCount = 3, randomize = false) {
  const rng = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const staticSet = new Set();

  const topFree = 3;
  const bottomFree = 3;
  const midRow = Math.floor(height / 2);
  const rackTop = topFree;
  const rackBottom = height - bottomFree - 1;

  // rack blocks 2 wide, aisle 2 wide  → period 4
  const rackStarts = [];
  for (let x = 2; x + 1 <= width - 3; x += 4) rackStarts.push(x);

  const aisleCols = [];
  for (const s of rackStarts) {
    const a = s + 2;
    if (a + 1 <= width - 3) aisleCols.push(a); // left column of each 2-wide aisle
  }

  for (const sx of rackStarts) {
    for (let dx = 0; dx < 2; dx++) {
      for (let y = rackTop; y <= rackBottom; y++) {
        if (y === midRow) continue;
        if (randomize && rng() < 0.1 && y !== rackTop && y !== rackBottom) continue;
        staticSet.add(key([sx + dx, y]));
      }
    }
  }

  // pinch a few aisles to 1-wide at the cross-aisle → choke points
  const chokePoints = [];
  const n = Math.max(1, Math.min(chokeCount, aisleCols.length));
  for (let i = 0; i < n; i++) {
    const ax = aisleCols[Math.floor((i * aisleCols.length) / n)];
    staticSet.add(key([ax + 1, midRow])); // block the right column, leaving ax passable
    chokePoints.push([ax, midRow]);
  }

  const isStatic = (c) =>
    c[0] < 0 || c[1] < 0 || c[0] >= width || c[1] >= height || staticSet.has(key(c));

  const freeCells = [];
  for (let x = 0; x < width; x++)
    for (let y = 0; y < height; y++) if (!isStatic([x, y])) freeCells.push([x, y]);

  const storage = freeCells.filter((c) => c[0] <= Math.floor(width * 0.42) && c[1] > 0 && c[1] < height - 1);
  const packing = freeCells.filter((c) => c[0] >= Math.floor(width * 0.6) && c[1] < height - 1);
  const charging = [];
  for (let x = 2; x < 2 + Math.min(6, width - 4); x++)
    if (!isStatic([x, height - 1])) charging.push([x, height - 1]);
  const entry = freeCells.filter((c) => c[1] === 0).slice(0, 4);

  return {
    width,
    height,
    seed,
    staticSet,
    aisleCols,
    midRow,
    zones: { storage, packing, charging, entry },
    chokePoints,
    isStatic,
    freeCells,
  };
}
