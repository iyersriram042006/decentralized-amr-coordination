import { useMemo } from "react";
import { STATUS_COLOR, BATTERY_COLOR } from "./theme";

// Shared responsive warehouse grid. Scales to container width via aspect-ratio.
export default function GridView({
  snapshot,
  interactive = false,
  onCellClick,
  selectedRobot = null,
  showPaths = true,
  compact = false,
}) {
  const { warehouse, robots, dynamic } = snapshot;
  const { width, height } = warehouse;

  const staticSet = warehouse.staticSet;
  const zoneMap = useMemo(() => {
    const m = {};
    const put = (cells, z) => cells?.forEach((c) => (m[c[0] + "," + c[1]] = z));
    put(warehouse.zones.storage, "storage");
    put(warehouse.zones.packing, "packing");
    put(warehouse.zones.charging, "charging");
    return m;
  }, [warehouse]);

  const chokeSet = useMemo(
    () => new Set((warehouse.chokePoints || []).map((c) => c[0] + "," + c[1])),
    [warehouse]
  );
  const deadSet = useMemo(
    () => new Set(dynamic.filter((d) => d.dead).map((d) => d.cell[0] + "," + d.cell[1])),
    [dynamic]
  );
  const blockSet = useMemo(
    () => new Set(dynamic.filter((d) => !d.dead).map((d) => d.cell[0] + "," + d.cell[1])),
    [dynamic]
  );

  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = x + "," + y;
      const isRack = staticSet.has(k);
      const zone = zoneMap[k];
      const choke = chokeSet.has(k);
      const dead = deadSet.has(k);
      const blocked = blockSet.has(k);
      let bg = "transparent";
      if (isRack) bg = "#12141c";
      else if (zone === "storage") bg = "rgba(0,229,255,0.05)";
      else if (zone === "packing") bg = "rgba(57,255,20,0.05)";
      else if (zone === "charging") bg = "rgba(57,255,20,0.12)";
      cells.push(
        <div
          key={k}
          onClick={interactive && onCellClick ? () => onCellClick([x, y]) : undefined}
          className={interactive ? "cursor-crosshair" : ""}
          style={{
            background: bg,
            borderRight: "1px solid rgba(31,41,55,0.35)",
            borderBottom: "1px solid rgba(31,41,55,0.35)",
            boxShadow: isRack ? "inset 0 0 0 1px rgba(55,65,81,0.4)" : "none",
            position: "relative",
          }}
        >
          {choke && (
            <div
              style={{
                position: "absolute",
                inset: "12%",
                border: "1px dashed rgba(255,109,0,0.7)",
              }}
            />
          )}
          {blocked && (
            <div
              style={{
                position: "absolute",
                inset: "10%",
                background:
                  "repeating-linear-gradient(45deg,#FF6D00,#FF6D00 3px,#1a1206 3px,#1a1206 6px)",
              }}
            />
          )}
          {dead && (
            <div
              style={{
                position: "absolute",
                inset: "8%",
                background: "rgba(255,0,60,0.25)",
                border: "1px solid #FF003C",
              }}
            />
          )}
        </div>
      );
    }
  }

  // path overlays
  const pathDots = [];
  if (showPaths) {
    for (const r of robots) {
      const showThis = selectedRobot === r.robot_id || selectedRobot === null;
      if (!showThis || !r.alive) continue;
      const isSel = selectedRobot === r.robot_id;
      (r.planned_path || []).forEach((c, i) => {
        if (i === 0) return;
        pathDots.push(
          <div
            key={r.robot_id + "-p" + i}
            style={{
              position: "absolute",
              left: `${((c[0] + 0.5) / width) * 100}%`,
              top: `${((c[1] + 0.5) / height) * 100}%`,
              width: isSel ? 5 : 3,
              height: isSel ? 5 : 3,
              transform: "translate(-50%,-50%)",
              background: STATUS_COLOR[r.status] || "#00E5FF",
              opacity: isSel ? 0.8 : 0.28,
              borderRadius: "50%",
            }}
          />
        );
      });
    }
  }

  return (
    <div
      className="relative w-full grid-bg"
      style={{ aspectRatio: `${width} / ${height}`, background: "#07080c" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${width}, 1fr)`,
          gridTemplateRows: `repeat(${height}, 1fr)`,
          borderTop: "1px solid rgba(31,41,55,0.35)",
          borderLeft: "1px solid rgba(31,41,55,0.35)",
        }}
      >
        {cells}
      </div>

      {pathDots}

      {robots.map((r) => {
        const color = STATUS_COLOR[r.status] || "#4B5563";
        const batteryColor = BATTERY_COLOR[r.battery_state] || "#39FF14";
        const size = compact ? "3.4%" : "3.0%";
        const active = ["waiting", "blocked", "rerouting", "error"].includes(r.status);
        return (
          <div
            key={r.robot_id}
            className="robot-marker"
            style={{
              position: "absolute",
              left: `${((r.position[0] + 0.5) / width) * 100}%`,
              top: `${((r.position[1] + 0.5) / height) * 100}%`,
              width: `min(${size === "3.4%" ? "3.4" : "3.0"}vw, 26px)`,
              height: `min(${size === "3.4%" ? "3.4" : "3.0"}vw, 26px)`,
              minWidth: 12,
              minHeight: 12,
              transform: "translate(-50%,-50%)",
              zIndex: r.robot_id === selectedRobot ? 30 : 20,
            }}
          >
            <div
              className={r.status === "error" ? "pulse-critical" : ""}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: r.alive ? "#0a0b10" : "#1a0508",
                border: `2px solid ${color}`,
                boxShadow: `0 0 10px -1px ${color}${active ? "" : "88"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "clamp(6px, 0.75vw, 10px)",
                fontWeight: 700,
                color: r.alive ? color : "#6B7280",
              }}
            >
              {r.robot_id}
              {/* battery ring */}
              <div
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: "50%",
                  background: `conic-gradient(${batteryColor} ${r.battery * 3.6}deg, transparent 0deg)`,
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                  opacity: 0.9,
                }}
              />
              {r.is_task_manager && (
                <div
                  title="Task Manager"
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#39FF14",
                    boxShadow: "0 0 6px #39FF14",
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
