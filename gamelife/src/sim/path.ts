import { location } from "./data.ts";
import type { Agent, Pt, Travel, World } from "./types.ts";

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function standPoint(locationId: string, agentId: string): Pt {
  const loc = location(locationId);
  const h = hash(agentId);
  const ang = ((h % 360) * Math.PI) / 180;
  const ring = loc.gather;
  return {
    x: loc.x + Math.cos(ang) * ring,
    z: loc.z + Math.sin(ang) * ring * 0.82,
  };
}

function pushPt(pts: Pt[], x: number, z: number) {
  const last = pts[pts.length - 1];
  if (!last || Math.hypot(last.x - x, last.z - z) > 0.15) pts.push({ x, z });
}

export function buildTravel(world: World, agent: Agent, destId: string, activity: Travel["arriveActivity"], seekId?: string): Travel {
  const start = agentPosition(agent, world.minute);
  const doorA = agent.locationId !== "transit" ? location(agent.locationId) : null;
  const doorB = location(destId);
  const end = standPoint(destId, agent.id);
  const pts: Pt[] = [];
  pushPt(pts, start.x, start.z);
  if (doorA) pushPt(pts, doorA.x, doorA.z);
  if (doorA && (doorA.x !== doorB.x || doorA.z !== doorB.z)) {
    pushPt(pts, doorB.x, doorA.z);
  }
  pushPt(pts, doorB.x, doorB.z);
  pushPt(pts, end.x, end.z);
  if (pts.length < 2) pushPt(pts, end.x + 0.1, end.z);

  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    cum.push(cum[i - 1]! + Math.hypot(cur.x - prev.x, cur.z - prev.z));
  }
  const total = cum[cum.length - 1] || 0.1;
  const minutes = Math.max(10, Math.ceil(total / 2.15 / 10) * 10);
  return {
    path: pts,
    cum,
    total,
    startMinute: world.minute,
    endMinute: world.minute + minutes,
    destId,
    arriveActivity: activity,
    seekId,
  };
}

export function pointOnTravel(travel: Travel, minute: number): { x: number; z: number; dx: number; dz: number } {
  const span = Math.max(1, travel.endMinute - travel.startMinute);
  const t = Math.max(0, Math.min(1, (minute - travel.startMinute) / span));
  const dist = t * travel.total;
  const ahead = Math.min(travel.total, dist + 0.65);
  return {
    x: atDist(travel, dist).x,
    z: atDist(travel, dist).z,
    dx: atDist(travel, ahead).x - atDist(travel, dist).x,
    dz: atDist(travel, ahead).z - atDist(travel, dist).z,
  };
}

function atDist(travel: Travel, dist: number): Pt {
  const { path, cum } = travel;
  if (dist <= 0) return path[0]!;
  for (let i = 1; i < path.length; i++) {
    if (dist <= cum[i]!) {
      const prev = path[i - 1]!;
      const cur = path[i]!;
      const seg = cum[i]! - cum[i - 1]!;
      const u = seg <= 0.0001 ? 0 : (dist - cum[i - 1]!) / seg;
      return { x: prev.x + (cur.x - prev.x) * u, z: prev.z + (cur.z - prev.z) * u };
    }
  }
  return path[path.length - 1]!;
}

export function agentPosition(agent: Agent, minute: number): Pt {
  if (agent.travel) {
    const p = pointOnTravel(agent.travel, minute);
    return { x: p.x, z: p.z };
  }
  if (agent.locationId === "transit") return { x: 0, z: 0 };
  return standPoint(agent.locationId, agent.id);
}

export function agentFacing(agent: Agent, minute: number, partner?: Agent): Pt {
  if (agent.travel) {
    const p = pointOnTravel(agent.travel, minute);
    return { x: p.dx, z: p.dz };
  }
  if (partner && partner.locationId === agent.locationId && !partner.travel) {
    const a = standPoint(agent.locationId, agent.id);
    const b = standPoint(partner.locationId, partner.id);
    return { x: b.x - a.x, z: b.z - a.z };
  }
  if (agent.locationId !== "transit") {
    const loc = location(agent.locationId);
    const here = standPoint(agent.locationId, agent.id);
    return { x: loc.x - here.x, z: loc.z - here.z };
  }
  return { x: 0, z: 1 };
}
