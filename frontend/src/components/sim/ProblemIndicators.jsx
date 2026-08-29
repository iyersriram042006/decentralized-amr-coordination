import { Zap, Lock, Route, Shuffle } from "lucide-react";

const CARDS = [
  { key: "collision", label: "Collision Avoidance", icon: Zap, color: "#00E5FF", metric: "collisionsAvoided" },
  { key: "deadlock", label: "Deadlock Resolution", icon: Lock, color: "#FF003C", metric: "deadlocksResolved" },
  { key: "blocked", label: "Blocked / Rerouting", icon: Route, color: "#FF6D00", metric: "reroutes" },
  { key: "reallocation", label: "Task Reallocation", icon: Shuffle, color: "#B026FF", metric: "reallocations" },
];

export default function ProblemIndicators({ snapshot, activeFilter, onSelect }) {
  const { indicators, tickIndicators, metrics } = snapshot;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="problem-indicators">
      {CARDS.map((c) => {
        const Icon = c.icon;
        const pulsing = tickIndicators[c.key];
        const selected = activeFilter === c.label;
        return (
          <button
            key={c.key}
            data-testid={`indicator-${c.key}`}
            onClick={() => onSelect(selected ? null : c.label)}
            className="panel text-left px-3 py-2.5 transition-colors duration-200 relative overflow-hidden"
            style={{
              borderColor: pulsing || selected ? c.color : undefined,
              boxShadow: pulsing ? `inset 0 0 0 1px ${c.color}, 0 0 16px -4px ${c.color}` : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <Icon size={14} style={{ color: c.color }} className={pulsing ? "glow" : ""} />
              <span
                className={`w-1.5 h-1.5 rounded-full ${pulsing ? "" : "opacity-30"}`}
                style={{ background: c.color, boxShadow: pulsing ? `0 0 6px ${c.color}` : "none" }}
              />
            </div>
            <div className="font-display text-2xl font-bold tabular-nums mt-1" style={{ color: c.color }}>
              {metrics[c.metric]}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#9CA3AF] mt-0.5 leading-tight">
              {c.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
