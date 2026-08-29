// Hungarian algorithm (Kuhn-Munkres) for rectangular cost matrices.
// Returns array of [row, col] assignments minimizing total cost.
export function hungarian(costMatrix) {
  const rows = costMatrix.length;
  if (rows === 0) return [];
  const cols = costMatrix[0].length;
  const n = Math.max(rows, cols);
  const BIG = 1e9;

  // pad to square
  const cost = [];
  for (let i = 0; i < n; i++) {
    cost[i] = [];
    for (let j = 0; j < n; j++) {
      cost[i][j] = i < rows && j < cols ? costMatrix[i][j] : BIG;
    }
  }

  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = -1;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const result = [];
  for (let j = 1; j <= n; j++) {
    const i = p[j];
    if (i - 1 < rows && j - 1 < cols && costMatrix[i - 1][j - 1] < BIG) {
      result.push([i - 1, j - 1]);
    }
  }
  return result;
}
