import { Play, Pause, SkipForward, RotateCcw, Gauge } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export default function ControlBar({ snapshot, running, speed, controls }) {
  return (
    <div className="panel flex flex-wrap items-center gap-3 px-3 py-2" data-testid="control-bar">
      <div className="flex items-center gap-1.5">
        <button
          data-testid="play-simulation-btn"
          onClick={running ? controls.pause : controls.play}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black transition-colors duration-150 font-display text-[11px] uppercase tracking-wider box-glow-cyan"
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? "Pause" : "Play"}
        </button>
        <button
          data-testid="step-simulation-btn"
          onClick={controls.stepOnce}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#374151] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#4B5563] transition-colors duration-150 font-display text-[11px] uppercase tracking-wider disabled:opacity-40"
        >
          <SkipForward size={13} /> Step
        </button>
        <button
          data-testid="reset-simulation-btn"
          onClick={() => controls.reset()}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#374151] text-[#9CA3AF] hover:text-[#FF003C] hover:border-[#FF003C] transition-colors duration-150 font-display text-[11px] uppercase tracking-wider"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="flex items-center gap-2 min-w-[180px] flex-1">
        <Gauge size={13} className="text-[#9CA3AF] shrink-0" />
        <Slider
          data-testid="speed-slider"
          value={[speed]}
          min={1}
          max={20}
          step={1}
          onValueChange={(v) => controls.setSpeed(v[0])}
          className="flex-1"
        />
        <span className="font-mono text-[11px] text-[#9CA3AF] tabular-nums w-14">{speed} t/s</span>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563]">Tick</div>
          <div className="font-display text-base font-bold text-[#00E5FF] tabular-nums glow" data-testid="tick-counter">
            {String(snapshot.tick).padStart(5, "0")}
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 border border-[#1F2937]">
          <span className={`w-2 h-2 rounded-full ${running ? "bg-[#39FF14]" : "bg-[#4B5563]"}`} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#9CA3AF]">
            {running ? "Live" : "Paused"}
          </span>
        </div>
      </div>
    </div>
  );
}
