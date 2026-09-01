import { mulberry32, randInt } from "./rng";
import { createWarehouse, key, manhattan } from "./warehouse";
import { astar } from "./astar";
import { hungarian } from "./hungarian";

// ─── Config: single source of truth for every tunable constant ──────────────
export const CONFIG = {
  BATTERY_LOW_THRESHOLD: 20,
  BATTERY_CRITICAL_THRESHOLD: 10,
  MOVE_BATTERY_COST: 0.35,
  WAIT_BATTERY_COST: 0.15,
  IDLE_BATTERY_COST: 0.08,
  CHARGE_RATE: 6,

  URGENCY_WEIGHT: 120,

  TTC_SLOW_DOWN_TICKS: 5,
  TTC_STOP_TICKS: 2,
  MIN_SAFE_DISTANCE_CELLS: 1.5,

  TM_LIVENESS_TIMEOUT_TICKS: 8,
  ASSIGNMENT_BATCH_INTERVAL_TICKS: 5,
  ASSIGNMENT_QUEUE_TRIGGER_SIZE: 4,

  TRAVEL_COST_WEIGHT: 1.0,
  PRIORITY_PENALTY_WEIGHT: 40.0,
  BATTERY_PENALTY_WEIGHT: 0.35,

  ACK_TIMEOUT_TICKS: 4,
  ACK_MAX_RETRIES: 1,

  MIN_FLEET_SIZE: 3,
};

export const STATUS = {
  IDLE: "idle",
  MOVING: "moving",
  WAITING: "waiting",
  BLOCKED: "blocked",
  REROUTING: "rerouting",
  CHARGING: "charging",
  ERROR: "error",
};

export const BATTERY_STATE = {
  NORMAL: "normal",
  LOW: "low",
  CRITICAL: "critical",
  DEAD: "dead",
};

// ─── Priority (Section 7): one shared function used everywhere ──────────────
export function priorityScore(task, tick, urgencyWeight = CONFIG.URGENCY_WEIGHT) {
  if (!task) return 0;
  const timeRemaining = task.deadline - tick;
  if (timeRemaining <= 0) return Infinity;
  return urgencyWeight * (1 / timeRemaining);
}

// resolve winner among candidate broadcast states (higher priority wins,
// tie-break earliest reservation tick, final tie-break lowest robot_id)
function resolvePriority(candidates, tick) {
  let best = null;
  for (const c of candidates) {
    const ps = priorityScore(c.current_task, tick);
    if (
      best === null ||
      ps > best.ps ||
      (ps === best.ps && (c.reservationTick ?? Infinity) < best.res) ||
      (ps === best.ps && (c.reservationTick ?? Infinity) === best.res && c.robot_id < best.id)
    ) {
      best = { id: c.robot_id, ps, res: c.reservationTick ?? Infinity };
    }
  }
  return best ? best.id : null;
}

function ttcBetween(posA, velA, posB, velB) {
  const rpx = posB[0] - posA[0];
  const rpy = posB[1] - posA[1];
  const rvx = velB[0] - velA[0];
  const rvy = velB[1] - velA[1];
  const denom = rvx * rvx + rvy * rvy;
  const dist0 = Math.hypot(rpx, rpy);
  if (denom === 0) return dist0 <= CONFIG.MIN_SAFE_DISTANCE_CELLS ? 0 : Infinity;
  const t = -(rpx * rvx + rpy * rvy) / denom;
  if (t < 0) return Infinity;
  const cx = rpx + rvx * t;
  const cy = rpy + rvy * t;
  const closest = Math.hypot(cx, cy);
  if (closest <= CONFIG.MIN_SAFE_DISTANCE_CELLS) return t;
  return Infinity;
}

let ROBOT_COUNTER = 0;

export class SimulationEngine {
  constructor(opts = {}) {
    this.baseSeed = opts.seed ?? 42;
    this.mode = opts.mode ?? "system"; // "system" | "baseline"
    this.width = opts.width ?? 24;
    this.height = opts.height ?? 18;
    this.chokeCount = opts.chokeCount ?? 3;
    this.randomLayout = opts.randomLayout ?? false;
    this.commLoss = opts.commLoss ?? 0; // probability a message is lost (dead-zone demo)
    this._subs = [];
    this.reset(opts.robotConfigs);
  }

  reset(robotConfigs) {
    this.rng = mulberry32(this.baseSeed >>> 0);
    this.warehouse = createWarehouse(
      this.baseSeed,
      this.width,
      this.height,
      this.chokeCount,
      this.randomLayout
    );
    this.tick = 0;
    this.tmEpoch = 0;
    this.tmId = null;
    this.dynamic = new Map(); // key -> {until}
    this.tasks = [];
    this.taskSeq = 0;
    this.pending = []; // acknowledgeable messages in-flight
    this.eventLog = [];
    this.channel = {}; // robot_id -> latest broadcast state
    this.metrics = {
      completed: 0,
      collisionsAvoided: 0,
      deadlocksResolved: 0,
      reroutes: 0,
      reallocations: 0,
      tmHandovers: 0,
      ackTimeouts: 0,
    };
    this.indicators = { collision: 0, deadlock: 0, blocked: 0, reallocation: 0 };
    this.tickIndicators = { collision: false, deadlock: false, blocked: false, reallocation: false };
    this._activeCollisions = new Set();
    this._activeDeadlocks = new Set();
    this.completionTicks = [];

    // robots
    this.robots = [];
    ROBOT_COUNTER = 0;
    const configs = robotConfigs || this._defaultRobotConfigs();
    for (const cfg of configs) this._spawnRobot(cfg);

    // seed initial tasks
    const initial = 6;
    for (let i = 0; i < initial; i++) this._createTask();
    this._nextArrival = randInt(this.rng, 8, 16);

    this._electInitialTM();
    this._publishAll();
    return this.getSnapshot();
  }

  _defaultRobotConfigs() {
    const ch = this.warehouse.zones.charging;
    const bottom = this.warehouse.freeCells.filter((c) => c[1] >= this.height - 3);
    const spots = [];
    const used = new Set();
    const cand = [...ch, ...bottom];
    for (const c of cand) {
      if (spots.length >= 4) break;
      if (!used.has(key(c))) {
        used.add(key(c));
        spots.push(c);
      }
    }
    return [
      { position: spots[0] || [2, this.height - 1], battery: 100, priorityClass: "high" },
      { position: spots[1] || [3, this.height - 1], battery: 95, priorityClass: "standard" },
      { position: spots[2] || [4, this.height - 1], battery: 88, priorityClass: "standard" },
      { position: spots[3] || [5, this.height - 1], battery: 100, priorityClass: "standard" },
    ];
  }

  _spawnRobot(cfg) {
    const idNum = ++ROBOT_COUNTER;
    const id = cfg.id || "R" + idNum;
    const robot = {
      robot_id: id,
      position: cfg.position ? [...cfg.position] : [2, this.height - 1],
      velocity: [0, 0],
      battery: cfg.battery ?? 100,
      battery_state: BATTERY_STATE.NORMAL,
      status: STATUS.IDLE,
      is_task_manager: false,
      priority_class: cfg.priorityClass || "standard",
      tm_eligible: cfg.tmEligible !== false,
      current_task: null,
      planned_path: [],
      pathIndex: 0,
      reserved_cells: [],
      planned_start_time: 0,
      tm_epoch: 0,
      last_broadcast_tick: 0,
      reservationTick: null,
      alive: true,
      _pendingAssignment: null,
    };
    this._updateBatteryState(robot);
    this.robots.push(robot);
    return robot;
  }

  addRobot(cfg = {}) {
    if (!cfg.position) {
      const free = this.warehouse.freeCells.filter(
        (c) => !this.robots.some((r) => r.position[0] === c[0] && r.position[1] === c[1])
      );
      cfg.position = free[randInt(this.rng, 0, free.length - 1)];
    }
    const r = this._spawnRobot(cfg);
    this._log("Fleet", `Robot ${r.robot_id} joined the fleet at [${r.position}]`, "info");
    this._publishRobot(r);
    return r.robot_id;
  }

  removeRobot(id) {
    if (this.robots.filter((r) => r.alive).length <= CONFIG.MIN_FLEET_SIZE) {
      this._log("Fleet", `Cannot remove ${id}: minimum fleet size is ${CONFIG.MIN_FLEET_SIZE}`, "warn");
      return false;
    }
    const r = this.robots.find((x) => x.robot_id === id);
    if (!r) return false;
    if (r.current_task) this._releaseTask(r, "robot removed");
    this.robots = this.robots.filter((x) => x.robot_id !== id);
    delete this.channel[id];
    if (this.tmId === id) this._forceElection("TM robot removed");
    this._log("Fleet", `Robot ${id} removed from fleet`, "warn");
    return true;
  }

  // ─── Task lifecycle ────────────────────────────────────────────────────
  _createTask(opts = {}) {
    const { storage, packing } = this.warehouse.zones;
    if (!storage.length || !packing.length) return null;
    const pickup = opts.pickup || storage[randInt(this.rng, 0, storage.length - 1)];
    const dropoff = opts.dropoff || packing[randInt(this.rng, 0, packing.length - 1)];
    const id = "T" + ++this.taskSeq;
    const deadline = this.tick + (opts.deadline || randInt(this.rng, 60, 140));
    const task = {
      id,
      pickup: [...pickup],
      dropoff: [...dropoff],
      deadline,
      status: "pending",
      phase: "to_pickup",
      assignedTo: null,
      createdTick: this.tick,
    };
    this.tasks.push(task);
    return task;
  }

  injectTasks(n = 4) {
    for (let i = 0; i < n; i++) this._createTask();
    this._log("Task Assignment", `Injected ${n} new tasks into the queue`, "info");
  }

  _unassignedTasks() {
    return this.tasks.filter((t) => t.status === "pending");
  }

  // ─── Communication channel (broadcast) ─────────────────────────────────
  _publishRobot(r) {
    if (!r.alive) return;
    r.last_broadcast_tick = this.tick;
    this.channel[r.robot_id] = {
      robot_id: r.robot_id,
      position: [...r.position],
      velocity: [...r.velocity],
      battery: r.battery,
      battery_state: r.battery_state,
      status: r.status,
      is_task_manager: r.is_task_manager,
      priority_class: r.priority_class,
      current_task: r.current_task ? { ...r.current_task } : null,
      planned_path: r.planned_path.slice(0, 8),
      planned_start_time: r.planned_start_time,
      reservationTick: r.reservationTick,
      tm_epoch: r.tm_epoch,
      tick: this.tick,
    };
  }

  _publishAll() {
    for (const r of this.robots) this._publishRobot(r);
  }

  _otherStates(excludeId) {
    const out = {};
    for (const [id, s] of Object.entries(this.channel)) if (id !== excludeId) out[id] = s;
    return out;
  }

  _deliver() {
    return this.commLoss <= 0 || this.rng() > this.commLoss;
  }

  // ─── Task Manager election & liveness (Section 3) ──────────────────────
  _aliveRobots() {
    return this.robots.filter((r) => r.alive && r.battery > 0);
  }

  _electInitialTM() {
    const alive = this._aliveRobots().filter((r) => r.tm_eligible);
    if (!alive.length) return;
    alive.sort((a, b) => a.robot_id.localeCompare(b.robot_id, undefined, { numeric: true }));
    this._assignTM(alive[0], "initial election");
  }

  _assignTM(robot, reason) {
    const old = this.tmId;
    for (const r of this.robots) r.is_task_manager = false;
    this.tmEpoch += 1;
    robot.is_task_manager = true;
    robot.tm_epoch = this.tmEpoch;
    this.tmId = robot.robot_id;
    if (old && old !== robot.robot_id) {
      this.metrics.tmHandovers += 1;
      this._emit("TaskManagerHandover", { old_tm: old, new_tm: robot.robot_id, reason });
      this._log("TM", `Handover: ${old} → ${robot.robot_id} (${reason}), epoch ${this.tmEpoch}`, "tm");
    } else {
      this._log("TM", `${robot.robot_id} is Task Manager (epoch ${this.tmEpoch})`, "tm");
    }
  }

  _checkTMLiveness() {
    if (!this.tmId) {
      this._forceElection("no active TM");
      return;
    }
    const tmState = this.channel[this.tmId];
    const tmRobot = this.robots.find((r) => r.robot_id === this.tmId);
    const live =
      tmRobot && tmRobot.alive && tmRobot.battery > 0 &&
      tmState && this.tick - tmState.tick <= CONFIG.TM_LIVENESS_TIMEOUT_TICKS;
    if (!live) this._forceElection("TM liveness timeout");
  }

  _forceElection(reason) {
    const alive = this._aliveRobots().filter((r) => r.tm_eligible);
    if (!alive.length) {
      this.tmId = null;
      return;
    }
    alive.sort((a, b) => a.robot_id.localeCompare(b.robot_id, undefined, { numeric: true }));
    if (alive[0].robot_id !== this.tmId) this._assignTM(alive[0], reason);
  }

  // ─── Hungarian batch assignment, run by the TM (Section 5) ─────────────
  _runAssignment() {
    const tm = this.robots.find((r) => r.robot_id === this.tmId);
    if (!tm || !tm.alive) return;
    const unassigned = this._unassignedTasks();
    if (!unassigned.length) return;

    // free robots read from broadcast channel (Rule B)
    const freeStates = Object.values(this.channel).filter(
      (s) =>
        !s.current_task &&
        s.battery_state !== BATTERY_STATE.CRITICAL &&
        s.battery_state !== BATTERY_STATE.DEAD &&
        s.status !== STATUS.CHARGING
    );
    if (!freeStates.length) return;

    const matrix = unassigned.map((task) =>
      freeStates.map((s) => {
        const travel = manhattan(s.position, task.pickup) + manhattan(task.pickup, task.dropoff);
        const ps = priorityScore(task, this.tick);
        const priorityPenalty = CONFIG.PRIORITY_PENALTY_WEIGHT * (1 / (1 + (ps === Infinity ? 1e6 : ps)));
        const batteryPenalty = CONFIG.BATTERY_PENALTY_WEIGHT * (100 - s.battery);
        return (
          CONFIG.TRAVEL_COST_WEIGHT * travel + priorityPenalty + batteryPenalty
        );
      })
    );

    let assignments;
    if (this.mode === "baseline") {
      // naive nearest-robot greedy (no optimization)
      assignments = [];
      const usedR = new Set();
      for (let ti = 0; ti < unassigned.length; ti++) {
        let bestJ = -1;
        let bestC = Infinity;
        for (let j = 0; j < freeStates.length; j++) {
          if (usedR.has(j)) continue;
          const c = manhattan(freeStates[j].position, unassigned[ti].pickup);
          if (c < bestC) ((bestC = c), (bestJ = j));
        }
        if (bestJ >= 0) {
          usedR.add(bestJ);
          assignments.push([ti, bestJ]);
        }
      }
    } else {
      assignments = hungarian(matrix);
    }

    let totalCost = 0;
    let naiveCost = 0;
    const applied = [];
    for (const [ti, ri] of assignments) {
      const task = unassigned[ti];
      const state = freeStates[ri];
      if (!task || !state) continue;
      totalCost += matrix[ti][ri];
      naiveCost += manhattan(state.position, task.pickup);
      // broadcast assignment with ack (Rule C)
      this._publishWithAck({
        type: "ASSIGNMENT",
        task_id: task.id,
        robot_id: state.robot_id,
        tm_epoch: this.tmEpoch,
      });
      task.status = "assigned";
      task.assignedTo = state.robot_id;
      applied.push({ task_id: task.id, robot_id: state.robot_id });
    }
    if (applied.length) {
      this._emit("TaskAssignment", {
        batch_size: applied.length,
        assignments: applied,
        total_cost: Number(totalCost.toFixed(1)),
        naive_cost_estimate: naiveCost,
      });
      this._log(
        "Task Assignment",
        `${this.mode === "baseline" ? "Nearest-robot" : "Hungarian"} batch: ${applied
          .map((a) => `${a.task_id}→${a.robot_id}`)
          .join(", ")} (cost ${totalCost.toFixed(1)})`,
        "assign"
      );
    }
  }

  _publishWithAck(message) {
    const id = "msg_" + (this.pending.length + this.taskSeq * 3 + this.tick);
    const msg = { ...message, message_id: id, sent_tick: this.tick, retries: 0, delivered: this._deliver() };
    this.pending.push(msg);
    if (msg.delivered) this._applyMessage(msg);
    else this._log("ACK Timeout", `Message ${id} (${message.type}) lost in transit (dead-zone)`, "ack");
    return id;
  }

  _applyMessage(msg) {
    if (msg.type === "ASSIGNMENT") {
      const r = this.robots.find((x) => x.robot_id === msg.robot_id);
      const task = this.tasks.find((t) => t.id === msg.task_id);
      if (!r || !task) return;
      // reject stale epoch (Section 3)
      if (msg.tm_epoch < r.tm_epoch) return;
      r.tm_epoch = Math.max(r.tm_epoch, msg.tm_epoch);
      r._pendingAssignment = { task, ackId: msg.message_id, ackFrom: r.robot_id };
    } else if (msg.type === "RELEASE") {
      // TM receives release; acknowledges
      const task = this.tasks.find((t) => t.id === msg.task_id);
      if (task) {
        task.status = "pending";
        task.assignedTo = null;
      }
      msg._releaseAckPending = true;
    }
  }

  _processAcks() {
    const still = [];
    for (const msg of this.pending) {
      if (msg._acked) continue;
      // did the corresponding robot apply & ack?
      if (msg.type === "ASSIGNMENT") {
        const r = this.robots.find((x) => x.robot_id === msg.robot_id);
        if (r && r.current_task && r.current_task.id === msg.task_id) {
          // ack delivered?
          if (this._deliver()) {
            msg._acked = true;
            continue;
          }
        }
      } else if (msg.type === "RELEASE" && msg._releaseAckPending) {
        if (this._deliver()) {
          msg._acked = true;
          continue;
        }
      }
      // timeout?
      if (this.tick - msg.sent_tick >= CONFIG.ACK_TIMEOUT_TICKS) {
        if (msg.retries < CONFIG.ACK_MAX_RETRIES) {
          msg.retries += 1;
          msg.sent_tick = this.tick;
          msg.delivered = this._deliver();
          this._emit("AckTimeout", {
            message_id: msg.message_id,
            message_type: msg.type,
            from_robot: msg.robot_id || this.tmId,
            to_robot: msg.type === "ASSIGNMENT" ? msg.robot_id : this.tmId,
            retry_count: msg.retries,
          });
          this.metrics.ackTimeouts += 1;
          this._log("ACK Timeout", `${msg.type} ${msg.message_id} timed out — retry ${msg.retries}`, "ack");
          if (msg.delivered) this._applyMessage(msg);
          still.push(msg);
        } else {
          // fallback: return task to queue
          this._emit("AckTimeout", {
            message_id: msg.message_id,
            message_type: msg.type,
            from_robot: msg.robot_id || this.tmId,
            to_robot: msg.type === "ASSIGNMENT" ? msg.robot_id : this.tmId,
            retry_count: msg.retries + 1,
          });
          this.metrics.ackTimeouts += 1;
          const task = this.tasks.find((t) => t.id === msg.task_id);
          if (task && task.status !== "in_progress" && task.status !== "completed") {
            task.status = "pending";
            task.assignedTo = null;
          }
          this._log(
            "ACK Timeout",
            `${msg.type} ${msg.message_id} failed after retry — task ${msg.task_id} returned to queue`,
            "ack"
          );
        }
      } else {
        still.push(msg);
      }
    }
    this.pending = still;
  }

  _applyPendingAssignments() {
    for (const r of this.robots) {
      if (r._pendingAssignment) {
        const { task } = r._pendingAssignment;
        // never overwrite a robot that is already working a task or is unavailable
        if (r._task || !r.alive || r.status === STATUS.CHARGING) {
          if (task.status === "assigned") {
            task.status = "pending";
            task.assignedTo = null;
          }
          r._pendingAssignment = null;
          continue;
        }
        if (task.status === "assigned" || task.status === "pending") {
          r.current_task = {
            id: task.id,
            pickup: [...task.pickup],
            drop: [...task.dropoff],
            priority: priorityScore(task, this.tick),
            deadline: task.deadline,
          };
          task.status = "in_progress";
          task.assignedTo = r.robot_id;
          r.status = STATUS.MOVING;
          this._planTo(r, task.pickup);
          r._task = task;
          r._task.phase = "to_pickup";
        }
        r._pendingAssignment = null;
      }
    }
  }

  _releaseTask(robot, reason) {
    if (!robot._task && !robot.current_task) return;
    const task = robot._task || this.tasks.find((t) => t.id === robot.current_task?.id);
    if (task) {
      // robot broadcasts release request to TM (ack required)
      this._publishWithAck({ type: "RELEASE", task_id: task.id, robot_id: robot.robot_id, tm_epoch: robot.tm_epoch });
      task.status = "pending";
      task.assignedTo = null;
      this.metrics.reallocations += 1;
      this.indicators.reallocation += 1;
      this.tickIndicators.reallocation = true;
      this._emit("Reallocation", { task_id: task.id, from_robot: robot.robot_id, to_robot: "queue", cost_c1: 0, cost_c2: 0 });
      this._log("Task Reallocation", `${robot.robot_id} released ${task.id} (${reason})`, "realloc");
    }
    robot.current_task = null;
    robot._task = null;
    robot.planned_path = [];
    robot.pathIndex = 0;
  }

  // ─── Path planning (A*) + D* Lite-style incremental replan ─────────────
  _blockedFn(ignore) {
    const dyn = this.dynamic;
    const w = this.warehouse;
    return (c) => {
      if (w.isStatic(c)) return true;
      const k = key(c);
      const d = dyn.get(k);
      if (d && (d.until === null || d.until > this.tick)) return true;
      return false;
    };
  }

  _planTo(robot, goal) {
    const path = astar(this.warehouse, robot.position, goal, this._blockedFn());
    if (path) {
      robot.planned_path = path;
      robot.pathIndex = 0;
      robot.planned_start_time = this.tick;
      robot.reservationTick = this.tick;
      return true;
    }
    robot.planned_path = [robot.position];
    robot.pathIndex = 0;
    return false;
  }

  // incremental replan around newly discovered obstacle (D* Lite role)
  _replan(robot, goal) {
    const path = astar(this.warehouse, robot.position, goal, this._blockedFn());
    if (path && path.length > 1) {
      const old = robot.planned_path;
      robot.planned_path = path;
      robot.pathIndex = 0;
      robot.status = STATUS.REROUTING;
      this.metrics.reroutes += 1;
      this.indicators.blocked += 1;
      this.tickIndicators.blocked = true;
      this._emit("Reroute", { robot_id: robot.robot_id, old_path: old.slice(0, 4), new_path: path.slice(0, 4), cost: path.length });
      this._log("Blocked Path / Rerouting", `${robot.robot_id} rerouted via D* Lite around obstacle (new len ${path.length})`, "reroute");
      return true;
    }
    return false;
  }

  _currentGoal(robot) {
    if (robot.status === STATUS.CHARGING && robot._chargingTarget) return robot._chargingTarget;
    if (!robot._task) return null;
    return robot._task.phase === "to_pickup" ? robot._task.pickup : robot._task.dropoff;
  }

  // ─── Battery manager (Section 9) ───────────────────────────────────────
  _updateBatteryState(robot) {
    const b = robot.battery;
    let s;
    if (b <= 0) s = BATTERY_STATE.DEAD;
    else if (b < CONFIG.BATTERY_CRITICAL_THRESHOLD) s = BATTERY_STATE.CRITICAL;
    else if (b < CONFIG.BATTERY_LOW_THRESHOLD) s = BATTERY_STATE.LOW;
    else s = BATTERY_STATE.NORMAL;
    const changed = s !== robot.battery_state;
    const old = robot.battery_state;
    robot.battery_state = s;
    return changed ? old : null;
  }

  _handleBattery(robot) {
    const old = this._updateBatteryState(robot);
    if (old) {
      this._emit("Battery", { robot_id: robot.robot_id, old_state: old, new_state: robot.battery_state });
      this._log("Battery", `${robot.robot_id}: ${old} → ${robot.battery_state} (${robot.battery.toFixed(0)}%)`,
        robot.battery_state === BATTERY_STATE.DEAD ? "critical" : robot.battery_state === BATTERY_STATE.CRITICAL ? "critical" : "battery");
    }
    if (robot.battery_state === BATTERY_STATE.DEAD && robot.alive) {
      robot.alive = false;
      robot.status = STATUS.ERROR;
      robot.velocity = [0, 0];
      this._releaseTask(robot, "battery dead");
      this.dynamic.set(key(robot.position), { until: null, dead: robot.robot_id });
      delete this.channel[robot.robot_id];
      this._log("Battery", `${robot.robot_id} is DEAD — cell [${robot.position}] is now an obstacle`, "critical");
      if (this.tmId === robot.robot_id) this._forceElection("TM battery dead");
    } else if (robot.battery_state === BATTERY_STATE.CRITICAL && robot.status !== STATUS.CHARGING) {
      // CRITICAL: refuse/return any current task, then route to nearest charging point
      if (robot._task) this._releaseTask(robot, "battery critical");
      const ch = this._nearestCharging(robot.position);
      if (ch) {
        this._planTo(robot, ch);
        robot.status = STATUS.CHARGING;
        robot._chargingTarget = ch;
        this._log("Battery", `${robot.robot_id} CRITICAL — routing to charging point [${ch}]`, "critical");
      }
    } else if (
      robot.battery_state === BATTERY_STATE.LOW &&
      !robot._task &&
      robot.status !== STATUS.CHARGING
    ) {
      // LOW + idle: opportunistically top up before it becomes critical far from a charger
      const ch = this._nearestCharging(robot.position);
      if (ch) {
        this._planTo(robot, ch);
        robot.status = STATUS.CHARGING;
        robot._chargingTarget = ch;
      }
    }
  }

  _nearestCharging(pos) {
    const ch = this.warehouse.zones.charging;
    if (!ch.length) return null;
    // charging cells already occupied or already targeted by another robot
    const taken = new Set();
    for (const r of this.robots) {
      if (!r.alive) continue;
      if (r.status === STATUS.CHARGING && r._chargingTarget) taken.add(key(r._chargingTarget));
      if (ch.some((c) => c[0] === r.position[0] && c[1] === r.position[1])) taken.add(key(r.position));
    }
    let best = null;
    let bestD = Infinity;
    for (const c of ch) {
      if (taken.has(key(c))) continue;
      const d = manhattan(pos, c);
      if (d < bestD) ((bestD = d), (best = c));
    }
    if (best) return best;
    // fallback: nearest even if contended (better than nothing)
    for (const c of ch) {
      const d = manhattan(pos, c);
      if (d < bestD) ((bestD = d), (best = c));
    }
    return best;
  }

  recoverRobot(id, level = 100) {
    const r = this.robots.find((x) => x.robot_id === id);
    if (!r) return;
    r.battery = level;
    r.alive = true;
    r.status = STATUS.IDLE;
    this._updateBatteryState(r);
    this.dynamic.delete(key(r.position));
    this._publishRobot(r);
    this._log("Battery", `${id} recovered to ${level}% and returned to service`, "info");
  }

  killBattery(id) {
    const r = this.robots.find((x) => x.robot_id === id);
    if (!r) return;
    r.battery = 0;
    this._log("Battery", `${id} battery forced to 0% (manual)`, "critical");
    this._handleBattery(r);
    this._publishRobot(r);
  }

  blockCell(cell, duration = 30) {
    this.dynamic.set(key(cell), { until: duration ? this.tick + duration : null });
    this._log("Blocked Path / Rerouting", `Cell [${cell}] blocked for ${duration} ticks`, "reroute");
  }

  unblockCell(cell) {
    this.dynamic.delete(key(cell));
  }

  regenerateWarehouse(opts = {}) {
    if (opts.seed !== undefined) this.baseSeed = opts.seed;
    if (opts.width) this.width = opts.width;
    if (opts.height) this.height = opts.height;
    if (opts.chokeCount) this.chokeCount = opts.chokeCount;
    if (opts.randomLayout !== undefined) this.randomLayout = opts.randomLayout;
    this.reset();
  }

  // ─── Movement, collision avoidance & deadlock (Section 10) ─────────────
  _stepMovement() {
    this.tickIndicators = { collision: false, deadlock: false, blocked: false, reallocation: this.tickIndicators.reallocation };

    const active = this.robots.filter(
      (r) =>
        r.alive &&
        (r._task || r.status === STATUS.CHARGING) &&
        r.planned_path.length > 1 &&
        r.pathIndex < r.planned_path.length - 1
    );

    // detect blocked next cells -> reroute (system) or wait (baseline)
    for (const r of active) {
      const next = r.planned_path[r.pathIndex + 1];
      if (!next) continue;
      const blockedFn = this._blockedFn();
      if (blockedFn(next)) {
        if (this.mode === "system") {
          const goal = this._currentGoal(r);
          if (!this._replan(r, goal)) {
            r.status = STATUS.BLOCKED;
            // no alternate: request reallocation if cost favors it
            this._releaseTask(r, "no alternate route");
          }
        } else {
          r.status = STATUS.WAITING; // baseline: stop-and-wait
        }
      }
    }

    // recompute intents
    const intents = new Map(); // id -> nextcell
    const desired = new Map();
    const posOf = new Map();
    for (const r of this.robots) posOf.set(r.robot_id, r.position);
    for (const r of active) {
      if (r.pathIndex >= r.planned_path.length - 1) continue;
      if (this.mode === "baseline" && r._baselineHold > 0) {
        r._baselineHold -= 1;
        continue;
      }
      const next = r.planned_path[r.pathIndex + 1];
      const blockedFn = this._blockedFn();
      if (blockedFn(next)) continue;
      intents.set(r.robot_id, next);
      desired.set(r.robot_id, next);
    }

    const stateById = (id) => this.channel[id] || this.robots.find((r) => r.robot_id === id);
    const robotById = (id) => this.robots.find((r) => r.robot_id === id);
    const occupancy = new Map();
    for (const r of this.robots) if (r.alive) occupancy.set(key(r.position), r.robot_id);

    // iterative conflict resolution using shared priority rule
    let changed = true;
    let guard = 0;
    const yieldedPairs = new Set();
    while (changed && guard++ < 20) {
      changed = false;

      // same-cell conflicts
      const claims = new Map();
      for (const [id, cell] of intents) {
        const k = key(cell);
        if (!claims.has(k)) claims.set(k, []);
        claims.get(k).push(id);
      }
      for (const [, ids] of claims) {
        if (ids.length <= 1) continue;
        const cands = ids.map((id) => {
          const s = robotById(id);
          return { robot_id: id, current_task: s.current_task, reservationTick: s.reservationTick };
        });
        const winner = this._pickWinner(cands);
        for (const id of ids) {
          if (id !== winner && intents.has(id)) {
            intents.delete(id);
            changed = true;
            const w = robotById(winner);
            const l = robotById(id);
            const ttc = ttcBetween(l.position, l.velocity, w.position, w.velocity);
            this._recordCollision(l, w, ttc, "yield-to-priority", yieldedPairs);
          }
        }
      }

      // moving into an occupied cell that won't vacate, + swaps
      for (const [id, cell] of [...intents]) {
        const occ = occupancy.get(key(cell));
        if (occ && occ !== id) {
          const occIntent = intents.get(occ);
          const occLeaving = occIntent && key(occIntent) !== key(cell);
          // swap / reverse-edge conflict
          if (occIntent && key(occIntent) === key(posOf.get(id))) {
            const cands = [
              { robot_id: id, current_task: robotById(id).current_task, reservationTick: robotById(id).reservationTick },
              { robot_id: occ, current_task: robotById(occ).current_task, reservationTick: robotById(occ).reservationTick },
            ];
            const winner = this._pickWinner(cands);
            const loser = winner === id ? occ : id;
            if (intents.has(loser)) {
              intents.delete(loser);
              changed = true;
              this._recordCollision(robotById(loser), robotById(winner), 0, "reverse-edge", yieldedPairs);
            }
          } else if (!occLeaving) {
            intents.delete(id);
            changed = true;
            this._recordCollision(robotById(id), robotById(occ), 1, "blocked-by-occupant", yieldedPairs);
          }
        }
      }
    }

    // deadlock detection on wait-for graph (robots that wanted to move but yielded,
    // waiting on a cell occupied by another waiting robot)
    this._detectDeadlock(desired, intents, occupancy);

    // remember which pairs are in conflict this tick so the SAME standoff is not
    // recounted next tick (episode-based counting)
    this._activeCollisions = yieldedPairs;

    // apply moves
    for (const r of this.robots) {
      if (!r.alive) continue;
      if (intents.has(r.robot_id)) {
        const next = intents.get(r.robot_id);
        r.velocity = [next[0] - r.position[0], next[1] - r.position[1]];
        r.position = [...next];
        r.pathIndex += 1;
        r.battery -= r.status === STATUS.CHARGING ? 0.05 : CONFIG.MOVE_BATTERY_COST;
        r._stuck = 0;
        if (r.status !== STATUS.CHARGING) r.status = STATUS.MOVING;
      } else if (r._task || r.status === STATUS.CHARGING) {
        r.velocity = [0, 0];
        // a robot committed to charging must not die from waiting in an approach queue
        r.battery -= r.status === STATUS.CHARGING ? 0 : CONFIG.WAIT_BATTERY_COST;
        r._stuck = (r._stuck || 0) + 1;
        if (r.status === STATUS.MOVING || r.status === STATUS.REROUTING) r.status = STATUS.WAITING;
      } else {
        r.velocity = [0, 0];
        r.battery -= CONFIG.IDLE_BATTERY_COST;
      }
      if (r.battery < 0) r.battery = 0;
    }
  }

  // Winner selection. System uses the shared task-priority rule; the naive
  // stop-and-wait baseline uses NO task priority (deterministic lowest-id only).
  _pickWinner(cands) {
    if (this.mode === "baseline") {
      return [...cands].sort((a, b) =>
        a.robot_id.localeCompare(b.robot_id, undefined, { numeric: true })
      )[0].robot_id;
    }
    return resolvePriority(cands, this.tick);
  }

  _recordCollision(loser, winner, ttc, resolution, seen) {
    if (!loser || !winner) return;
    if (this.mode === "baseline") loser._baselineHold = 2; // naive extra wait
    const pk = [loser.robot_id, winner.robot_id].sort().join("|");
    if (seen.has(pk)) return;
    seen.add(pk);
    this.tickIndicators.collision = true; // pulse every active tick
    // count one EPISODE: only when this pair was NOT already in conflict last tick
    if (this._activeCollisions.has(pk)) return;
    this.metrics.collisionsAvoided += 1;
    this.indicators.collision += 1;
    this._emit("Collision", { robot_a: loser.robot_id, robot_b: winner.robot_id, ttc: ttc === Infinity ? null : Number(ttc.toFixed(1)), resolution });
    this._log(
      "Collision Avoidance",
      `${loser.robot_id} yields to ${winner.robot_id} (TTC ${ttc === Infinity ? "∞" : ttc.toFixed(1)} ticks)`,
      "collision"
    );
  }

  _detectDeadlock(desired, intents, occupancy) {
    this._deadlockThisTick = new Set();
    // wait-for edges: r -> occupant of desired[r], only for robots that did not get to move
    const waitFor = new Map();
    for (const [id, cell] of desired) {
      if (intents.has(id)) continue; // moved or moving
      const occ = occupancy.get(key(cell));
      if (occ && occ !== id && !intents.has(occ)) waitFor.set(id, occ);
    }
    // find cycles
    const visited = new Set();
    for (const start of waitFor.keys()) {
      if (visited.has(start)) continue;
      const pathSet = new Set();
      const stack = [];
      let cur = start;
      while (cur && !visited.has(cur)) {
        if (pathSet.has(cur)) {
          // cycle found from cur
          const cycleStart = stack.indexOf(cur);
          const cycle = stack.slice(cycleStart);
          this._resolveDeadlock(cycle);
          break;
        }
        pathSet.add(cur);
        stack.push(cur);
        cur = waitFor.get(cur);
      }
      for (const n of stack) visited.add(n);
    }
    // episode-based: only cycles genuinely new this tick stay counted next tick
    this._activeDeadlocks = this._deadlockThisTick;
  }

  _resolveDeadlock(cycle) {
    if (cycle.length < 2) return;
    const cycleKey = [...cycle].sort().join("|");
    this._deadlockThisTick.add(cycleKey);
    const isNew = !this._activeDeadlocks.has(cycleKey);
    if (isNew) {
      this.metrics.deadlocksResolved += 1;
      this.indicators.deadlock += 1;
    }
    this.tickIndicators.deadlock = true;
    // lowest priority robot in cycle steps aside (reroute-vs-reallocate: reroute wins)
    const cands = cycle.map((id) => {
      const s = this.robots.find((r) => r.robot_id === id);
      return { robot_id: id, current_task: s.current_task, reservationTick: s.reservationTick };
    });
    const winner = this._pickWinner(cands);
    const loserId = cycle.find((id) => id !== winner) || cycle[cycle.length - 1];
    const loser = this.robots.find((r) => r.robot_id === loserId);
    if (isNew) {
      this._emit("Deadlock", { robot_ids: cycle, cycle, resolution: `${loserId} steps aside` });
      this._log("Deadlock Resolution", `Cycle [${cycle.join(" → ")}] detected — ${loserId} steps aside & reroutes`, "deadlock");
    }

    if (loser) {
      // step aside to a free neighbor, then replan
      const others = new Set(this.robots.filter((r) => r.alive).map((r) => key(r.position)));
      const blockedFn = this._blockedFn();
      const nbrs = [
        [loser.position[0] + 1, loser.position[1]],
        [loser.position[0] - 1, loser.position[1]],
        [loser.position[0], loser.position[1] + 1],
        [loser.position[0], loser.position[1] - 1],
      ];
      const winnerNext = cycle.length ? null : null;
      for (const n of nbrs) {
        if (n[0] < 0 || n[1] < 0 || n[0] >= this.width || n[1] >= this.height) continue;
        if (blockedFn(n) || others.has(key(n))) continue;
        loser.position = [...n];
        loser.velocity = [0, 0];
        loser.status = STATUS.REROUTING;
        const goal = this._currentGoal(loser);
        if (goal) this._replanSilent(loser, goal);
        break;
      }
    }
  }

  _replanSilent(robot, goal) {
    const path = astar(this.warehouse, robot.position, goal, this._blockedFn());
    if (path) {
      robot.planned_path = path;
      robot.pathIndex = 0;
    }
  }

  _breakStalls() {
    for (const r of this.robots) {
      if (!r.alive || (!r._task && r.status !== STATUS.CHARGING)) continue;
      if ((r._stuck || 0) < 18) continue;
      const goal = this._currentGoal(r);
      if (!goal) continue;
      this._replanSilent(r, goal);
      if ((r._stuck || 0) > 36) {
        const others = new Set(this.robots.filter((x) => x.alive && x !== r).map((x) => key(x.position)));
        const blockedFn = this._blockedFn();
        const nbrs = [
          [r.position[0] + 1, r.position[1]],
          [r.position[0] - 1, r.position[1]],
          [r.position[0], r.position[1] + 1],
          [r.position[0], r.position[1] - 1],
        ];
        for (const nb of nbrs) {
          if (nb[0] < 0 || nb[1] < 0 || nb[0] >= this.width || nb[1] >= this.height) continue;
          if (blockedFn(nb) || others.has(key(nb))) continue;
          r.position = [...nb];
          r._stuck = 0;
          this._replanSilent(r, goal);
          break;
        }
      }
    }
  }

  _progressTasks() {
    for (const r of this.robots) {
      if (!r.alive || !r._task) continue;
      const task = r._task;
      const goal = task.phase === "to_pickup" ? task.pickup : task.dropoff;
      if (r.position[0] === goal[0] && r.position[1] === goal[1]) {
        if (task.phase === "to_pickup") {
          task.phase = "to_drop";
          this._planTo(r, task.dropoff);
          this._log("Task Assignment", `${r.robot_id} picked up ${task.id}, heading to dropoff`, "info");
        } else {
          task.status = "completed";
          this.metrics.completed += 1;
          this.completionTicks.push(this.tick - task.createdTick);
          this._log("Task Assignment", `${r.robot_id} completed ${task.id} (${this.tick - task.createdTick} ticks)`, "success");
          r.current_task = null;
          r._task = null;
          r.status = STATUS.IDLE;
          r.planned_path = [r.position];
          r.pathIndex = 0;
        }
      }
    }
  }

  _handleCharging() {
    for (const r of this.robots) {
      if (r.status !== STATUS.CHARGING || !r.alive) continue;
      const target = r._chargingTarget;
      if (target && r.position[0] === target[0] && r.position[1] === target[1]) {
        r.battery = Math.min(100, r.battery + CONFIG.CHARGE_RATE);
        if (r.battery >= 100) {
          r.status = STATUS.IDLE;
          r._chargingTarget = null;
          this._updateBatteryState(r);
          this._log("Battery", `${r.robot_id} fully charged, back to service`, "info");
        }
      }
    }
  }

  // ─── Event bus ─────────────────────────────────────────────────────────
  subscribe(cb) {
    this._subs.push(cb);
    return () => (this._subs = this._subs.filter((s) => s !== cb));
  }

  _emit(type, payload) {
    const evt = { type, tick: this.tick, ...payload };
    for (const cb of this._subs) cb(evt);
  }

  _log(category, message, level = "info") {
    this.eventLog.push({ tick: this.tick, category, message, level });
    if (this.eventLog.length > 400) this.eventLog.shift();
  }

  // ─── Main tick ─────────────────────────────────────────────────────────
  step() {
    this.tick += 1;

    // 1. battery
    for (const r of this.robots) if (r.alive) this._handleBattery(r);

    // 2. apply delivered assignments to self (Rule C: robot applies to itself)
    this._applyPendingAssignments();

    // 3. publish state — channel now reflects current tasks (Rule B)
    this._publishAll();

    // 4. TM liveness / election
    this._checkTMLiveness();

    // 5. acks / timeouts
    this._processAcks();

    // 6. TM assignment batch (reads the fresh channel)
    if (
      this.tmId &&
      (this.tick % CONFIG.ASSIGNMENT_BATCH_INTERVAL_TICKS === 0 ||
        this._unassignedTasks().length >= CONFIG.ASSIGNMENT_QUEUE_TRIGGER_SIZE)
    ) {
      this._runAssignment();
    }

    // 7. task arrivals
    if (--this._nextArrival <= 0) {
      this._createTask();
      this._nextArrival = randInt(this.rng, 10, 22);
    }

    // 8. charging
    this._handleCharging();

    // 9. movement + collision + deadlock
    this._stepMovement();

    // 9b. livelock safety: nudge robots stuck too long
    this._breakStalls();

    // 10. task phase progression
    this._progressTasks();

    return this.getSnapshot();
  }

  // Next target cell + kind, for dashboard highlighting.
  _robotTarget(r) {
    if (!r.alive) return null;
    if (r.status === STATUS.CHARGING && r._chargingTarget)
      return { cell: [...r._chargingTarget], kind: "charging" };
    if (r._task) {
      const goal = r._task.phase === "to_pickup" ? r._task.pickup : r._task.dropoff;
      return { cell: [...goal], kind: r._task.phase === "to_pickup" ? "pickup" : "dropoff" };
    }
    return null;
  }

  // ─── Snapshot for UI ───────────────────────────────────────────────────
  getSnapshot() {
    const avgBattery = this.robots.length
      ? this.robots.reduce((a, r) => a + r.battery, 0) / this.robots.length
      : 0;
    return {
      tick: this.tick,
      mode: this.mode,
      warehouse: {
        width: this.width,
        height: this.height,
        staticSet: this.warehouse.staticSet,
        zones: this.warehouse.zones,
        chokePoints: this.warehouse.chokePoints,
      },
      dynamic: [...this.dynamic.entries()].map(([k, v]) => ({ cell: k.split(",").map(Number), dead: v.dead })),
      robots: this.robots.map((r) => ({
        robot_id: r.robot_id,
        position: [...r.position],
        battery: Math.round(r.battery * 10) / 10,
        battery_state: r.battery_state,
        status: r.status,
        is_task_manager: r.is_task_manager,
        priority_class: r.priority_class,
        tm_eligible: r.tm_eligible,
        alive: r.alive,
        current_task: r.current_task ? { ...r.current_task } : null,
        planned_path: r.planned_path.slice(r.pathIndex),
        target: this._robotTarget(r),
      })),
      tasks: {
        pending: this._unassignedTasks().length,
        inProgress: this.tasks.filter((t) => t.status === "in_progress" || t.status === "assigned").length,
        completed: this.metrics.completed,
        total: this.tasks.length,
      },
      tmId: this.tmId,
      tmEpoch: this.tmEpoch,
      metrics: { ...this.metrics },
      indicators: { ...this.indicators },
      tickIndicators: { ...this.tickIndicators },
      events: this.eventLog.slice(-120),
      avgBattery: Math.round(avgBattery * 10) / 10,
      avgCompletion: this.completionTicks.length
        ? this.completionTicks.reduce((a, b) => a + b, 0) / this.completionTicks.length
        : 0,
    };
  }

  // ─── Headless baseline-vs-system comparison (Section 17, Rule A) ────────
  static runComparison(seed, trials = 20, taskCount = 12) {
    const runOne = (mode, s) => {
      const eng = new SimulationEngine({ seed: s, mode });
      // fixed identical task set
      eng.tasks = [];
      eng.taskSeq = 0;
      const rng = mulberry32((s >>> 0) ^ 0x1234);
      const { storage, packing } = eng.warehouse.zones;
      for (let i = 0; i < taskCount; i++) {
        const pickup = storage[Math.floor(rng() * storage.length)];
        const dropoff = packing[Math.floor(rng() * packing.length)];
        eng.tasks.push({
          id: "T" + (i + 1),
          pickup: [...pickup],
          dropoff: [...dropoff],
          deadline: 9999,
          status: "pending",
          phase: "to_pickup",
          assignedTo: null,
          createdTick: 0,
        });
        eng.taskSeq = i + 1;
      }
      eng._nextArrival = 1e9; // no random arrivals during comparison
      let guard = 0;
      while (eng.metrics.completed < taskCount && guard++ < 2500) eng.step();
      return { ticks: eng.tick, collisions: eng.metrics.collisionsAvoided, completed: eng.metrics.completed };
    };

    const perTrial = [];
    let baseSum = 0;
    let sysSum = 0;
    let baseColl = 0;
    let sysColl = 0;
    for (let t = 0; t < trials; t++) {
      const s = seed + t * 101;
      const b = runOne("baseline", s);
      const sy = runOne("system", s);
      baseSum += b.ticks;
      sysSum += sy.ticks;
      baseColl += b.collisions;
      sysColl += sy.collisions;
      perTrial.push({
        trial: t + 1,
        baseline_ticks: b.ticks,
        system_ticks: sy.ticks,
        improvement: b.ticks ? ((b.ticks - sy.ticks) / b.ticks) * 100 : 0,
      });
    }
    const t1 = baseSum / trials;
    const t2 = sysSum / trials;
    const improvement = t1 ? ((t1 - t2) / t1) * 100 : 0;
    return {
      trials,
      taskCount,
      baseline_avg: Number(t1.toFixed(1)),
      system_avg: Number(t2.toFixed(1)),
      improvement: Number(improvement.toFixed(1)),
      baseline_collisions: baseColl,
      system_collisions: sysColl,
      perTrial,
    };
  }
}
