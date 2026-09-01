import { useState } from "react";
import axios from "axios";
import { Panel } from "./Panel";
import { Activity, Loader2 } from "lucide-react";
import { SimulationEngine } from "@/sim/engine";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PerformancePanel({ seed = 42 }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trials, setTrials] = useState(15);
  const [lastSeed, setLastSeed] = useState(null);

  const run = () => {
    setLoading(true);
    setResult(null);
    // fresh random seed each run so the measured value varies run-to-run
    const runSeed = Math.floor(Math.random() * 1_000_000);
    setLastSeed(runSeed);
    setTimeout(async () => {
      const res = SimulationEngine.runComparison(runSeed, trials, 10);
      setResult(res);
      setLoading(false);
      try {
        await axios.post(`${API}/sim-runs`, {
          seed: runSeed,
          trials: res.trials,
          task_count: res.taskCount,
          baseline_avg: res.baseline_avg,
          system_avg: res.system_avg,
          improvement: res.improvement,
          baseline_collisions: res.baseline_collisions,
          system_collisions: res.system_collisions,
        });
      } catch (e) {
        /* persistence is best-effort */
      }
    }, 50);
  };

  const good = result && result.improvement >= 20;
  const chartData = result
    ? result.perTrial.map((t) => ({ name: `#${t.trial}`, Baseline: t.baseline_ticks, System: t.system_ticks }))
    : [];

  return (
    <Panel title="Performance · Baseline vs System" icon={Activity} testId="performance-panel" className="h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Select value={String(trials)} onValueChange={(v) => setTrials(Number(v))}>
            <SelectTrigger
              data-testid="perf-trials-select"
              className="w-[110px] h-auto rounded-none bg-[#07080c] border-[#1F2937] text-[10px] font-mono text-[#9CA3AF] px-2 py-1.5"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0b10] border-[#1F2937] rounded-none">
              {[10, 15, 20, 30].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-[11px] font-mono text-[#9CA3AF]">
                  {n} trials
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            data-testid="run-comparison-btn"
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black transition-colors duration-150 font-display text-[11px] uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
            {loading ? "Running…" : "Run Comparison"}
          </button>
          <span className="font-mono text-[9px] text-[#4B5563] flex-1">
            10 identical tasks · {lastSeed !== null ? `seed ${lastSeed}` : "fresh seed each run"} · measured, not forced
          </span>
        </div>

        {!result && !loading && (
          <div className="border border-dashed border-[#1F2937] px-3 py-6 text-center font-mono text-[11px] text-[#4B5563]">
            Run a headless baseline (stop-and-wait) vs full-system comparison. The improvement % is computed
            from real trials — Rule A.
          </div>
        )}

        {result && (
          <>
            <div
              className="border px-4 py-3 flex items-center justify-between"
              style={{ borderColor: good ? "#39FF14" : "#FF6D00", background: "#07080c" }}
              data-testid="improvement-callout"
            >
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563]">
                  Measured Task-Time Improvement
                </div>
                <div
                  className="font-display text-3xl font-bold glow tabular-nums"
                  style={{ color: good ? "#39FF14" : "#FF6D00" }}
                >
                  {result.improvement > 0 ? "+" : ""}
                  {result.improvement}%
                </div>
              </div>
              <div className="text-right font-mono text-[10px] text-[#9CA3AF] leading-relaxed">
                <div>
                  baseline <span className="text-[#F3F4F6]">{result.baseline_avg}t</span>
                </div>
                <div>
                  system <span className="text-[#00E5FF]">{result.system_avg}t</span>
                </div>
                <div className={good ? "text-[#39FF14]" : "text-[#FF6D00]"}>
                  {good ? "≥ 20% target met" : "below 20% target (honest)"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="border border-[#1F2937] px-3 py-2 bg-[#07080c]">
                <div className="font-mono text-[9px] uppercase text-[#4B5563]">Baseline Collisions</div>
                <div className="font-display text-lg font-bold text-[#FF003C] tabular-nums">
                  {result.baseline_collisions}
                </div>
              </div>
              <div className="border border-[#1F2937] px-3 py-2 bg-[#07080c]">
                <div className="font-mono text-[9px] uppercase text-[#4B5563]">System Conflicts Resolved</div>
                <div className="font-display text-lg font-bold text-[#00E5FF] tabular-nums">
                  {result.system_collisions}
                </div>
              </div>
            </div>

            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#12141c" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#4B5563", fontSize: 9, fontFamily: "JetBrains Mono" }} />
                  <YAxis tick={{ fill: "#4B5563", fontSize: 9, fontFamily: "JetBrains Mono" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0b10",
                      border: "1px solid #1F2937",
                      fontFamily: "JetBrains Mono",
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 10 }} />
                  <Bar dataKey="Baseline" fill="#FF6D00" />
                  <Bar dataKey="System" fill="#00E5FF" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
