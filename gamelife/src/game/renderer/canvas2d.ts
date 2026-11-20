import { drawAgent } from "@/lib/agent-sprite";
import { LOCATIONS, MAP, ROADS_X, ROADS_Z } from "@/sim/data";
import { agentFacing, agentPosition } from "@/sim/path";
import type { World } from "@/sim/types";
import { dominantEmotion } from "@/sim/util";

export function geom(width: number, height: number) {
  const sc = Math.min(width / (MAP.maxX - MAP.minX), height / (MAP.maxZ - MAP.minZ));
  return {
    sc,
    ox: (width - (MAP.maxX - MAP.minX) * sc) / 2 - MAP.minX * sc,
    oz: (height - (MAP.maxZ - MAP.minZ) * sc) / 2 - MAP.minZ * sc,
  };
}

export function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

export function drawFlat(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  minute: number,
  selectedId: string | null,
  anim: number,
) {
  const { sc, ox, oz } = geom(width, height);
  const X = (x: number) => ox + x * sc;
  const Z = (z: number) => oz + z * sc;
  ctx.fillStyle = "#6d9464";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#3e4450";
  ctx.lineWidth = 2.4 * sc;
  for (const x of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(X(x), Z(MAP.minZ));
    ctx.lineTo(X(x), Z(MAP.maxZ));
    ctx.stroke();
  }
  for (const z of ROADS_Z) {
    ctx.beginPath();
    ctx.moveTo(X(MAP.minX), Z(z));
    ctx.lineTo(X(MAP.maxX), Z(z));
    ctx.stroke();
  }
  ctx.font = `${Math.max(10, 1.45 * sc)}px "Be Vietnam Pro", sans-serif`;
  ctx.textAlign = "center";
  for (const place of LOCATIONS) {
    const build = place.build;
    if (build) {
      const x = X(place.x + build.ox);
      const y = Z(place.z + build.oz);
      const w = build.w * sc;
      const d = build.d * sc;
      const roof = d * 0.42;
      ctx.fillStyle = build.wall;
      ctx.fillRect(x, y + roof * 0.35, w, d);
      ctx.fillStyle = build.roof;
      ctx.beginPath();
      ctx.moveTo(x - 3, y + roof);
      ctx.lineTo(x + w / 2, y - roof * 0.35);
      ctx.lineTo(x + w + 3, y + roof);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#7ea86a";
      ctx.beginPath();
      ctx.ellipse(X(place.x), Z(place.z), place.gather * sc * 2.1, place.gather * sc * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f3eadc";
    ctx.fillText(place.name, X(place.x), Z(place.z) - 1.3 * sc);
  }
  const hour = (((minute / 60) % 24) + 24) % 24;
  const dark = hour >= 20 || hour < 5 ? 0.42 : hour >= 18 ? ((hour - 18) / 2) * 0.42 : hour < 7 ? ((7 - hour) / 2) * 0.42 : 0;
  if (dark > 0 || world.weather !== "clear") {
    ctx.fillStyle = world.weather === "clear" ? `rgba(12,16,32,${dark})` : `rgba(70,78,96,${Math.max(dark, 0.18)})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (world.weather === "rain") {
    ctx.strokeStyle = "rgba(214, 226, 244, 0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 80; i++) {
      const x = (i * 97 + minute * 13) % width;
      const y = (i * 53 + anim * 240) % height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 10);
      ctx.stroke();
    }
  }
  const talking = new Set(world.lines.slice(-8).filter((line) => world.minute - line.minute <= 20).map((line) => line.speakerId));
  const crowd = world.agents
    .filter((person) => person.alive)
    .map((person) => ({ person, p: agentPosition(person, minute) }))
    .sort((a, b) => a.p.z - b.p.z);
  for (const { person, p } of crowd) {
    const facing = agentFacing(person, minute);
    const moving = !!person.travel && minute >= person.travel.startMinute && minute < person.travel.endMinute;
    if (person.id === selectedId) {
      ctx.strokeStyle = "#e6c27a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(X(p.x), Z(p.z), 1.15 * sc, 0.48 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawAgent(ctx, person, X(p.x), Z(p.z), sc, {
      t: anim,
      moving,
      fx: facing.x,
      fz: facing.z,
      speaking: talking.has(person.id),
      mood: dominantEmotion(person.emotions),
      rain: world.weather === "rain" && moving,
    });
    ctx.fillStyle = "#f3eadc";
    ctx.fillText(person.given, X(p.x), Z(p.z) + 1.45 * sc);
  }
}

export function pickAgent(world: World, width: number, height: number, localX: number, localY: number, minute: number) {
  const { sc, ox, oz } = geom(width, height);
  const wx = (localX - ox) / sc;
  const wz = (localY - oz) / sc;
  let best: string | null = null;
  let bestDist = 16;
  for (const person of world.agents) {
    if (!person.alive) continue;
    const p = agentPosition(person, minute);
    const dist = (p.x - wx) ** 2 + (p.z - wz) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = person.id;
    }
  }
  return best;
}
