import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { toast } from "sonner";
import { useSimulation } from "@/hooks/useSimulation";
import GridView from "@/components/sim/GridView";
import {
  Cpu, Radio, Route, Lock, Zap, Shuffle, BatteryCharging, GitBranch,
  Network, Gauge, ArrowRight, Server, CircuitBoard, Send, Boxes, ShieldCheck,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const HERO_BG =
  "https://images.unsplash.com/photo-1701313056413-0915e1adf204?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwzfHxhdXRvbm9tb3VzJTIwd2FyZWhvdXNlJTIwcm9ib3RzfGVufDB8fHx8MTc4ODAzMDY2Mnww&ixlib=rb-4.1.0&q=85";

function useAutoSim() {
  const sim = useSimulation({ speed: 5 });
  useEffect(() => {
    sim.controls.play();
    return () => sim.controls.pause();
    // eslint-disable-next-line
  }, []);
  return sim;
}

export default function Landing() {
  const { snapshot } = useAutoSim();

  return (
    <div className="min-h-screen bg-[#050505] text-[#F3F4F6]">
      <Nav />
      <Hero snapshot={snapshot} />
      <ProblemBand />
      <FourProblems />
      <Decentralized />
      <Algorithms />
      <SuccessCriteria />
      <TechStack />
      <Team />
      <DemoForm />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-[#1F2937]">
      <div className="max-w-7xl mx-auto flex items-center gap-4 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#00E5FF] box-glow-cyan" />
          <span className="font-display text-sm uppercase tracking-widest font-bold">
            Grid<span className="text-[#00E5FF]">Lock</span>
          </span>
        </div>
        <span className="font-mono text-[10px] text-[#4B5563] hidden md:block">SIH 26123 / BEL</span>
        <div className="ml-auto flex items-center gap-3">
          <a href="#algorithms" className="font-mono text-[11px] text-[#9CA3AF] hover:text-[#00E5FF] transition-colors duration-150 hidden sm:block">
            algorithms
          </a>
          <a href="#architecture" className="font-mono text-[11px] text-[#9CA3AF] hover:text-[#00E5FF] transition-colors duration-150 hidden sm:block">
            architecture
          </a>
          <Link
            to="/dashboard"
            data-testid="nav-launch-dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#00E5FF] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black transition-colors duration-150 font-display text-[11px] uppercase tracking-wider box-glow-cyan"
          >
            Launch Console <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero({ snapshot }) {
  const m = snapshot.metrics;
  return (
    <section className="relative overflow-hidden border-b border-[#1F2937]">
      <div
        className="absolute inset-0 opacity-25"
        style={{ backgroundImage: `url(${HERO_BG})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/50" />
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 px-5 py-16 lg:py-24 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 border border-[#1F2937] px-3 py-1 mb-5"
          >
            <Radio size={12} className="text-[#39FF14]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#9CA3AF]">
              Edge-AI · Decentralized · No Central Server
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]"
          >
            DISTRIBUTED FLEET
            <br />
            COORDINATION FOR{" "}
            <span className="text-[#00E5FF] glow">AUTONOMOUS</span> ROBOTS
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-5 text-[#9CA3AF] text-base leading-relaxed max-w-xl"
          >
            A peer-to-peer collision-avoidance and task-allocation framework that runs entirely on
            on-board edge hardware. Robots share position and intent locally, resolve deadlocks at
            choke points in real time, and re-route around blocked aisles — with no single point of
            failure.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-7 flex flex-wrap gap-3"
          >
            <Link
              to="/dashboard"
              data-testid="hero-launch-btn"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00E5FF] text-black hover:bg-white transition-colors duration-150 font-display text-sm uppercase tracking-wider font-bold box-glow-cyan"
            >
              Open Live Simulation <ArrowRight size={16} />
            </Link>
            <a
              href="#architecture"
              className="flex items-center gap-2 px-5 py-2.5 border border-[#374151] text-[#F3F4F6] hover:border-[#00E5FF] hover:text-[#00E5FF] transition-colors duration-150 font-display text-sm uppercase tracking-wider"
            >
              How It Works
            </a>
          </motion.div>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            <MiniStat label="AMRs Online" value={snapshot.robots.filter((r) => r.alive).length} color="#00E5FF" />
            <MiniStat label="Conflicts Resolved" value={m.collisionsAvoided + m.deadlocksResolved} color="#39FF14" />
            <MiniStat label="Reroutes" value={m.reroutes} color="#FF6D00" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="panel p-3 box-glow-cyan"
          data-testid="hero-live-grid"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="font-display text-[10px] uppercase tracking-wider text-[#9CA3AF]">
              Live Warehouse · tick{" "}
              <span data-testid="hero-tick">{String(snapshot.tick).padStart(4, "0")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
              <span className="font-mono text-[9px] uppercase text-[#39FF14]">streaming</span>
            </span>
          </div>
          <div className="scanline relative">
            <GridView snapshot={snapshot} compact showPaths />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {snapshot.robots.slice(0, 4).map((r) => (
              <div key={r.robot_id} className="border border-[#1F2937] px-1.5 py-1">
                <div className="font-mono text-[9px] text-[#9CA3AF]">{r.robot_id}{r.is_task_manager ? " ·TM" : ""}</div>
                <div className="font-mono text-[10px] tabular-nums" style={{ color: r.battery_state === "normal" ? "#39FF14" : r.battery_state === "low" ? "#FF6D00" : "#FF003C" }}>
                  {r.battery.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="border border-[#1F2937] px-3 py-2 bg-black/40">
      <div className="font-display text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-[#4B5563]">{label}</div>
    </div>
  );
}

function ProblemBand() {
  return (
    <section className="border-b border-[#1F2937] bg-[#07080c]">
      <div className="max-w-7xl mx-auto px-5 py-10 grid md:grid-cols-3 gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#00E5FF] mb-2">Problem · SIH 26123</div>
          <h2 className="font-display text-lg md:text-lg font-bold uppercase tracking-tight leading-tight">
            Edge-AI Distributed Fleet Coordination for AMRs in Smart Warehouses
          </h2>
        </div>
        <p className="md:col-span-2 text-[#9CA3AF] text-sm leading-relaxed">
          As fleets grow, a centralized cloud planner introduces network latency, Wi-Fi dead-zone
          vulnerabilities, and single-point-of-failure risk. We move decision-making onto each robot's
          edge computer — robots talk directly to each other, make split-second decisions locally, and
          keep operating even when connectivity or a peer fails. Organization:{" "}
          <span className="text-[#F3F4F6]">Bharat Electronics Limited (BEL)</span> · Theme:{" "}
          <span className="text-[#F3F4F6]">Smart Automation</span>.
        </p>
      </div>
    </section>
  );
}

const PROBLEMS = [
  { icon: Zap, color: "#00E5FF", title: "Collision Avoidance", body: "Every tick each robot predicts near-future positions from broadcast state, computes tick-based Time-to-Collision, and applies a shared priority rule — one yields, one proceeds, no central referee." },
  { icon: Lock, color: "#FF003C", title: "Deadlock Resolution", body: "A wait-for graph is built from broadcast statuses and scanned for cycles. A confirmed cycle triggers a deterministic priority check that breaks the standoff at narrow intersections." },
  { icon: Route, color: "#FF6D00", title: "Blocked-Path Re-Routing", body: "When a planned path crosses a newly-blocked cell, D* Lite incrementally repairs the route around the obstacle — no full replan, no stop-and-wait stall." },
  { icon: Shuffle, color: "#B026FF", title: "Task Re-Allocation", body: "If re-routing is costlier than re-assignment, the robot broadcasts a release request and the Task-Manager role re-optimizes the batch with the Hungarian algorithm." },
];

function FourProblems() {
  return (
    <section className="max-w-7xl mx-auto px-5 py-16">
      <SectionTitle kicker="Four live sub-systems" title="The problems we solve, in real time" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        {PROBLEMS.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="panel p-4 hover:bg-[#13151d] transition-colors duration-200"
          >
            <p.icon size={20} style={{ color: p.color }} className="glow" />
            <h3 className="font-display text-sm uppercase tracking-wide mt-3 mb-2" style={{ color: p.color }}>
              {p.title}
            </h3>
            <p className="text-[#9CA3AF] text-[13px] leading-relaxed">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Decentralized() {
  const steps = [
    { icon: Network, title: "Peer-to-Peer Broadcast", body: "One in-process broadcast channel carries every robot's position, velocity, battery and intent each tick. A robot reads its own state directly, and every other robot's state only from the channel — mirroring real MQTT/Zenoh/ROS 2 topics." },
    { icon: Cpu, title: "Task Manager as a Role", body: "One robot holds the TM role: it queues tasks and broadcasts Hungarian-optimized assignments. It never writes into another robot's memory — each robot applies its own assignment and ACKs back." },
    { icon: GitBranch, title: "Deterministic Failover", body: "Every robot tracks TM liveness against the tick counter. If the TM goes silent, the lowest-ID live robot is elected, bumps the epoch, and stale messages from the old TM are rejected." },
    { icon: ShieldCheck, title: "ACK + Dead-Zone Recovery", body: "Assignments and release requests require acknowledgement. A lost message times out, retries once, then the task falls back to the queue — the exact Wi-Fi dead-zone defense the brief calls for." },
  ];
  return (
    <section id="architecture" className="border-y border-[#1F2937] bg-[#07080c]">
      <div className="max-w-7xl mx-auto px-5 py-16">
        <SectionTitle kicker="Architecture" title="No central server. A coordination role that moves." />
        <div className="grid lg:grid-cols-2 gap-4 mt-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, x: i % 2 ? 12 : -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="panel p-5 flex gap-4"
            >
              <div className="shrink-0 w-10 h-10 border border-[#1F2937] flex items-center justify-center">
                <s.icon size={18} className="text-[#00E5FF]" />
              </div>
              <div>
                <h3 className="font-display text-sm uppercase tracking-wide mb-1.5">{s.title}</h3>
                <p className="text-[#9CA3AF] text-[13px] leading-relaxed">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const ALGOS = [
  { icon: Route, name: "A* Planner", tag: "one-shot", body: "Optimal initial path on the known static map." },
  { icon: GitBranch, name: "D* Lite", tag: "incremental", body: "Repairs an existing plan around newly discovered obstacles." },
  { icon: Boxes, name: "Hungarian / APTA", tag: "batch", body: "scipy-style optimal task→robot assignment on a travel + priority + battery cost matrix." },
  { icon: Gauge, name: "Priority Function", tag: "shared", body: "urgency ÷ time-remaining, reused identically by collision & deadlock resolution." },
  { icon: Zap, name: "Time-to-Collision", tag: "tick-based", body: "Relative position & velocity in grid/tick units; ∞ when not converging." },
  { icon: Lock, name: "Wait-For Cycle", tag: "graph", body: "Cycle detection over broadcast statuses confirms a true deadlock." },
  { icon: Radio, name: "ACK Protocol", tag: "reliable", body: "message_id, timeout, single retry, fallback-to-queue on repeated loss." },
  { icon: BatteryCharging, name: "Battery FSM", tag: "safety", body: "NORMAL / LOW / CRITICAL / DEAD with charging re-routes and dead-cell obstacles." },
];

function Algorithms() {
  return (
    <section id="algorithms" className="max-w-7xl mx-auto px-5 py-16">
      <SectionTitle kicker="The stack under the hood" title="Algorithms, implemented — not hand-waved" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        {ALGOS.map((a, i) => (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: (i % 4) * 0.05 }}
            className="panel p-4 hover:bg-[#13151d] transition-colors duration-200"
          >
            <div className="flex items-center justify-between">
              <a.icon size={17} className="text-[#00E5FF]" />
              <span className="font-mono text-[8px] uppercase tracking-wider text-[#4B5563] border border-[#1F2937] px-1.5 py-0.5">
                {a.tag}
              </span>
            </div>
            <h3 className="font-display text-[13px] uppercase tracking-wide mt-3 mb-1.5 text-[#F3F4F6]">{a.name}</h3>
            <p className="text-[#9CA3AF] text-[12px] leading-relaxed">{a.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SuccessCriteria() {
  return (
    <section className="border-y border-[#1F2937] bg-gradient-to-r from-[#07080c] to-black">
      <div className="max-w-7xl mx-auto px-5 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#39FF14] mb-2">Success criteria</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            Zero inter-robot collisions.
            <br />
            <span className="text-[#39FF14] glow">≥ 20%</span> faster than stop-and-wait.
          </h2>
          <p className="mt-4 text-[#9CA3AF] text-sm leading-relaxed max-w-lg">
            The dashboard runs a headless baseline (naive stop-and-wait, nearest-robot assignment) against
            the full decentralized stack over 20–30 identical seeded trials, and reports the{" "}
            <span className="text-[#F3F4F6]">actual measured improvement</span> — never a hard-coded number.
          </p>
          <Link
            to="/dashboard"
            data-testid="success-run-btn"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 border border-[#39FF14] text-[#39FF14] hover:bg-[#39FF14] hover:text-black transition-colors duration-150 font-display text-sm uppercase tracking-wider"
          >
            Run the comparison <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <BigMetric value="0" label="Target collisions" color="#00E5FF" sub="deterministic yielding" />
          <BigMetric value="≥20%" label="Task-time reduction" color="#39FF14" sub="measured per Rule A" />
          <BigMetric value="3+" label="Minimum AMRs" color="#FF6D00" sub="scales to fleets" />
          <BigMetric value="1 tick" label="Decision clock" color="#B026FF" sub="no wall-clock in logic" />
        </div>
      </div>
    </section>
  );
}

function BigMetric({ value, label, color, sub }) {
  return (
    <div className="panel p-5">
      <div className="font-display text-3xl font-bold tabular-nums glow" style={{ color }}>
        {value}
      </div>
      <div className="font-display text-[11px] uppercase tracking-wide text-[#F3F4F6] mt-1">{label}</div>
      <div className="font-mono text-[9px] text-[#4B5563] mt-0.5">{sub}</div>
    </div>
  );
}

function TechStack() {
  const soft = ["Python edge runtime", "A* + D* Lite", "Hungarian (scipy)", "In-process P2P channel", "Event bus + record/replay", "Streamlit-class dashboard"];
  const hw = [
    { icon: Server, name: "Raspberry Pi 5", body: "Per-robot: comms, planning, collision/deadlock, battery, and TM duties while held." },
    { icon: CircuitBoard, name: "ESP32", body: "Low-level motor control & sensor reads, taking commands from the Pi." },
    { icon: Radio, name: "ROS 2 / Zenoh / MQTT", body: "Documented real-hardware equivalent of the broadcast channel interface." },
  ];
  return (
    <section className="max-w-7xl mx-auto px-5 py-16">
      <SectionTitle kicker="Tech & edge mapping" title="Built for the Pi, proven in simulation" />
      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        <div className="panel p-5">
          <h3 className="font-display text-sm uppercase tracking-wide mb-3 text-[#00E5FF]">Software stack</h3>
          <div className="flex flex-wrap gap-2">
            {soft.map((s) => (
              <span key={s} className="font-mono text-[11px] text-[#9CA3AF] border border-[#1F2937] px-2.5 py-1">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {hw.map((h) => (
            <div key={h.name} className="panel p-4 flex gap-3">
              <h.icon size={18} className="text-[#39FF14] shrink-0 mt-0.5" />
              <div>
                <div className="font-display text-[13px] uppercase tracking-wide">{h.name}</div>
                <div className="font-mono text-[11px] text-[#9CA3AF] leading-relaxed">{h.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Team() {
  const members = ["Team Lead", "Algorithms", "Simulation", "Dashboard", "Edge Hardware", "Docs & Demo"];
  return (
    <section className="border-t border-[#1F2937] bg-[#07080c]">
      <div className="max-w-7xl mx-auto px-5 py-14">
        <SectionTitle kicker="The crew" title="Team Placeholder" />
        <p className="text-[#9CA3AF] text-sm mt-3 max-w-2xl">
          Replace these placeholders with your team name, logo and member details for the final submission.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-8">
          {members.map((r, i) => (
            <div key={i} className="panel p-4 text-center">
              <div className="w-12 h-12 mx-auto border border-[#1F2937] flex items-center justify-center font-display text-lg text-[#00E5FF]">
                {String.fromCharCode(65 + i)}
              </div>
              <div className="font-display text-[11px] uppercase tracking-wide mt-2">Member {i + 1}</div>
              <div className="font-mono text-[9px] text-[#4B5563]">{r}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoForm() {
  const [form, setForm] = useState({ name: "", email: "", org: "", message: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/demo-requests`, form);
      toast.success("Request received", { description: "We'll be in touch about a walkthrough." });
      setForm({ name: "", email: "", org: "", message: "" });
    } catch (err) {
      toast.error("Could not submit — try again");
    } finally {
      setBusy(false);
    }
  };
  const field = (k, ph, type = "text") => (
    <input
      data-testid={`demo-${k}`}
      value={form[k]}
      type={type}
      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
      placeholder={ph}
      className="bg-[#07080c] border border-[#1F2937] px-3 py-2.5 text-sm font-mono text-[#F3F4F6] outline-none focus:border-[#00E5FF] transition-colors duration-150 placeholder:text-[#4B5563]"
    />
  );
  return (
    <section id="demo" className="max-w-7xl mx-auto px-5 py-16">
      <div className="panel grid lg:grid-cols-2">
        <div className="p-8 border-b lg:border-b-0 lg:border-r border-[#1F2937]">
          <SectionTitle kicker="Request a walkthrough" title="See the fleet coordinate live" />
          <p className="text-[#9CA3AF] text-sm leading-relaxed mt-4">
            Want a guided demo of the decentralized coordination stack, or the code for evaluation? Drop
            your details and we'll set up a session. Or just jump straight into the console.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 border border-[#374151] text-[#F3F4F6] hover:border-[#00E5FF] hover:text-[#00E5FF] transition-colors duration-150 font-display text-xs uppercase tracking-wider"
          >
            Skip — open the console <ArrowRight size={14} />
          </Link>
        </div>
        <form onSubmit={submit} className="p-8 grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field("name", "Name *")}
            {field("email", "Email *", "email")}
          </div>
          {field("org", "Organization")}
          <textarea
            data-testid="demo-message"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="What would you like to see?"
            rows={4}
            className="bg-[#07080c] border border-[#1F2937] px-3 py-2.5 text-sm font-mono text-[#F3F4F6] outline-none focus:border-[#00E5FF] transition-colors duration-150 placeholder:text-[#4B5563] resize-none"
          />
          <button
            data-testid="demo-submit"
            disabled={busy}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#00E5FF] text-black hover:bg-white transition-colors duration-150 font-display text-sm uppercase tracking-wider font-bold disabled:opacity-50"
          >
            <Send size={15} /> {busy ? "Sending…" : "Request Demo"}
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#1F2937] bg-black">
      <div className="max-w-7xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#00E5FF]" />
          <span className="font-display text-xs uppercase tracking-widest">GridLock</span>
        </div>
        <span className="font-mono text-[10px] text-[#4B5563]">
          SIH Problem Statement 26123 · Bharat Electronics Limited · Smart Automation
        </span>
        <span className="md:ml-auto font-mono text-[10px] text-[#4B5563]">
          Decentralized · Edge-AI · Deterministic · Tick-based
        </span>
      </div>
    </footer>
  );
}

function SectionTitle({ kicker, title }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[#00E5FF] mb-2">{kicker}</div>
      <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight uppercase leading-tight max-w-2xl">
        {title}
      </h2>
    </div>
  );
}
