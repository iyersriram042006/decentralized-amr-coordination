import { Panel, Stat } from "./Panel";
import { Cpu, BatteryMedium } from "lucide-react";
import { BATTERY_COLOR } from "./theme";

export function TaskManagerPanel({ snapshot }) {
  const tmHandovers = snapshot.metrics.tmHandovers;
  const history = snapshot.events.filter((e) => e.category === "TM").slice(-5).reverse();
  return (
    <Panel title="Task Manager" icon={Cpu} testId="tm-panel">
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563]">Active TM</div>
            <div className="font-display text-xl font-bold text-[#39FF14] glow" data-testid="active-tm">
              {snapshot.tmId || "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563]">Epoch / Handovers</div>
            <div className="font-display text-xl font-bold text-[#F3F4F6] tabular-nums">
              {snapshot.tmEpoch}
              <span className="text-[#4B5563] text-sm"> / {tmHandovers}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-[#1F2937] pt-2">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563] mb-1">Election History</div>
          <div className="space-y-0.5">
            {history.length === 0 && <div className="font-mono text-[10px] text-[#4B5563]">no handovers yet</div>}
            {history.map((h, i) => (
              <div key={i} className="font-mono text-[10px] text-[#9CA3AF] flex gap-2">
                <span className="text-[#4B5563] tabular-nums">{String(h.tick).padStart(4, "0")}</span>
                <span className="truncate">{h.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function BatteryPanel({ snapshot }) {
  const robots = [...snapshot.robots].sort((a, b) => a.battery - b.battery);
  const counts = { normal: 0, low: 0, critical: 0, dead: 0 };
  snapshot.robots.forEach((r) => (counts[r.battery_state] += 1));
  return (
    <Panel title="Battery Overview" icon={BatteryMedium} testId="battery-panel">
      <div className="p-3 space-y-2">
        <div className="flex gap-1.5">
          {Object.entries(counts).map(([k, v]) => (
            <div
              key={k}
              className="flex-1 border border-[#1F2937] px-1.5 py-1 text-center"
              style={{ borderColor: v > 0 ? BATTERY_COLOR[k] : undefined }}
            >
              <div className="font-display text-base font-bold tabular-nums" style={{ color: BATTERY_COLOR[k] }}>
                {v}
              </div>
              <div className="font-mono text-[8px] uppercase text-[#4B5563]">{k}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 pt-1">
          {robots.map((r) => (
            <div key={r.robot_id} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#9CA3AF] w-7 shrink-0">{r.robot_id}</span>
              <div className="flex-1 h-2.5 bg-[#07080c] border border-[#1F2937] relative">
                <div
                  style={{
                    width: `${r.battery}%`,
                    height: "100%",
                    background: BATTERY_COLOR[r.battery_state],
                    transition: "width 0.3s linear",
                    boxShadow: `0 0 8px -2px ${BATTERY_COLOR[r.battery_state]}`,
                  }}
                />
              </div>
              <span
                className="font-mono text-[10px] tabular-nums w-9 text-right"
                style={{ color: BATTERY_COLOR[r.battery_state] }}
              >
                {r.battery.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function FooterMetrics({ snapshot }) {
  const m = snapshot.metrics;
  const items = [
    ["Tasks Done", snapshot.tasks.completed, "#39FF14"],
    ["Pending", snapshot.tasks.pending, "#FF6D00"],
    ["Ticks", snapshot.tick, "#00E5FF"],
    ["Collisions Avoided", m.collisionsAvoided, "#00E5FF"],
    ["Deadlocks", m.deadlocksResolved, "#FF003C"],
    ["Reroutes", m.reroutes, "#FF6D00"],
    ["Reallocations", m.reallocations, "#B026FF"],
    ["TM Handovers", m.tmHandovers, "#39FF14"],
    ["ACK Timeouts", m.ackTimeouts, "#FBBF24"],
    ["Fleet", snapshot.robots.filter((r) => r.alive).length, "#F3F4F6"],
    ["Avg Battery", `${snapshot.avgBattery}%`, "#39FF14"],
  ];
  return (
    <div className="panel flex flex-wrap gap-px bg-[#1F2937]" data-testid="footer-metrics">
      {items.map(([label, value, color]) => (
        <div key={label} className="flex-1 min-w-[90px] bg-[#0a0b10] px-3 py-1.5">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563] truncate">{label}</div>
          <div className="font-display text-sm font-bold tabular-nums" style={{ color }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
