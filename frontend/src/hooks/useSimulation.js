import { useCallback, useEffect, useRef, useState } from "react";
import { SimulationEngine } from "../sim/engine";

export const SCENARIOS = [
  { id: "default", name: "Free Operation", desc: "Continuous mixed task flow across the fleet." },
  { id: "head_on", name: "Head-On Collision", desc: "Two AMRs converge in a single-width aisle." },
  { id: "choke_point", name: "Choke-Point Convergence", desc: "Multiple AMRs race for one narrow cell." },
  { id: "blocked_alt", name: "Blocked Path (alternate)", desc: "Aisle blocks mid-run; D* Lite reroutes." },
  { id: "blocked_noalt", name: "Blocked Path (no alternate)", desc: "Dead-end block forces task reallocation." },
  { id: "battery_dead", name: "Battery Dead Mid-Task", desc: "An AMR dies and becomes an obstacle." },
  { id: "tm_failover", name: "Task-Manager Failover", desc: "The TM dies; election promotes a new one." },
  { id: "bulk_hungarian", name: "Bulk Hungarian Assignment", desc: "A large batch tests optimal allocation." },
  { id: "dead_zone", name: "Wi-Fi Dead-Zone (ACK loss)", desc: "Messages drop; ACK retry + fallback fires." },
];

export function useSimulation(initial = {}) {
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine({ seed: initial.seed ?? 42, mode: "system" });
  }
  const [snapshot, setSnapshot] = useState(() => engineRef.current.getSnapshot());
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(initial.speed ?? 6); // ticks/sec
  const [scenario, setScenario] = useState("default");
  const timerRef = useRef(null);

  const sync = useCallback(() => setSnapshot(engineRef.current.getSnapshot()), []);

  const stepOnce = useCallback(() => {
    engineRef.current.step();
    sync();
  }, [sync]);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      engineRef.current.step();
      sync();
    }, Math.max(40, 1000 / speed));
    return () => clearInterval(timerRef.current);
  }, [running, speed, sync]);

  const play = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback(
    (opts = {}) => {
      setRunning(false);
      engineRef.current.commLoss = 0;
      engineRef.current.mode = "system";
      engineRef.current.regenerateWarehouse({
        seed: opts.seed ?? engineRef.current.baseSeed,
        ...opts,
      });
      setScenario("default");
      sync();
    },
    [sync]
  );

  const applyScenario = useCallback(
    (id) => {
      setRunning(false);
      const eng = engineRef.current;
      eng.commLoss = 0;
      eng.mode = "system";
      eng.reset();
      setScenario(id);

      const wh = eng.warehouse;
      const choke = wh.chokePoints[0] || [wh.aisleCols[0], wh.midRow];

      const spawnFacing = (aisleX) => {
        const top = [aisleX, 1];
        const bottom = [aisleX, wh.height - 2];
        return { top, bottom };
      };

      switch (id) {
        case "head_on": {
          const ax = wh.aisleCols[Math.floor(wh.aisleCols.length / 2)];
          const { top, bottom } = spawnFacing(ax);
          eng.robots[0].position = [...top];
          eng.robots[1].position = [...bottom];
          eng.tasks = [];
          eng.taskSeq = 0;
          eng._createTask({ pickup: top, dropoff: [ax, wh.height - 2] });
          eng._createTask({ pickup: bottom, dropoff: [ax, 1] });
          eng._nextArrival = 1e9;
          break;
        }
        case "choke_point": {
          const cp = choke;
          eng.tasks = [];
          eng.taskSeq = 0;
          for (let i = 0; i < Math.min(4, eng.robots.length); i++) {
            const drop = wh.zones.packing[(i * 3) % wh.zones.packing.length];
            eng._createTask({ pickup: [cp[0], cp[1]], dropoff: drop });
          }
          eng._nextArrival = 1e9;
          break;
        }
        case "blocked_alt": {
          eng._runScenarioBlock = { cell: [wh.aisleCols[1], wh.midRow], atTick: 14, duration: 40 };
          break;
        }
        case "blocked_noalt": {
          // box a laden robot in so replan genuinely fails -> forced reallocation
          eng._runScenarioEnclose = { atTick: 16, duration: 45 };
          break;
        }
        case "battery_dead": {
          eng.robots[1].battery = 12;
          eng._runScenarioKill = { id: eng.robots[1].robot_id, atTick: 18 };
          break;
        }
        case "tm_failover": {
          eng._runScenarioKill = { id: eng.tmId, atTick: 16 };
          break;
        }
        case "bulk_hungarian": {
          eng.injectTasks(8);
          break;
        }
        case "dead_zone": {
          eng.commLoss = 0.45;
          eng._log("ACK Timeout", "Wi-Fi dead-zone simulated: 45% message loss enabled", "ack");
          break;
        }
        default:
          break;
      }
      // install scenario hooks via monkey step wrapper
      sync();
    },
    [sync]
  );

  // scenario timed triggers handled by wrapping step
  useEffect(() => {
    const eng = engineRef.current;
    const origStep = eng.step.bind(eng);
    eng.step = () => {
      const snap = origStep();
      if (eng._runScenarioBlock && eng.tick === eng._runScenarioBlock.atTick) {
        const b = eng._runScenarioBlock;
        if (b.multi) b.multi.forEach((c) => eng.blockCell(c, b.duration));
        else eng.blockCell(b.cell, b.duration);
        eng._runScenarioBlock = null;
      }
      if (eng._runScenarioKill && eng.tick === eng._runScenarioKill.atTick) {
        eng.killBattery(eng._runScenarioKill.id);
        eng._runScenarioKill = null;
      }
      if (eng._runScenarioEnclose && eng.tick === eng._runScenarioEnclose.atTick) {
        const cand = eng.robots
          .filter((r) => r.alive && r._task && r.planned_path.length > 3)
          .sort((a, b) => b.planned_path.length - a.planned_path.length)[0];
        if (cand) {
          const [x, y] = cand.position;
          const nbrs = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
          for (const nb of nbrs) {
            if (nb[0] >= 0 && nb[1] >= 0 && nb[0] < eng.width && nb[1] < eng.height && !eng.warehouse.isStatic(nb))
              eng.blockCell(nb, eng._runScenarioEnclose.duration);
          }
          eng._log("Blocked Path / Rerouting", `${cand.robot_id} boxed in — no alternate route, task must be reallocated`, "reroute");
        }
        eng._runScenarioEnclose = null;
      }
      return snap;
    };
    return () => {
      eng.step = origStep;
    };
  }, []);

  const controls = {
    play,
    pause,
    stepOnce,
    reset,
    setSpeed,
    applyScenario,
    addRobot: (cfg) => {
      engineRef.current.addRobot(cfg);
      sync();
    },
    removeRobot: (id) => {
      const ok = engineRef.current.removeRobot(id);
      sync();
      return ok;
    },
    injectTasks: (n) => {
      engineRef.current.injectTasks(n);
      sync();
    },
    blockCell: (cell, dur) => {
      engineRef.current.blockCell(cell, dur);
      sync();
    },
    killBattery: (id) => {
      engineRef.current.killBattery(id);
      sync();
    },
    recoverRobot: (id, lvl) => {
      engineRef.current.recoverRobot(id, lvl);
      sync();
    },
    regenerate: (opts) => {
      setRunning(false);
      engineRef.current.regenerateWarehouse(opts);
      sync();
    },
  };

  return { snapshot, running, speed, scenario, engine: engineRef.current, controls };
}
