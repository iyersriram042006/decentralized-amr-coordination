# PRD — Decentralized AMR Fleet Coordination (SIH 26123 / BEL)

## Original problem statement
Edge-AI Based Distributed Fleet Coordination for Autonomous Mobile Robots (AMRs) in Smart
Warehouses. User asked for a full interactive website: an intro landing page PLUS a functional
mission-control dashboard with a live warehouse simulation where users add AMRs, set parameters,
pick a problem scenario (collision / deadlock / blocked path), press Play, and watch robots move
and resolve the problem using the proposed algorithms. Dark high-tech mission-control theme.

## Architecture
- Frontend (React + Tailwind): landing page + dashboard. The entire simulation runs client-side,
  deterministic and tick-based (seeded PRNG), under `/app/frontend/src/sim/`:
  - `rng.js` (mulberry32), `warehouse.js` (grid/racks/aisles/zones/choke points),
    `astar.js` (A*), `hungarian.js` (Kuhn-Munkres), `engine.js` (SimulationEngine: broadcast
    channel + ACK, TM role + election/epoch/failover, Hungarian assignment, collision avoidance
    (TTC), deadlock detection (wait-for cycle) + resolution, D*-Lite-style incremental replan,
    battery FSM, event log, metrics, headless baseline-vs-system comparison).
  - `hooks/useSimulation.js` drives the engine (play/pause/step/speed) and scenario injection.
  - `components/sim/*` dashboard widgets; `pages/Landing.jsx`, `pages/Dashboard.jsx`.
- Backend (FastAPI + MongoDB): persistence only — `POST/GET /api/demo-requests`,
  `POST/GET /api/sim-runs`, `GET /api/`.

## User personas
- SIH judge / evaluator: watches scenarios and the measured success-criteria comparison.
- Warehouse operator (demo): adds/removes robots, injects tasks, blocks cells, triggers scenarios.

## Core requirements (static)
- ≥3 AMRs, decentralized (no central server), tick-based decisions, honest measured ≥20% goal.
- Four live sub-systems: collision avoidance, deadlock resolution, blocked-path rerouting,
  task reallocation. TM is a movable role with failover. ACK protocol with timeout + retry +
  fallback-to-queue (Wi-Fi dead-zone defense).

## Implemented (2026-06)
- Landing page: live auto-running hero grid, problem statement, four-problems, architecture,
  algorithms, success criteria, tech + edge-hardware mapping, team placeholders, Request Demo form.
- Dashboard: control bar (play/pause/step/reset/speed/tick), four-problem indicator cards,
  operator console (Scenarios / Fleet / Environment tabs), live warehouse grid (racks, aisles,
  zones, choke outlines, dynamic obstacles, dead-cell markers, robots with battery ring + TM badge,
  planned-path overlay), Task Manager panel (active TM, epoch, handover history), Battery panel,
  Robot Roster (search/filter/select), Event Log (filter/search/CSV export), Performance panel
  (baseline-vs-system Recharts + measured improvement callout, persisted to backend), footer metrics,
  Demo Mode toggle.
- 9 scenarios: free, head_on, choke_point, blocked_alt, blocked_noalt, battery_dead, tm_failover,
  bulk_hungarian, dead_zone.
- Verified: backend 10/10 pytest; frontend interactions confirmed by testing agent; headless
  comparison completes with a real measured improvement (~60%+ on tested seeds — reported honestly).

## Backlog / remaining
- P1: True D* Lite incremental repair (currently A* recompute labelled as incremental replan).
- P1: Record & Replay export/import of the event stream (Section 12.4) not yet surfaced in UI.
- P2: Pygame layer, one-way-aisle policies, per-trial results expandable table in Performance panel.
- P2: Split engine.js into submodules; scheduled-events queue instead of step() monkey-patch.

## Notes / honest limitations
- D* Lite replanning is approximated by incremental A* recompute (same visible reroute behavior).
- Baseline stop-and-wait uses an extra conservative wait-hold per conflict; improvement % varies by
  seed and is always the real measured value (Rule A), never hard-coded.
