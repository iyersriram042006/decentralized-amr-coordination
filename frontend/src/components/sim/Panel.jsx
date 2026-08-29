import { cn } from "@/lib/utils";

export function Panel({ title, icon: Icon, active, right, className, children, bodyClass, testId }) {
  return (
    <div
      data-testid={testId}
      className={cn("panel flex flex-col transition-colors duration-200", active && "panel-active", className)}
    >
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1F2937] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon size={13} className="text-[#00E5FF] shrink-0" />}
            <span className="font-display text-[11px] uppercase tracking-wider text-[#9CA3AF] truncate">
              {title}
            </span>
          </div>
          {right}
        </div>
      )}
      <div className={cn("flex-1 min-h-0", bodyClass)}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, accent = "#F3F4F6", testId }) {
  return (
    <div className="px-3 py-2 border border-[#1F2937] bg-[#07080c]" data-testid={testId}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563]">{label}</div>
      <div className="font-display text-lg font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
