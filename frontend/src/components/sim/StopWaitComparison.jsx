import { useState } from "react";
import axios from "axios";
import { Panel } from "./Panel";
import { Timer, Loader2, GitCompareArrows } from "lucide-react";
import { SimulationEngine } from "@/sim/engine";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Separate section: runs the EXACT SAME scenario/seed for both a naive
// stop-and-wait strategy and the full GridLock system, per trial, and reports
// the actual measured completion-time improvement (never hard-coded).
export default function StopWaitComparison() {
  const [trials, setTrials] = useState(30);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [seedUsed, setSeedUsed] = useState(null);

  const run = () => {
    setLoading(true);
    setResult(null);
    const runSeed = Math.floor(Math.random() * 1_000_000); // fresh each run -> value can genuinely change
    setSeedUsed(runSeed);
    setTimeout(async () => {
      // runComparison runs baseline (stop-and-wait) and system (GridLock) on the
      // SAME per-trial seed => apples-to-apples, and averages across trials.
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
        /* best-effort persistence */
      }
    }, 50);
  };

  const good = result && result.improvement >= 20;

  return (
    <Panel title="Stop-and-Wait vs GridLock Performance" icon={GitCompareArrows} testId="stopwait-comparison">
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#4B5563]">Trials</span>
            <Select value={String(trials)} onValueChange={(v) => setTrials(Number(v))}>
              <SelectTrigger
                data-testid="stopwait-trials-select"
                className="w-[96px] h-auto rounded-none bg-[#07080c] border-[#1F2937] text-[11px] font-mono text-[#9CA3AF] px-2 py-1.5"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0b10] border-[#1F2937] rounded-none">
                {[10, 20, 30, 50].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-[11px] font-mono text-[#9CA3AF]">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            data-testid="stopwait-run-btn"
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black transition-colors duration-150 font-display text-[11px] uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Timer size={13} />}
            {loading ? "Running trials…" : "Run Comparison"}
          </button>
          <span className="font-mono text-[9px] text-[#4B5563] flex-1">
            same warehouse · same tasks · same seed per trial {seedUsed !== null ? `(base ${seedUsed})` : ""} · measured, not forced
          </span>
        </div>

        {!result && !loading && (
          <div className="border border-dashed border-[#1F2937] px-3 py-6 text-center font-mono text-[11px] text-[#4B5563]">
            Runs each trial twice on an identical scenario — once with naive stop-and-wait (stop on
            conflict, no rerouting / reallocation / priority) and once with full GridLock coordination —
            then reports the real averaged improvement.
          </div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="stopwait-metrics">
              <MetricTile label="Stop-and-Wait Avg Time" value={`${result.baseline_avg}t`} color="#FF6D00" testId="stopwait-baseline-avg" />
              <MetricTile label="GridLock Avg Time" value={`${result.system_avg}t`} color="#00E5FF" testId="stopwait-gridlock-avg" />
              <MetricTile
                label="Actual Improvement"
                value={`${result.improvement > 0 ? "+" : ""}${result.improvement}%`}
                color={good ? "#39FF14" : "#FF6D00"}
                testId="stopwait-improvement"
              />
              <MetricTile label="Trials" value={result.trials} color="#B026FF" testId="stopwait-trials" />
            </div>

            <div
              className="border px-4 py-3 flex items-center justify-between"
              style={{ borderColor: good ? "#39FF14" : "#FF6D00", background: "#07080c" }}
            >
              <div className="font-mono text-[10px] text-[#9CA3AF] leading-relaxed">
                Improvement = (StopWait {result.baseline_avg}t − GridLock {result.system_avg}t) ÷ StopWait{" "}
                {result.baseline_avg}t × 100
              </div>
              <div className="font-display text-2xl font-bold glow tabular-nums" style={{ color: good ? "#39FF14" : "#FF6D00" }}>
                {result.improvement > 0 ? "+" : ""}
                {result.improvement}%
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function MetricTile({ label, value, color, testId }) {
  return (
    <div className="border border-[#1F2937] bg-[#07080c] px-3 py-2.5" data-testid={testId}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563] leading-tight">{label}</div>
      <div className="font-display text-xl font-bold tabular-nums mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
