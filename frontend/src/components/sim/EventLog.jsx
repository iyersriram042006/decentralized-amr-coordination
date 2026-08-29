import { useEffect, useRef, useState } from "react";
import { Panel } from "./Panel";
import { Terminal, Download } from "lucide-react";
import { CATEGORY_COLOR, LEVEL_COLOR } from "./theme";

export default function EventLog({ snapshot, categoryFilter, onClearFilter }) {
  const [q, setQ] = useState("");
  const scrollRef = useRef(null);
  const events = snapshot.events.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (q && !(`${e.category} ${e.message}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [snapshot.events.length, categoryFilter, q]);

  const exportCsv = () => {
    const rows = [["tick", "category", "message"], ...events.map((e) => [e.tick, e.category, e.message])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "event_log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      title="Event Log"
      icon={Terminal}
      testId="event-log"
      className="h-full"
      bodyClass="flex flex-col"
      right={
        <div className="flex items-center gap-2">
          {categoryFilter && (
            <button
              onClick={onClearFilter}
              className="font-mono text-[9px] text-[#FF6D00] hover:text-[#FF003C] uppercase"
              data-testid="clear-log-filter"
            >
              {categoryFilter} ✕
            </button>
          )}
          <button onClick={exportCsv} data-testid="export-log-btn" className="text-[#9CA3AF] hover:text-[#00E5FF]">
            <Download size={12} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        <input
          data-testid="log-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter logs…"
          className="bg-[#07080c] border-b border-[#1F2937] outline-none text-[11px] font-mono text-[#F3F4F6] px-3 py-1.5 placeholder:text-[#4B5563]"
        />
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto px-2 py-1.5 font-mono text-[11px] leading-relaxed">
          {events.length === 0 && <div className="text-[#4B5563] px-1">— no events —</div>}
          {events.map((e, i) => (
            <div key={i} className="flex gap-2 hover:bg-[#13151d] px-1">
              <span className="text-[#4B5563] tabular-nums shrink-0">{String(e.tick).padStart(4, "0")}</span>
              <span
                className="shrink-0 uppercase text-[9px] mt-0.5 w-[52px] truncate"
                style={{ color: CATEGORY_COLOR[e.category] || "#9CA3AF" }}
                title={e.category}
              >
                {e.category.split(" ")[0]}
              </span>
              <span style={{ color: LEVEL_COLOR[e.level] || "#9CA3AF" }} className="flex-1">
                {e.message}
              </span>
            </div>
          ))}
          <span className="blink text-[#00E5FF]">▊</span>
        </div>
      </div>
    </Panel>
  );
}
