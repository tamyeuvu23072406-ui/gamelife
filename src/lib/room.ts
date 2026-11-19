import { drawAgent } from "@/lib/agent-sprite";
import type { Activity, LocationDef, World } from "@/sim/types";
import { dominantEmotion } from "@/sim/util";

type Kind = LocationDef["kind"];
const SETS: Record<Kind, [string, number][]> = {
  home: [["bed", 0.2], ["tv", 0.52], ["sofa", 0.55], ["table", 0.8], ["plant", 0.95]],
  cafe: [["counter", 0.25], ["coffee", 0.18], ["table", 0.6], ["table", 0.85], ["plant", 0.97]],
  restaurant: [["counter", 0.18], ["table", 0.55], ["table", 0.8]],
  market: [["shelf", 0.2], ["shelf", 0.45], ["counter", 0.8], ["plant", 0.97]],
  office: [["desk", 0.2], ["desk", 0.5], ["desk", 0.8], ["shelf", 0.97]],
  school: [["board", 0.4], ["desk", 0.2], ["desk", 0.45], ["desk", 0.7]],
  mall: [["shelf", 0.2], ["shelf", 0.45], ["plant", 0.55], ["counter", 0.8]],
  hospital: [["bed", 0.2], ["bed", 0.55], ["counter", 0.88]],
  park: [["tree", 0.15], ["bench", 0.5], ["fountain", 0.8], ["tree", 0.93]],
};
const FLOOR: Record<Kind, string> = {
  home: "#b88a5a", cafe: "#8a6240", restaurant: "#6b4a3a", market: "#cfd3d6", office: "#9aa3ad",
  school: "#c9b28a", mall: "#d9cdbd", hospital: "#e5ecef", park: "#6aa86a",
};
const WANT: Partial<Record<Activity, string[]>> = {
  sleeping: ["bed"], working: ["desk", "counter", "board"], eating: ["table", "counter"],
  drinking: ["table", "counter"], relaxing: ["sofa", "bench", "table"], treatment: ["bed"],
};
const BOOKS = ["#ef4444", "#3b82f6", "#eab308", "#22c55e"];

function item(c: CanvasRenderingContext2D, type: string, x: number, y: number, k: number, t: number) {
  const R = (dx: number, dy: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(x + dx * k, y + dy * k, w * k, h * k);
  };
  const O = (dx: number, dy: number, r: number, col: string) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(x + dx * k, y + dy * k, r * k, 0, Math.PI * 2);
    c.fill();
  };
  const glow = `rgba(125,200,255,${0.55 + 0.15 * Math.sin(t * 3 + x)})`;
  switch (type) {
    case "bed": R(-1.3, -0.45, 2.6, 0.45, "#7c5a3a"); R(-1.3, -1, 0.12, 1, "#5b3f27"); R(-1.2, -0.7, 2.4, 0.3, "#e2e8f0"); R(-0.2, -0.72, 1.4, 0.32, "#60a5fa"); R(-1.15, -0.8, 0.5, 0.2, "#fff"); break;
    case "sofa": R(-1, -1, 2, 0.6, "#a1626b"); R(-1, -0.55, 2, 0.4, "#c07c86"); R(-1.1, -0.7, 0.2, 0.7, "#8c4f58"); R(0.9, -0.7, 0.2, 0.7, "#8c4f58"); break;
    case "tv": R(-0.9, -0.45, 1.8, 0.45, "#6b4a3a"); R(-0.7, -1.3, 1.4, 0.85, "#0f172a"); R(-0.62, -1.22, 1.24, 0.69, glow); break;
    case "table": R(-0.9, -0.7, 1.8, 0.12, "#92400e"); R(-0.8, -0.58, 0.1, 0.58, "#78350f"); R(0.7, -0.58, 0.1, 0.58, "#78350f"); O(0.3, -0.78, 0.1, "#f8fafc"); break;
    case "counter": R(-1.4, -0.9, 2.8, 0.9, "#6b4a3a"); R(-1.45, -0.95, 2.9, 0.1, "#d6c3a5"); break;
    case "coffee": R(-0.3, -1.5, 0.6, 0.55, "#374151"); O(0, -1.3, 0.05, "#ef4444"); break;
    case "desk": R(-1, -0.75, 2, 0.1, "#d6c3a5"); R(-0.9, -0.65, 0.1, 0.65, "#94a3b8"); R(0.8, -0.65, 0.1, 0.65, "#94a3b8"); R(-0.35, -1.3, 0.7, 0.5, "#0f172a"); R(-0.3, -1.25, 0.6, 0.4, glow); break;
    case "shelf":
      R(-0.8, -2, 1.6, 2, "#8b5e3c");
      for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) R(-0.7 + q * 0.37, -1.85 + r * 0.62, 0.3, 0.5, BOOKS[(r + q) % 4] ?? "#888");
      break;
    case "plant": R(-0.2, -0.4, 0.4, 0.4, "#b45309"); O(0, -0.75, 0.4, "#16a34a"); break;
    case "board": R(-1.5, -2.4, 3, 1.2, "#14532d"); break;
    case "tree": R(-0.15, -1.6, 0.3, 1.6, "#78350f"); O(0, -2.1, 0.9, "#15803d"); break;
    case "bench": R(-1, -0.95, 2, 0.1, "#92400e"); R(-1, -0.5, 2, 0.1, "#92400e"); R(-0.9, -0.4, 0.1, 0.4, "#78350f"); R(0.8, -0.4, 0.1, 0.4, "#78350f"); break;
    case "fountain":
      c.fillStyle = "#94a3b8";
      c.beginPath();
      c.ellipse(x, y - 0.2 * k, 1.1 * k, 0.3 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#7dd3fc";
      c.beginPath();
      c.ellipse(x, y - 0.25 * k, 0.9 * k, 0.22 * k, 0, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 3; i++) O(Math.sin(t * 3 + i) * 0.1, -0.6 - ((t * 1.5 + i / 3) % 1) * 0.6, 0.05, "#bae6fd");
      break;
  }
}

/** Cutaway view of the room `loc` with its furniture and the characters currently inside. */
export function drawRoom(c: CanvasRenderingContext2D, W: number, H: number, w: World, loc: LocationDef, t: number, sel: string) {
  const hour = (w.minute / 60) % 24;
  const night = hour >= 19 || hour < 6;
  const dusk = (hour >= 17 && hour < 19) || (hour >= 6 && hour < 8);
  const sky = w.weather === "rain" ? "#64748b" : night ? "#0b1230" : dusk ? "#f59e6b" : "#8ec9f5";
  const k = W / 10;
  const fy = H * 0.7;
  const out = loc.kind === "park";
  c.fillStyle = out ? sky : (loc.build?.wall ?? "#e5e7eb");
  c.fillRect(0, 0, W, fy);
  c.fillStyle = FLOOR[loc.kind];
  c.fillRect(0, fy, W, H - fy);
  const [wx, wy, ww, wh] = out ? [0, 0, W, fy] : [W * 0.72, H * 0.08, 2.2 * k, 1.6 * k];
  if (!out) {
    c.fillStyle = "#475569";
    c.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
    c.fillStyle = sky;
    c.fillRect(wx, wy, ww, wh);
  }
  if (w.weather === "rain") {
    c.strokeStyle = "rgba(200,220,255,.6)";
    c.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const x = wx + ((i * 83) % ww);
      const y = wy + ((i * 47 + t * 200) % wh);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 2, y + 7);
      c.stroke();
    }
  }
  const base = fy + (H - fy) * 0.5;
  for (const [type, fx] of SETS[loc.kind]) item(c, type, fx * W, base, k, t);
  if (night) {
    c.fillStyle = "rgba(15,23,42,.35)";
    c.fillRect(0, 0, W, H);
  }
  const here = w.agents.filter((a) => a.alive && a.locationId === loc.id && !a.travel);
  const talking = new Set(w.lines.slice(-8).filter((l) => w.minute - l.minute <= 20).map((l) => l.speakerId));
  const used: Record<string, number> = {};
  const u = Math.min(k * 0.8, 26);
  here.forEach((a, i) => {
    let x = ((i + 1) / (here.length + 1)) * W;
    let y = base + (H - fy) * 0.3;
    for (const type of WANT[a.activity] ?? []) {
      const it = SETS[loc.kind].find(([n]) => n === type);
      if (!it) continue;
      const n = used[type] ?? 0;
      used[type] = n + 1;
      x = it[1] * W + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * k * 0.9;
      y = a.activity === "sleeping" ? base : base + (H - fy) * 0.2;
      break;
    }
    if (a.id === sel) {
      c.strokeStyle = "#facc15";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(x, y, u * 1.1, u * 0.4, 0, 0, Math.PI * 2);
      c.stroke();
    }
    drawAgent(c, a, x, y, u, { t, moving: false, fx: 0, fz: 1, speaking: talking.has(a.id), mood: dominantEmotion(a.emotions) });
    c.font = "11px sans-serif";
    c.textAlign = "center";
    c.fillStyle = night ? "#e2e8f0" : "#0f172a";
    c.fillText(a.given, x, Math.min(H - 3, y + 14));
  });
  c.font = "12px sans-serif";
  c.textAlign = "left";
  c.fillStyle = night ? "#e2e8f0" : "#0f172a";
  c.fillText(loc.name, 8, 16);
}
