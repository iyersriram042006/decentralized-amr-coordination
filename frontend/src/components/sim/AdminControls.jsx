import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "./Panel";
import { SlidersHorizontal, Bot, Package, Ban, Zap, RefreshCw, Trash2, Plus } from "lucide-react";
import { SCENARIOS } from "@/hooks/useSimulation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function AdminControls({ snapshot, running, controls, scenario }) {
  const [newId, setNewId] = useState("");
  const [newBattery, setNewBattery] = useState(100);
  const [newPriority, setNewPriority] = useState("standard");
  const [tmEligible, setTmEligible] = useState(true);
  const [chokeSel, setChokeSel] = useState(0);
  const [seed, setSeed] = useState(snapshot.warehouse.staticSet ? 42 : 42);
  const [gridW, setGridW] = useState(snapshot.warehouse.width);
  const [gridH, setGridH] = useState(snapshot.warehouse.height);

  const chokes = snapshot.warehouse.chokePoints || [];

  const addRobot = () => {
    controls.addRobot({
      id: newId || undefined,
      battery: Number(newBattery),
      priorityClass: newPriority,
      tmEligible,
    });
    toast.success(`Robot ${newId || "auto"} added`);
    setNewId("");
  };

  return (
    <Panel title="Operator Console" icon={SlidersHorizontal} testId="admin-controls" className="h-full">
      <Tabs defaultValue="scenarios" className="w-full">
        <TabsList className="w-full justify-start rounded-none bg-[#07080c] border-b border-[#1F2937] h-auto p-0">
          <TabsTrigger value="scenarios" data-testid="tab-scenarios" className="rounded-none text-[10px] font-display uppercase data-[state=active]:text-[#00E5FF] data-[state=active]:bg-[#13151d] py-2">
            Scenarios
          </TabsTrigger>
          <TabsTrigger value="robots" data-testid="tab-robots" className="rounded-none text-[10px] font-display uppercase data-[state=active]:text-[#00E5FF] data-[state=active]:bg-[#13151d] py-2">
            Fleet
          </TabsTrigger>
          <TabsTrigger value="env" data-testid="tab-env" className="rounded-none text-[10px] font-display uppercase data-[state=active]:text-[#00E5FF] data-[state=active]:bg-[#13151d] py-2">
            Environment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="p-2 mt-0 space-y-1.5">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              data-testid={`scenario-${s.id}`}
              onClick={() => {
                controls.applyScenario(s.id);
                toast.info(`Scenario loaded: ${s.name}`, { description: "Press Play to run" });
              }}
              className="w-full text-left px-2.5 py-1.5 border transition-colors duration-150"
              style={{
                borderColor: scenario === s.id ? "#00E5FF" : "#1F2937",
                background: scenario === s.id ? "#13151d" : "transparent",
              }}
            >
              <div className="font-display text-[11px] uppercase tracking-wide" style={{ color: scenario === s.id ? "#00E5FF" : "#F3F4F6" }}>
                {s.name}
              </div>
              <div className="font-mono text-[9px] text-[#9CA3AF] leading-tight">{s.desc}</div>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="robots" className="p-3 mt-0 space-y-3">
          <div className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563] flex items-center gap-1">
              <Plus size={11} /> Add AMR
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="new-robot-id"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="ID (auto)"
                className="bg-[#07080c] border border-[#1F2937] px-2 py-1.5 text-[11px] font-mono text-[#F3F4F6] outline-none placeholder:text-[#4B5563]"
              />
              <input
                data-testid="new-robot-battery"
                type="number"
                value={newBattery}
                onChange={(e) => setNewBattery(e.target.value)}
                placeholder="Battery %"
                className="bg-[#07080c] border border-[#1F2937] px-2 py-1.5 text-[11px] font-mono text-[#F3F4F6] outline-none"
              />
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger
                  data-testid="new-robot-priority"
                  className="h-auto rounded-none bg-[#07080c] border-[#1F2937] px-2 py-1.5 text-[11px] font-mono text-[#9CA3AF]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0b10] border-[#1F2937] rounded-none">
                  <SelectItem value="standard" className="text-[11px] font-mono text-[#9CA3AF]">
                    standard
                  </SelectItem>
                  <SelectItem value="high" className="text-[11px] font-mono text-[#9CA3AF]">
                    high priority
                  </SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#9CA3AF] px-1">
                <input type="checkbox" checked={tmEligible} onChange={(e) => setTmEligible(e.target.checked)} data-testid="new-robot-tm" />
                TM-eligible
              </label>
            </div>
            <button
              data-testid="add-robot-btn"
              onClick={addRobot}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-colors duration-150 font-display text-[11px] uppercase"
            >
              <Bot size={13} /> Deploy Robot
            </button>
          </div>

          <div className="border-t border-[#1F2937] pt-2 space-y-1.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563]">
              Fleet ({snapshot.robots.filter((r) => r.alive).length} active · min 3)
            </div>
            {snapshot.robots.map((r) => (
              <div key={r.robot_id} className="flex items-center gap-2 border border-[#1F2937] px-2 py-1">
                <span className="font-mono text-[11px] text-[#F3F4F6] w-8">{r.robot_id}</span>
                <span className="font-mono text-[9px] text-[#9CA3AF] flex-1">{r.status} · {r.battery.toFixed(0)}%</span>
                <button
                  data-testid={`kill-${r.robot_id}`}
                  onClick={() => {
                    controls.killBattery(r.robot_id);
                    toast.warning(`${r.robot_id} battery killed`);
                  }}
                  title="Kill battery"
                  className="text-[#FF6D00] hover:text-[#FF003C]"
                >
                  <Zap size={12} />
                </button>
                {!r.alive && (
                  <button
                    data-testid={`recover-${r.robot_id}`}
                    onClick={() => controls.recoverRobot(r.robot_id, 100)}
                    title="Recover"
                    className="text-[#39FF14] hover:text-[#00E5FF]"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
                <button
                  data-testid={`remove-${r.robot_id}`}
                  onClick={() => {
                    const ok = controls.removeRobot(r.robot_id);
                    if (ok) toast.success(`${r.robot_id} removed`);
                    else toast.warning(`Minimum fleet size is 3 — cannot remove ${r.robot_id}`);
                  }}
                  title="Remove"
                  className="text-[#9CA3AF] hover:text-[#FF003C]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="env" className="p-3 mt-0 space-y-3">
          <div className="space-y-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563] flex items-center gap-1">
              <Package size={11} /> Task Injection
            </div>
            <div className="flex gap-2">
              {[1, 4, 8].map((n) => (
                <button
                  key={n}
                  data-testid={`inject-${n}`}
                  onClick={() => {
                    controls.injectTasks(n);
                    toast.info(`${n} task${n > 1 ? "s" : ""} injected`);
                  }}
                  className="flex-1 px-2 py-1.5 border border-[#1F2937] text-[#9CA3AF] hover:text-[#00E5FF] hover:border-[#00E5FF] transition-colors duration-150 font-mono text-[11px]"
                >
                  +{n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-[#1F2937] pt-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563] flex items-center gap-1">
              <Ban size={11} /> Block Choke Point
            </div>
            <div className="flex gap-2">
              <Select value={String(chokeSel)} onValueChange={(v) => setChokeSel(Number(v))}>
                <SelectTrigger
                  data-testid="choke-select"
                  className="flex-1 h-auto rounded-none bg-[#07080c] border-[#1F2937] px-2 py-1.5 text-[11px] font-mono text-[#9CA3AF]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0b10] border-[#1F2937] rounded-none">
                  {chokes.map((c, i) => (
                    <SelectItem key={i} value={String(i)} className="text-[11px] font-mono text-[#9CA3AF]">
                      Choke [{c[0]},{c[1]}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                data-testid="block-choke-btn"
                onClick={() => {
                  const c = chokes[chokeSel];
                  if (c) {
                    controls.blockCell(c, 40);
                    toast.warning(`Blocked choke [${c}]`);
                  }
                }}
                className="px-3 py-1.5 border border-[#FF6D00] text-[#FF6D00] hover:bg-[#FF6D00] hover:text-black transition-colors duration-150 font-display text-[11px] uppercase"
              >
                Block
              </button>
            </div>
          </div>

          <div className="space-y-2 border-t border-[#1F2937] pt-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563] flex items-center gap-1">
              <RefreshCw size={11} /> Warehouse {running && <span className="text-[#FF003C]">(pause to edit)</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                data-testid="seed-input"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                placeholder="seed"
                disabled={running}
                className="bg-[#07080c] border border-[#1F2937] px-2 py-1.5 text-[11px] font-mono text-[#F3F4F6] outline-none disabled:opacity-40"
              />
              <input
                data-testid="grid-w"
                type="number"
                value={gridW}
                min={16}
                max={40}
                onChange={(e) => setGridW(Number(e.target.value))}
                disabled={running}
                className="bg-[#07080c] border border-[#1F2937] px-2 py-1.5 text-[11px] font-mono text-[#F3F4F6] outline-none disabled:opacity-40"
              />
              <input
                data-testid="grid-h"
                type="number"
                value={gridH}
                min={12}
                max={40}
                onChange={(e) => setGridH(Number(e.target.value))}
                disabled={running}
                className="bg-[#07080c] border border-[#1F2937] px-2 py-1.5 text-[11px] font-mono text-[#F3F4F6] outline-none disabled:opacity-40"
              />
            </div>
            <div className="flex gap-2">
              <button
                data-testid="regen-fixed-btn"
                onClick={() => {
                  controls.regenerate({ seed, width: gridW, height: gridH, randomLayout: false });
                  toast.success("Fixed warehouse generated");
                }}
                disabled={running}
                className="flex-1 px-2 py-1.5 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black transition-colors duration-150 font-display text-[10px] uppercase disabled:opacity-40"
              >
                Fixed Layout
              </button>
              <button
                data-testid="regen-random-btn"
                onClick={() => {
                  controls.regenerate({ seed, width: gridW, height: gridH, randomLayout: true });
                  toast.success("Random warehouse generated");
                }}
                disabled={running}
                className="flex-1 px-2 py-1.5 border border-[#B026FF] text-[#B026FF] hover:bg-[#B026FF] hover:text-black transition-colors duration-150 font-display text-[10px] uppercase disabled:opacity-40"
              >
                Random Layout
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Panel>
  );
}
