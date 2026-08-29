import { useState } from "react";
import { Panel } from "./Panel";
import { Users, Search } from "lucide-react";
import { STATUS_COLOR, BATTERY_COLOR } from "./theme";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function RobotRoster({ snapshot, selected, onSelect }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const robots = snapshot.robots.filter((r) => {
    if (q && !r.robot_id.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <Panel title="Robot Roster" icon={Users} testId="robot-roster" className="h-full" bodyClass="flex flex-col">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#1F2937]">
        <div className="flex items-center gap-1 flex-1 bg-[#07080c] border border-[#1F2937] px-2">
          <Search size={11} className="text-[#4B5563]" />
          <input
            data-testid="roster-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ID"
            className="bg-transparent outline-none text-[11px] font-mono text-[#F3F4F6] py-1 w-full placeholder:text-[#4B5563]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            data-testid="roster-status-filter"
            className="w-[92px] h-auto rounded-none bg-[#07080c] border-[#1F2937] text-[10px] font-mono text-[#9CA3AF] px-1.5 py-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0b10] border-[#1F2937] rounded-none">
            {["all", "idle", "moving", "waiting", "rerouting", "charging", "error"].map((s) => (
              <SelectItem key={s} value={s} className="text-[11px] font-mono text-[#9CA3AF]">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="sticky top-0 bg-[#0a0b10] z-10">
            <tr className="text-[#4B5563] text-left">
              <th className="px-2 py-1.5 font-normal">ID</th>
              <th className="px-1 py-1.5 font-normal">Pos</th>
              <th className="px-1 py-1.5 font-normal">Status</th>
              <th className="px-1 py-1.5 font-normal">Batt</th>
              <th className="px-1 py-1.5 font-normal">Task</th>
            </tr>
          </thead>
          <tbody>
            {robots.map((r) => (
              <tr
                key={r.robot_id}
                data-testid={`roster-row-${r.robot_id}`}
                onClick={() => onSelect(selected === r.robot_id ? null : r.robot_id)}
                className="cursor-pointer border-b border-[#12141c] hover:bg-[#13151d] transition-colors duration-150"
                style={{ background: selected === r.robot_id ? "#13151d" : "transparent" }}
              >
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    <span style={{ color: STATUS_COLOR[r.status] }}>{r.robot_id}</span>
                    {r.is_task_manager && <span className="text-[#39FF14] text-[8px]">TM</span>}
                    {r.priority_class === "high" && <span className="text-[#00E5FF] text-[8px]">★</span>}
                  </span>
                </td>
                <td className="px-1 py-1.5 text-[#9CA3AF] tabular-nums">
                  {r.position[0]},{r.position[1]}
                </td>
                <td className="px-1 py-1.5">
                  <span style={{ color: STATUS_COLOR[r.status] }}>{r.status}</span>
                </td>
                <td className="px-1 py-1.5 tabular-nums" style={{ color: BATTERY_COLOR[r.battery_state] }}>
                  {r.battery.toFixed(0)}%
                </td>
                <td className="px-1 py-1.5 text-[#9CA3AF]">{r.current_task ? r.current_task.id : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
