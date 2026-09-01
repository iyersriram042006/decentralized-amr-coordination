import { useState } from "react";
import { Link } from "react-router-dom";
import { useSimulation } from "@/hooks/useSimulation";
import GridView from "@/components/sim/GridView";
import ControlBar from "@/components/sim/ControlBar";
import ProblemIndicators from "@/components/sim/ProblemIndicators";
import RobotRoster from "@/components/sim/RobotRoster";
import EventLog from "@/components/sim/EventLog";
import { TaskManagerPanel, BatteryPanel, FooterMetrics } from "@/components/sim/SidePanels";
import PerformancePanel from "@/components/sim/PerformancePanel";
import AdminControls from "@/components/sim/AdminControls";
import { Panel } from "@/components/sim/Panel";
import { STATUS_COLOR, BATTERY_COLOR } from "@/components/sim/theme";
import { Monitor, Presentation, ArrowLeft, MapPin } from "lucide-react";

export default function Dashboard() {
  const { snapshot, running, speed, scenario, controls } = useSimulation();
  const [selected, setSelected] = useState(null);
  const [logFilter, setLogFilter] = useState(null);
  const [demo, setDemo] = useState(false);

  const selRobot = snapshot.robots.find((r) => r.robot_id === selected);

  return (
    <div className="min-h-screen bg-[#050505] text-[#F3F4F6] flex flex-col">
      {/* header */}
      <header className="sticky top-0 z-40 bg-black/70 backdrop-blur-xl border-b border-[#1F2937]">
        <div className="flex items-center gap-4 px-4 py-2.5">
          <Link to="/" className="text-[#9CA3AF] hover:text-[#00E5FF] transition-colors duration-150" data-testid="back-home">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#00E5FF] box-glow-cyan" />
            <span className="font-display text-sm uppercase tracking-widest font-bold">
              Grid<span className="text-[#00E5FF]">Lock</span>
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#4B5563] hidden md:block">
            SIH 26123 · Decentralized Edge-AI Coordination · seed {snapshot.warehouse.width}×{snapshot.warehouse.height}
          </span>
          <button
            data-testid="demo-mode-toggle"
            onClick={() => setDemo((d) => !d)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border transition-colors duration-150 font-display text-[10px] uppercase tracking-wider"
            style={{ borderColor: demo ? "#39FF14" : "#374151", color: demo ? "#39FF14" : "#9CA3AF" }}
          >
            {demo ? <Presentation size={12} /> : <Monitor size={12} />}
            {demo ? "Demo Mode" : "Operator Mode"}
          </button>
        </div>
      </header>

      <div className="flex-1 p-3 space-y-3">
        <ControlBar snapshot={snapshot} running={running} speed={speed} controls={controls} />
        <ProblemIndicators snapshot={snapshot} activeFilter={logFilter} onSelect={setLogFilter} />

        {/* main bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {!demo && (
            <div className="lg:col-span-3 order-2 lg:order-1">
              <AdminControls snapshot={snapshot} running={running} controls={controls} scenario={scenario} />
            </div>
          )}

          <div className={`order-1 lg:order-2 ${demo ? "lg:col-span-9" : "lg:col-span-6"}`}>
            <Panel
              title="Live Warehouse Grid"
              testId="grid-panel"
              right={
                <span className="font-mono text-[9px] text-[#4B5563]">
                  {selected ? `tracking ${selected}` : "click cell to block · click robot in roster"}
                </span>
              }
            >
              <div className="p-3 scanline relative">
                <GridView
                  snapshot={snapshot}
                  interactive
                  onCellClick={(c) => controls.blockCell(c, 40)}
                  selectedRobot={selected}
                />
              </div>
              {selRobot && (
                <div className="border-t border-[#1F2937] px-3 py-2 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[10px]" data-testid="robot-detail">
                  <Detail label="Robot" value={selRobot.robot_id} color={STATUS_COLOR[selRobot.status]} />
                  <Detail label="Status" value={selRobot.status} color={STATUS_COLOR[selRobot.status]} />
                  <Detail label="Battery" value={`${selRobot.battery}% ${selRobot.battery_state}`} color={BATTERY_COLOR[selRobot.battery_state]} />
                  <Detail label="Position" value={`[${selRobot.position}]`} />
                  <Detail label="Priority" value={selRobot.priority_class} />
                  <Detail label="Is TM" value={selRobot.is_task_manager ? "yes" : "no"} color={selRobot.is_task_manager ? "#39FF14" : undefined} />
                  <Detail label="Task" value={selRobot.current_task ? selRobot.current_task.id : "—"} />
                  <Detail label="Path len" value={selRobot.planned_path.length} icon={MapPin} />
                </div>
              )}
            </Panel>
          </div>

          <div className="lg:col-span-3 order-3 space-y-3">
            <TaskManagerPanel snapshot={snapshot} />
            <BatteryPanel snapshot={snapshot} />
          </div>
        </div>

        {/* lower row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {!demo && (
            <div className="lg:col-span-3 h-[340px]">
              <RobotRoster snapshot={snapshot} selected={selected} onSelect={setSelected} />
            </div>
          )}
          <div className={`h-[340px] ${demo ? "lg:col-span-5" : "lg:col-span-4"}`}>
            <EventLog snapshot={snapshot} categoryFilter={logFilter} onClearFilter={() => setLogFilter(null)} />
          </div>
          <div className={`${demo ? "lg:col-span-7" : "lg:col-span-5"}`}>
            <PerformancePanel seed={42} />
          </div>
        </div>

        <FooterMetrics snapshot={snapshot} />
      </div>
    </div>
  );
}

function Detail({ label, value, color = "#F3F4F6" }) {
  return (
    <div className="border border-[#12141c] bg-[#07080c] px-2 py-1">
      <div className="text-[8px] uppercase text-[#4B5563]">{label}</div>
      <div className="tabular-nums truncate" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
