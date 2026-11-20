import type { Agent, EmotionKey } from "@/sim/types";

const MOOD: Partial<Record<EmotionKey, string>> = {
  joy: "😊",
  sadness: "😢",
  anger: "😠",
  anxiety: "😰",
  jealousy: "😒",
  shame: "😳",
  loneliness: "😞",
  disappointment: "😕",
  love: "💕",
};

export type Pose = {
  t: number;
  moving: boolean;
  fx: number;
  fz: number;
  speaking: boolean;
  mood?: { key: EmotionKey; value: number };
  rain?: boolean;
  badge?: boolean;
};

/** Draws one character with its feet at (x, y). `u` = pixels per world unit, `p.t` = animation clock (s). */
export function drawAgent(ctx: CanvasRenderingContext2D, a: Agent, x: number, y: number, u: number, p: Pose) {
  const ap = a.appearance;
  const s = u * (ap.height > 3 ? ap.height / 170 : ap.height);
  const t = p.t;
  const act = a.activity;
  const len = Math.hypot(p.fx, p.fz) || 1;
  const fx = p.fx / len;
  const back = p.fz / len < -0.4;
  const dot = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const limb = (x1: number, y1: number, x2: number, y2: number, w: number, c: string) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.7 * s, 0.25 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (act === "sleeping") {
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.roundRect(-1.3 * s, -0.9 * s, 2.6 * s, 1.0 * s, 0.2 * s);
    ctx.fill();
    ctx.fillStyle = ap.outfit;
    ctx.beginPath();
    ctx.roundRect(-0.5 * s, -0.95 * s, 1.7 * s, 0.7 * s, 0.3 * s);
    ctx.fill();
    ctx.fillStyle = ap.skin;
    dot(-0.85 * s, -0.65 * s, 0.38 * s);
    ctx.fillStyle = ap.hair;
    ctx.beginPath();
    ctx.arc(-0.85 * s, -0.65 * s, 0.4 * s, Math.PI * 0.6, Math.PI * 1.6);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${0.8 * s}px sans-serif`;
    ctx.textAlign = "center";
    for (let i = 0; i < 3; i++) ctx.fillText("z", -0.4 * s + i * 0.5 * s, -1.3 * s - ((t * 0.5 + i * 0.33) % 1) * 0.9 * s);
    ctx.restore();
    return;
  }

  const phase = t * 9;
  const swing = p.moving ? Math.sin(phase) : 0;
  const bob = p.moving ? Math.abs(Math.sin(phase)) * 0.12 * s : Math.sin(t * 2 + x) * 0.04 * s;
  if (act === "relaxing" && !p.moving) ctx.rotate(Math.sin(t * 1.5) * 0.05);

  for (const d of [-1, 1]) {
    const sw = swing * d;
    limb(d * 0.2 * s, -0.95 * s - bob, d * 0.2 * s + sw * 0.35 * s, -Math.max(0, sw) * 0.2 * s, 0.32 * s, ap.pants);
  }
  ctx.fillStyle = ap.outfit;
  ctx.beginPath();
  ctx.roundRect(-0.42 * s, -2.05 * s - bob, 0.84 * s, 1.1 * s, 0.2 * s);
  ctx.fill();

  const home = a.locationId === a.homeId && !p.moving;
  const kind = home ? "casual" : /Bác sĩ|Điều dưỡng/.test(a.job) ? "coat" : /Bếp|Chủ quán|Quản lý/.test(a.job) ? "apron" : /Giáo viên/.test(a.job) ? "tie" : "casual";
  if (p.rain) {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.roundRect(-0.46 * s, -2.08 * s - bob, 0.92 * s, 1.3 * s, 0.2 * s);
    ctx.fill();
  } else if (kind === "coat") {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(-0.46 * s, -2.08 * s - bob, 0.92 * s, 1.5 * s, 0.15 * s);
    ctx.fill();
  } else if (kind === "apron") {
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(-0.3 * s, -1.7 * s - bob, 0.6 * s, 0.75 * s);
  } else if (kind === "tie") {
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(-0.06 * s, -2.0 * s - bob, 0.12 * s, 0.6 * s);
  }
  if (act === "working" && !p.moving) {
    const glow = 0.18 + 0.1 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(125,200,255,${glow})`;
    dot(0, -1.3 * s, 0.9 * s);
    ctx.fillStyle = "#334155";
    ctx.fillRect(-0.45 * s, -1.55 * s, 0.9 * s, 0.5 * s);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(-0.55 * s, -1.05 * s, 1.1 * s, 0.1 * s);
  }
  if (act === "eating" && !p.moving) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(0.85 * s, -0.5 * s, 0.4 * s, 0.15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f97316";
    dot(0.85 * s, -0.55 * s, 0.1 * s);
  }

  let hl: [number, number] = [-0.55 * s, -1.0 * s - bob];
  let hr: [number, number] = [0.55 * s, -1.0 * s - bob];
  if (p.moving) {
    hl = [-0.5 * s, -1.1 * s - bob + swing * 0.4 * s];
    hr = [0.5 * s, -1.1 * s - bob - swing * 0.4 * s];
  } else if (act === "working") {
    hl = [-0.25 * s, -1.1 * s + Math.sin(t * 14) * 0.1 * s];
    hr = [0.25 * s, -1.1 * s + Math.sin(t * 14 + 2) * 0.1 * s];
  } else if (act === "eating" || act === "drinking") {
    hr = [0.25 * s, -2.25 * s - bob + Math.sin(t * 5) * 0.1 * s];
  } else if (p.speaking || act === "socializing") {
    hr = [0.7 * s, -1.7 * s + Math.sin(t * 6) * 0.25 * s];
  }
  if (act === "shopping") {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(hl[0] - 0.25 * s, hl[1], 0.5 * s, 0.45 * s);
  }
  if (act === "drinking") {
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(hr[0] - 0.08 * s, hr[1] - 0.25 * s, 0.16 * s, 0.25 * s);
  }
  for (const [sx, h] of [[-0.45, hl], [0.45, hr]] as const) {
    limb(sx * s, -1.95 * s - bob, h[0], h[1], 0.24 * s, ap.outfit);
    ctx.fillStyle = ap.skin;
    dot(h[0], h[1], 0.13 * s);
  }

  const hy = -2.55 * s - bob - (p.speaking ? Math.abs(Math.sin(t * 10)) * 0.04 * s : 0);
  if (ap.hairStyle === "long" || ap.hairStyle === "bob") {
    ctx.fillStyle = ap.hair;
    ctx.beginPath();
    ctx.roundRect(-0.48 * s, hy - 0.1 * s, 0.96 * s, (ap.hairStyle === "long" ? 1.0 : 0.6) * s, 0.2 * s);
    ctx.fill();
  }
  ctx.fillStyle = back ? ap.hair : ap.skin;
  dot(0, hy, 0.42 * s);
  ctx.fillStyle = ap.hair;
  ctx.beginPath();
  ctx.arc(0, hy, 0.46 * s, Math.PI, 0);
  ctx.fill();
  if (ap.hairStyle === "bun") dot(0, hy - 0.55 * s, 0.2 * s);
  if (ap.hairStyle === "spiky") {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 0.18 * s - 0.1 * s, hy - 0.35 * s);
      ctx.lineTo(i * 0.18 * s, hy - 0.75 * s);
      ctx.lineTo(i * 0.18 * s + 0.1 * s, hy - 0.35 * s);
      ctx.fill();
    }
  }
  if (!home && /Bếp/.test(a.job)) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.roundRect(-0.36 * s, hy - 0.95 * s, 0.72 * s, 0.6 * s, 0.2 * s);
    ctx.fill();
  }
  const mk = p.mood && p.mood.value > 25 ? p.mood.key : undefined;
  const sad = mk === "sadness" || mk === "loneliness" || mk === "disappointment";
  const glad = mk === "joy" || mk === "love" || mk === "hope";
  if (!back) {
    const ex = fx * 0.08 * s;
    const blink = (t * 0.8 + x * 0.013) % 4 < 0.12;
    for (const d of [-1, 1]) {
      const bx = d * 0.15 * s + ex;
      ctx.strokeStyle = "#111827";
      ctx.fillStyle = "#111827";
      ctx.lineWidth = 0.035 * s;
      if (blink) limb(bx - 0.05 * s, hy + 0.04 * s, bx + 0.05 * s, hy + 0.04 * s, 0.035 * s, "#111827");
      else if (mk === "joy") {
        ctx.beginPath();
        ctx.arc(bx, hy + 0.06 * s, 0.06 * s, Math.PI, 0);
        ctx.stroke();
      } else dot(bx, hy + 0.03 * s, 0.05 * s);
      const tilt = mk === "anger" ? 0.06 : sad || mk === "anxiety" ? -0.06 : 0;
      const lift = mk === "anxiety" ? 0.05 : 0;
      limb(bx - d * 0.1 * s, hy + (-0.14 - lift + tilt) * s, bx + d * 0.1 * s, hy + (-0.14 - lift - tilt) * s, 0.035 * s, ap.hair);
      if (sad && d === -1) {
        ctx.fillStyle = "#7dd3fc";
        dot(bx, hy + (0.1 + ((t * 0.6) % 1) * 0.25) * s, 0.035 * s);
      }
      if (mk === "shame" || mk === "love") {
        ctx.fillStyle = "rgba(244,114,182,.4)";
        dot(d * 0.27 * s + ex, hy + 0.14 * s, 0.08 * s);
      }
      if (ap.glasses) {
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 0.04 * s;
        ctx.beginPath();
        ctx.arc(bx, hy + 0.03 * s, 0.12 * s, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const my = hy + 0.22 * s;
    ctx.strokeStyle = "#7f1d1d";
    ctx.fillStyle = "#7f1d1d";
    ctx.lineWidth = 0.035 * s;
    if (p.speaking) {
      ctx.beginPath();
      ctx.ellipse(ex, my, 0.08 * s, (0.03 + 0.05 * Math.abs(Math.sin(t * 12))) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (glad) {
      ctx.beginPath();
      ctx.arc(ex, my - 0.05 * s, 0.11 * s, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else if (sad || mk === "shame") {
      ctx.beginPath();
      ctx.arc(ex, my + 0.1 * s, 0.1 * s, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (mk === "anxiety") {
      ctx.beginPath();
      ctx.ellipse(ex, my, 0.05 * s, 0.06 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mk === "jealousy") limb(ex - 0.1 * s, my, ex + 0.1 * s, my - 0.05 * s, 0.035 * s, "#7f1d1d");
    else limb(ex - 0.07 * s, my, ex + 0.07 * s, my, 0.035 * s, "#7f1d1d");
  }
  if (p.rain) {
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(0, hy - 0.5 * s, 0.95 * s, Math.PI, 0);
    ctx.fill();
  } else if (p.badge !== false && p.mood && p.mood.value > 35 && MOOD[p.mood.key]) {
    ctx.font = `${1.0 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(MOOD[p.mood.key] ?? "", 0, hy - 0.8 * s);
  }
  ctx.restore();
}
