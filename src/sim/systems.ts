import { location } from "./data.ts";
import { linesFor, type Spoken } from "./dialogue.ts";
import { addMemory, clearWorking, knowsFact, shareFact, witnessedCount } from "./memory.ts";
import { buildTravel } from "./path.ts";
import type { Activity, Agent, Relationship, World } from "./types.ts";
import { agent, clamp, clock, directed, emptyDir, pairKey, rng } from "./util.ts";

type Shift = { start: number; end: number; place: string };

export function shiftOf(a: Agent, world: World): Shift | null {
  if (!a.alive || a.retired || a.age < 6) return null;
  const dow = clock(world.minute).dayIndex;
  if (a.age < 18) {
    if (dow >= 5) return null;
    return { start: 8, end: 15, place: "school" };
  }
  if (a.id.startsWith("child_")) {
    if (dow >= 5) return null;
    return { start: 9, end: 17, place: a.workplaceId || "cafe" };
  }
  switch (a.id) {
    case "linh":
      if (dow === 6) return null;
      return { start: 7, end: 15, place: "cafe" };
    case "minh":
      if (dow >= 5) return null;
      return { start: 9, end: 18, place: "office" };
    case "ha":
      if (dow >= 5) return null;
      return { start: 8, end: 16, place: "school" };
    case "khoa":
      if (dow === 6) return null;
      if (dow % 3 === 2) return { start: 13, end: 21, place: "hospital" };
      return { start: 8, end: 16, place: "hospital" };
    case "mai":
      if (dow === 0) return null;
      return { start: 10, end: 19, place: "mall" };
    case "duc":
      if (dow === 1) return null;
      return { start: 11, end: 21, place: "restaurant" };
    case "an":
      if (dow === 6 || dow === 3) return null;
      if (dow === 4) return { start: 14, end: 18, place: "mall" };
      return { start: 10, end: 16, place: "cafe" };
    case "chi":
      if (dow === 6) return null;
      return { start: 7, end: 15, place: "hospital" };
    default:
      return null;
  }
}

export function hourOf(world: World): number {
  const c = clock(world.minute);
  return c.hour + c.minute / 60;
}

function serviceJob(a: Agent): boolean {
  return a.id === "linh" || a.id === "duc" || a.id === "mai" || a.id === "chi";
}

export function compatibility(a: Agent, b: Agent): number {
  const keys = ["warmth", "humor", "romance", "selfishness", "kindness"] as const;
  let diff = 0;
  for (const k of keys) diff += Math.abs(a.traits[k] - b.traits[k]);
  let score = 100 - diff / keys.length;
  if (a.traits.romance > 60 && b.traits.romance > 60) score += 8;
  if (a.traits.selfishness > 60 && b.traits.selfishness > 60) score -= 12;
  if (a.traits.kindness > 70 && b.traits.kindness > 70) score += 6;
  return clamp(score, 8, 97);
}

export function ensureRel(world: World, aId: string, bId: string): Relationship {
  const x = aId < bId ? aId : bId;
  const y = aId < bId ? bId : aId;
  let rel = world.relationships.find((r) => r.aId === x && r.bId === y);
  if (!rel) {
    rel = {
      aId: x,
      bId: y,
      aToB: emptyDir(),
      bToA: emptyDir(),
      compatibility: compatibility(agent(world, x), agent(world, y)),
      status: "stranger",
      sinceDay: clock(world.minute).day,
    };
    world.relationships.push(rel);
  }
  return rel;
}

export function partnerOf(world: World, id: string): string | null {
  for (const rel of world.relationships) {
    if (rel.status !== "dating" && rel.status !== "married") continue;
    if (rel.aId === id) return rel.bId;
    if (rel.bId === id) return rel.aId;
  }
  return null;
}

function knowsPartner(world: World, viewerId: string, otherId: string): boolean {
  const p = partnerOf(world, otherId);
  if (!p) return false;
  return agent(world, viewerId).memories.some(
    (m) => m.tags.includes(`couple:${pairKey(otherId, p)}`) && (m.source === "witnessed" || m.source === "told" || m.source === "self"),
  );
}

export function refreshStatus(rel: Relationship) {
  if (rel.status === "dating" || rel.status === "married" || rel.status === "broken" || rel.status === "divorced") return;
  const fam = (rel.aToB.familiarity + rel.bToA.familiarity) / 2;
  const aff = (rel.aToB.affection + rel.bToA.affection) / 2;
  const tru = (rel.aToB.trust + rel.bToA.trust) / 2;
  const con = (rel.aToB.conflict + rel.bToA.conflict) / 2;
  if (con > 62 && aff < 30) rel.status = "distant";
  else if (fam > 48 && aff > 56 && tru > 46 && con < 42) rel.status = "close";
  else if (fam > 24 && aff > 32 && con < 58) rel.status = "friends";
  else if (fam > 8) rel.status = "acquaintance";
  else rel.status = "stranger";
}

export function viewStage(world: World, viewerId: string, otherId: string): string {
  const rel = ensureRel(world, viewerId, otherId);
  const mine = directed(rel, viewerId);
  const theirs = directed(rel, otherId);
  if (rel.status === "married") return "Kết hôn";
  if (rel.status === "dating") return "Đang yêu";
  if (rel.status === "divorced") return "Ly hôn";
  if (rel.status === "broken") return "Đã chia tay";
  if (rel.status === "distant") return "Xa cách";
  if (mine.affection > 60 && mine.attraction > 52) {
    if (theirs.affection < 46) return "Cảm nắng đơn phương";
    return "Có cảm tình";
  }
  if (rel.status === "close") return "Bạn thân";
  if (rel.status === "friends") return "Bạn bè";
  if (rel.status === "acquaintance") return "Người quen";
  return "Người lạ";
}

export function logEvent(world: World, type: string, actorIds: string[], text: string, importance: number) {
  const c = clock(world.minute);
  world.events.push({
    id: `e${world.nextId++}`,
    day: c.day,
    minute: world.minute,
    hour: c.hour,
    min: c.minute,
    type,
    actorIds,
    text,
    importance,
  });
  if (world.events.length > 260) {
    const keep = (e: World["events"][number]) =>
      e.importance >= 8 || e.type === "meet" || e.type === "dating" || e.type === "reject" || e.type === "marriage" || e.type === "breakup" || e.type === "divorce" || e.type === "gift";
    const idx = world.events.findIndex((e) => !keep(e) && e.importance < 6);
    if (idx >= 0) world.events.splice(idx, 1);
    else {
      const idx2 = world.events.findIndex((e) => !keep(e));
      if (idx2 >= 0) world.events.splice(idx2, 1);
      else world.events.shift();
    }
  }
}

function pushLines(world: World, placeId: string, partnerA: string, partnerB: string, lines: Spoken[]) {
  for (const line of lines) {
    const other = line.speakerId === partnerA ? partnerB : partnerA;
    world.lines.push({
      id: `l${world.nextId++}`,
      speakerId: line.speakerId,
      text: line.text,
      day: clock(world.minute).day,
      minute: world.minute,
      placeId,
      partnerId: other,
    });
    addMemory(world, agent(world, line.speakerId), {
      kind: "working",
      subjectId: other,
      text: line.text,
      source: "self",
      importance: 2,
      tags: ["working"],
    });
    addMemory(world, agent(world, other), {
      kind: "working",
      subjectId: line.speakerId,
      text: line.text,
      source: "witnessed",
      importance: 2,
      tags: ["working"],
    });
  }
  if (world.lines.length > 140) world.lines.splice(0, world.lines.length - 140);
}

function placeName(id: string): string {
  if (id === "transit") return "trên đường";
  return location(id).name;
}

export function goalsOf(world: World, a: Agent): { label: string; weight: number }[] {
  const partner = partnerOf(world, a.id);
  const list = [
    { label: a.money < 350 ? "Kiếm đủ tiền cho tuần này" : "Giữ việc làm ổn định", weight: 48 + (a.money < 400 ? 28 : 0) },
    { label: partner ? "Vun đắp mối quan hệ hiện tại" : "Tìm một người thật sự hợp", weight: a.traits.romance * 0.45 + a.needs.affection * 0.55 },
    { label: "Có thời gian cho riêng mình", weight: a.needs.fun * 0.45 + (100 - a.traits.extroversion) * 0.25 },
    { label: a.dream, weight: 36 + a.traits.confidence * 0.15 },
    { label: "Chăm người thân", weight: 30 + (a.id === "chi" || a.id === "ha" || a.id === "minh" ? 18 : 0) },
  ];
  return list.sort((x, y) => y.weight - x.weight).slice(0, 3);
}

function tickNeeds(a: Agent, minutes: number) {
  const k = minutes / 10;
  const asleep = a.activity === "sleeping";
  if (asleep) {
    a.needs.sleepiness = clamp(a.needs.sleepiness - 1.85 * k);
    a.needs.hunger = clamp(a.needs.hunger + 0.45 * k);
    a.needs.thirst = clamp(a.needs.thirst + 0.35 * k);
    a.needs.health = clamp(a.needs.health + 0.35 * k);
  } else {
    const atWork = a.activity === "working";
    a.needs.hunger = clamp(a.needs.hunger + 1.15 * k);
    a.needs.thirst = clamp(a.needs.thirst + (atWork ? 0.38 : 1.05) * k);
    a.needs.sleepiness = clamp(a.needs.sleepiness + 0.42 * k);
    a.needs.fun = clamp(a.needs.fun + (atWork ? 1.05 : 0.7) * k);
    const socialRate = 0.5 * (0.4 + a.traits.extroversion / 100);
    a.needs.social = clamp(a.needs.social + socialRate * k);
    a.needs.affection = clamp(a.needs.affection + 0.32 * (0.35 + a.traits.romance / 100) * k);
    if (a.needs.hunger > 82) a.needs.health = clamp(a.needs.health - 0.45 * k);
    if (a.needs.sleepiness > 90) a.needs.health = clamp(a.needs.health - 0.3 * k);
  }
  const insecure = a.money < 180 ? 78 : a.money < 450 ? 46 : 18;
  a.needs.safety = clamp(insecure * 0.65 + (100 - a.needs.health) * 0.35);
}

function tickEmotions(a: Agent) {
  const decay = (v: number, n: number) => clamp(v - n);
  a.emotions.joy = decay(a.emotions.joy, 1.6);
  a.emotions.anger = decay(a.emotions.anger, 2.1);
  a.emotions.anxiety = decay(a.emotions.anxiety, 1.4);
  a.emotions.shame = decay(a.emotions.shame, 1.5);
  a.emotions.disappointment = decay(a.emotions.disappointment, 1.3);
  a.emotions.hope = decay(a.emotions.hope, 1.1);
  a.emotions.jealousy = decay(a.emotions.jealousy, 2.4);
  a.emotions.love = decay(a.emotions.love, 0.45);
  a.emotions.loneliness = clamp(a.needs.social * 0.72 + (a.talksToday === 0 ? 12 : 0));
  a.emotions.sadness = clamp(a.emotions.sadness * 0.92 + a.emotions.loneliness * 0.08);
  if (a.needs.safety > 65) a.emotions.anxiety = clamp(a.emotions.anxiety + 1.2);
  if (a.money < 80) a.emotions.anxiety = clamp(a.emotions.anxiety + 1.4);
}

function minutesUntil(world: World, hour: number, minute: number): number {
  const dayBase = Math.floor(world.minute / 1440) * 1440;
  let target = dayBase + hour * 60 + minute;
  if (target <= world.minute) target += 1440;
  return target;
}

function beginActivity(world: World, a: Agent, activity: Activity, destId: string, seekId?: string) {
  a.locationId = destId;
  a.activity = activity;
  a.destinationId = undefined;
  a.travel = null;
  a.activityApplied = false;
  a.seekTargetId = seekId;
  a.partnerId = undefined;
  const hour = hourOf(world);
  if (activity === "eating") {
    const atWork = destId === shiftOf(a, world)?.place;
    const home = destId === a.homeId;
    const cost = atWork && (a.id === "duc" || a.id === "linh") ? 8 : home || a.money < 36 ? 8 : destId === "cafe" ? 26 : 34;
    a.money -= cost;
    a.needs.hunger = clamp(a.needs.hunger - (home ? 42 : 58));
    a.needs.thirst = clamp(a.needs.thirst - 18);
    a.needs.fun = clamp(a.needs.fun - 8);
    a.stats.meals += 1;
    a.busyUntil = world.minute + 30;
    a.hadLunch = hour >= 11 && hour < 15 ? true : a.hadLunch;
    a.hadBreakfast = hour < 10 ? true : a.hadBreakfast;
    a.lastThought = home ? "Ăn tạm ở nhà cho đỡ tốn." : `Ghé ${placeName(destId)} vì bụng đã kêu.`;
  } else if (activity === "drinking") {
    a.money -= a.money < 20 ? 0 : 14;
    a.needs.thirst = clamp(a.needs.thirst - 48);
    a.needs.hunger = clamp(a.needs.hunger - 6);
    a.needs.fun = clamp(a.needs.fun - 10);
    a.busyUntil = world.minute + 20;
    a.lastThought = "Cần một thứ gì đó để uống, và cũng để ngồi.";
  } else if (activity === "working") {
    const shift = shiftOf(a, world);
    const end = shift ? minutesUntil(world, Math.floor(shift.end), Math.round((shift.end % 1) * 60)) : world.minute + 60;
    const lunch = minutesUntil(world, 12, 0);
    a.busyUntil = world.minute < lunch && lunch < end ? lunch : end;
    a.lastThought = `Đến giờ làm ở ${placeName(destId)}.`;
  } else if (activity === "sleeping") {
    a.busyUntil = minutesUntil(world, 6, 30);
    a.stats.sleeps += 1;
    a.needs.fun = clamp(a.needs.fun - 6);
    a.lastThought = "Đủ rồi. Mình về ngủ.";
  } else if (activity === "relaxing") {
    const cafe = destId === "cafe";
    if (cafe) {
      a.money -= 12;
      a.needs.thirst = clamp(a.needs.thirst - 22);
    }
    a.needs.fun = clamp(a.needs.fun - (cafe ? 18 : 34));
    a.needs.social = clamp(a.needs.social - (cafe ? 8 : 4));
    a.busyUntil = world.minute + (cafe ? 30 : 40);
    a.lastThought = world.weather === "rain" && destId === "park" && a.id === "an"
      ? "Mưa. Công viên đẹp theo cách riêng của nó."
      : cafe
        ? "Ngồi lại quán một lát, không cần lý do lớn."
        : "Ra công viên cho đầu óc rộng ra.";
  } else if (activity === "shopping") {
    a.busyUntil = world.minute + 30;
    a.lastShopDay = clock(world.minute).day;
    if (a.planGift && a.planGift.place === destId && a.money >= 20) {
      const gift = a.planGift;
      a.money -= locationCost(gift);
      a.holdingGift = { forId: gift.forId, item: gift.item, label: gift.label, factKey: gift.factKey };
      a.planGift = undefined;
      a.lastThought = `Mua ${gift.label} cho ${agent(world, gift.forId).given}. Hy vọng họ còn nhớ đã kể.`;
    } else {
      a.money -= destId === "mall" ? 28 : 36;
      a.needs.hunger = clamp(a.needs.hunger - 12);
      a.needs.fun = clamp(a.needs.fun - 14);
      a.lastThought = destId === "mall" ? "Đi lòng vòng, xem có gì đáng giữ." : "Mua đồ ăn cho vài ngày.";
    }
  } else if (activity === "seeking") {
    a.busyUntil = world.minute + 30;
    const who = seekId ? agent(world, seekId).given : "một người";
    a.lastThought = `Mình ghé ${placeName(destId)} vì có thể gặp ${who}.`;
  } else if (activity === "treatment") {
    a.money -= 70;
    a.needs.health = clamp(a.needs.health + 38);
    a.busyUntil = world.minute + 40;
    a.emotions.anxiety = clamp(a.emotions.anxiety - 10);
    a.lastThought = "Người mệt thì phải vào viện, không thương lượng.";
    logEvent(world, "health", [a.id], `${a.given} vào ${placeName(destId)} vì sức khỏe giảm.`, 5);
  } else {
    a.busyUntil = world.minute + 40;
    a.needs.fun = clamp(a.needs.fun - (a.traits.extroversion < 40 ? 16 : 6));
    a.needs.social = clamp(a.needs.social + (a.traits.extroversion < 40 ? -4 : 2));
    a.lastThought = "Ở nhà một lúc. Không phải lúc nào cũng cần phố.";
  }
  a.activityApplied = true;
}

function locationCost(gift: { item: string }): number {
  if (gift.item === "running") return 70;
  if (gift.item === "jazz") return 46;
  if (gift.item === "fashion") return 40;
  if (gift.item === "poetry") return 32;
  if (gift.item === "spice") return 30;
  return 24;
}

function go(world: World, a: Agent, destId: string, activity: Activity, seekId?: string) {
  if (a.locationId === destId && !a.travel) {
    beginActivity(world, a, activity, destId, seekId);
    return;
  }
  a.travel = buildTravel(world, a, destId, activity, seekId);
  a.activity = "walking";
  a.destinationId = destId;
  a.locationId = "transit";
  a.partnerId = undefined;
  a.busyUntil = a.travel.endMinute;
  a.seekTargetId = seekId;
  a.lastThought = `Đi đến ${placeName(destId)}.`;
}

function arrive(world: World, a: Agent) {
  if (!a.travel) return;
  const dest = a.travel.destId;
  const activity = a.travel.arriveActivity;
  const seek = a.travel.seekId;
  a.travel = null;
  beginActivity(world, a, activity, dest, seek);
}

function lunchPlace(world: World, a: Agent): string {
  if (a.money < 36) return a.homeId;
  if (a.traits.extroversion > 60 && rng(world) < 0.55) return rng(world) < 0.5 ? "restaurant" : "cafe";
  const shift = shiftOf(a, world);
  return shift?.place ?? a.homeId;
}

function guessWhere(world: World, seeker: Agent, target: Agent): string {
  const seen = [...seeker.memories]
    .filter((m) => m.kind === "episodic" && m.subjectId === target.id && m.source === "witnessed")
    .reverse();
  for (const m of seen) {
    const tag = m.tags.find((t) => t.startsWith("place:"));
    if (!tag) continue;
    const id = tag.slice(6);
    if (id !== "transit" && id !== seeker.homeId) return id;
  }
  if (seeker.traits.extroversion > 50) return world.weather === "rain" ? "cafe" : rng(world) < 0.5 ? "cafe" : "park";
  return world.weather === "rain" && seeker.id !== "an" ? "cafe" : "park";
}

function considerGift(world: World, a: Agent): (Agent["planGift"] & object) | null {
  if (a.holdingGift || a.planGift) return a.planGift ?? null;
  if (a.money < 90) return null;
  let best: { score: number; plan: NonNullable<Agent["planGift"]> } | null = null;
  for (const other of world.agents) {
    if (!other.alive || other.id === a.id) continue;
    const rel = ensureRel(world, a.id, other.id);
    const mine = directed(rel, a.id);
    if (mine.affection < 48 || mine.familiarity < 18) continue;
    if (rel.status === "divorced") continue;
    const recent = a.memories.some(
      (m) => m.tags.includes("gifted") && m.subjectId === other.id && clock(world.minute).day - m.day < 10,
    );
    if (recent) continue;
    const priorGifts = a.memories.filter((m) => m.tags.includes("gifted") && m.subjectId === other.id).length;
    if (priorGifts >= 2) continue;
    for (const mem of a.memories) {
      if (mem.kind !== "semantic" || mem.subjectId !== other.id || !mem.factKey) continue;
      const fact = other.facts.find((f) => f.key === mem.factKey && f.gift);
      if (!fact?.gift) continue;
      const score = mine.affection + mine.attraction * 0.3 + a.traits.romance * 0.15;
      if (!best || score > best.score) {
        best = {
          score,
          plan: { forId: other.id, item: fact.gift.item, label: fact.gift.label, factKey: fact.key, place: fact.gift.place },
        };
      }
    }
  }
  if (!best) return null;
  const prior = a.memories.filter((m) => m.tags.includes("gifted") && m.subjectId === best.plan.forId).length;
  const chance = (prior === 0 ? 0.2 : 0.07) + best.score / 480;
  if (rng(world) > chance) return null;
  return best.plan;
}

function bestSeek(world: World, a: Agent): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const other of world.agents) {
    if (!other.alive || other.id === a.id) continue;
    const rel = ensureRel(world, a.id, other.id);
    const mine = directed(rel, a.id);
    if (mine.familiarity < 14 && mine.affection < 36) continue;
    let score = mine.affection * 0.55 + mine.attraction * 0.35 + a.needs.affection * 0.25 - mine.conflict * 0.45;
    if (partnerOf(world, a.id) === other.id) score += 28;
    if (rel.status === "broken" && mine.affection > 55) score += 10;
    if (!best || score > best.score) best = { id: other.id, score };
  }
  if (!best || best.score < 42) return null;
  return best;
}

export function decide(world: World, a: Agent) {
  if (!a.alive) return;
  const hour = hourOf(world);
  const shift = shiftOf(a, world);

  if (a.needs.health < 30 && a.locationId !== "hospital" && a.activity !== "treatment") {
    a.lastThought = "Sức khỏe xuống quá thấp. Phải vào viện.";
    go(world, a, "hospital", "treatment");
    return;
  }

  const night = hour >= 22.5 || hour < 6.5;
  if ((night || a.needs.sleepiness > 86) && a.activity !== "sleeping") {
    go(world, a, a.homeId, "sleeping");
    return;
  }
  if (a.activity === "sleeping") {
    if (hour >= 6.5 && hour < 11 && a.needs.sleepiness < 36) {
      a.activity = "idle";
      a.busyUntil = world.minute;
    } else {
      a.busyUntil = Math.max(a.busyUntil, world.minute + 30);
      return;
    }
  }

  if (hour >= 6.6 && hour < 9.2 && !a.hadBreakfast && a.needs.hunger > 46) {
    const rush = shift && hour >= shift.start - 0.15 && a.needs.hunger < 68;
    if (!rush) {
      a.hadBreakfast = true;
      go(world, a, a.homeId, "eating");
      return;
    }
  }

  if (a.needs.hunger > 74) {
    const dest = a.money < 32 ? a.homeId : a.traits.extroversion > 64 ? "restaurant" : rng(world) < 0.5 ? "cafe" : a.homeId;
    go(world, a, dest, "eating");
    return;
  }

  if (shift && !a.hadLunch && hour >= 12 && hour < 13.3 && a.needs.hunger > 32) {
    a.hadLunch = true;
    go(world, a, lunchPlace(world, a), "eating");
    return;
  }

  if (a.needs.thirst > 80) {
    go(world, a, "cafe", "drinking");
    return;
  }

  if (shift && hour >= shift.start && hour < shift.end - 0.2 && !(hour >= 12 && hour < 13.2)) {
    go(world, a, shift.place, "working");
    return;
  }

  if (a.holdingGift) {
    const target = agent(world, a.holdingGift.forId);
    const dest = guessWhere(world, a, target);
    go(world, a, dest, "seeking", target.id);
    return;
  }

  const gift = considerGift(world, a);
  if (gift) {
    a.planGift = gift;
    a.lastThought = `Mình muốn tặng ${agent(world, gift.forId).given} ${gift.label}, vì mình còn nhớ.`;
    go(world, a, gift.place, "shopping");
    return;
  }

  type Opt = { score: number; dest: string; activity: Activity; seekId?: string; thought: string };
  const opts: Opt[] = [];
  const weekend = clock(world.minute).dayIndex >= 5;
  opts.push({
    score: 24 + (100 - a.traits.extroversion) * 0.18,
    dest: a.homeId,
    activity: "idle",
    thought: "Về nhà cũng là một lựa chọn tử tế.",
  });
  let park = a.needs.fun * 0.55 + (100 - a.traits.extroversion) * 0.12 + (weekend ? 14 : 0);
  if (world.weather === "rain" && a.id !== "an") park -= 36;
  if (a.id === "an" && world.weather === "rain") park += 22;
  if (a.id === "ha") park += 10;
  opts.push({ score: park, dest: "park", activity: "relaxing", thought: "Công viên hợp với đầu mình lúc này." });
  let cafe = a.needs.social * (0.35 + a.traits.extroversion / 280) + a.needs.thirst * 0.15 + (weekend ? 8 : 0);
  if (world.weather === "rain") cafe += 16;
  if (a.id === "linh") cafe += 6;
  opts.push({ score: cafe, dest: "cafe", activity: "relaxing", thought: "Quán cà phê là chỗ dễ gặp người mà không phải hẹn." });
  opts.push({
    score: a.needs.hunger * 0.35 + (a.id === "duc" ? 4 : 10) + a.traits.extroversion * 0.05,
    dest: "restaurant",
    activity: a.needs.hunger > 40 ? "eating" : "relaxing",
    thought: "Nhà hàng có mùi khiến mình muốn vào.",
  });
  const daysSinceShop = clock(world.minute).day - a.lastShopDay;
  opts.push({
    score: (daysSinceShop >= 3 ? 38 : 6) + a.needs.hunger * 0.12,
    dest: "market",
    activity: "shopping",
    thought: "Tủ lạnh không tự đầy.",
  });
  opts.push({
    score: a.needs.fun * 0.34 * (0.4 + a.traits.extroversion / 120) + (a.id === "mai" ? 12 : 0),
    dest: "mall",
    activity: "shopping",
    thought: "Đi dạo trung tâm thương mại cho đỡ bí.",
  });
  const seek = bestSeek(world, a);
  if (seek) {
    const who = agent(world, seek.id);
    const dest = guessWhere(world, a, who);
    opts.push({
      score: seek.score,
      dest,
      activity: "seeking",
      seekId: who.id,
      thought: `Mình muốn gặp ${who.given}, không phải vì lịch, vì mình nhớ.`,
    });
  }
  for (const o of opts) o.score += rng(world) * 14 - 4;
  if (a.money < 40) {
    for (const o of opts) {
      if (o.dest !== a.homeId && o.dest !== "park") o.score -= 30;
    }
  }
  opts.sort((x, y) => y.score - x.score);
  const choice = opts[0]!;
  a.lastThought = choice.thought;
  go(world, a, choice.dest, choice.activity, choice.seekId);
}

function openToTalk(world: World, a: Agent): boolean {
  if (a.travel || a.locationId === "transit") return false;
  if (a.activity === "sleeping" || a.activity === "treatment" || a.activity === "walking") return false;
  if (a.activity === "socializing") return false;
  if (a.activity === "working") {
    const hour = hourOf(world);
    if (hour >= 12 && hour < 13.3) return true;
    return a.workChatty;
  }
  return true;
}

function vibeOf(rel: Relationship, a: Agent, b: Agent): number {
  const humorFit = 100 - Math.abs(a.traits.humor - b.traits.humor);
  const warmth = (a.traits.warmth + b.traits.warmth) / 2;
  const temperClash = Math.max(0, a.traits.temper + b.traits.temper - 108);
  return rel.compatibility * 0.42 + warmth * 0.34 + humorFit * 0.24 - temperClash;
}

function applyWarm(rel: Relationship, from: Agent, amount: number) {
  const d = directed(rel, from.id);
  d.familiarity = clamp(d.familiarity + 3.2 + from.traits.extroversion * 0.012);
  d.trust = clamp(d.trust + 1.1 + from.traits.kindness * 0.012 - from.traits.selfishness * 0.008);
  d.affection = clamp(d.affection + amount);
  d.respect = clamp(d.respect + 0.7);
  d.bond = clamp(d.bond + amount * 0.65);
  d.conflict = clamp(d.conflict - 1.4);
  const romance = (from.traits.romance / 100) * (0.45 + rel.compatibility / 140);
  d.attraction = clamp(d.attraction + amount * romance);
  if (rel.status === "dating" || rel.status === "married") d.commitment = clamp(d.commitment + 1.35);
}

function witnesses(world: World, placeId: string, skip: string[]): Agent[] {
  return world.agents.filter((a) => a.alive && a.locationId === placeId && !a.travel && !skip.includes(a.id));
}

function rememberCouple(world: World, a: Agent, b: Agent, placeId: string, text: string) {
  const tag = `couple:${pairKey(a.id, b.id)}`;
  for (const who of [a, b, ...witnesses(world, placeId, [a.id, b.id])]) {
    addMemory(world, who, {
      kind: "episodic",
      subjectId: who.id === b.id ? a.id : who.id === a.id ? b.id : a.id,
      text,
      source: who.id === a.id || who.id === b.id ? "self" : "witnessed",
      importance: 9,
      tags: [tag, `place:${placeId}`, "romance"],
    });
  }
}

function maybeReveal(world: World, a: Agent, b: Agent, rel: Relationship): Spoken[] {
  const mine = directed(rel, a.id);
  const candidates = a.facts.filter((f) => !knowsFact(b, a.id, f.key));
  const allowed = candidates.filter((f) => {
    if (f.intimacy === 1) return mine.familiarity > 12 && (a.traits.extroversion > 36 || mine.trust > 20);
    if (f.intimacy === 2) return mine.trust > 42 && mine.familiarity > 26;
    return mine.trust > 66 && (rel.status === "dating" || rel.status === "married" || rel.status === "close");
  });
  if (allowed.length === 0 || rng(world) > 0.42) return [];
  allowed.sort((x, y) => x.intimacy - y.intimacy);
  const fact = allowed[0]!;
  if (!shareFact(world, a, b, fact.key)) return [];
  b.emotions.joy = clamp(b.emotions.joy + 6);
  directed(rel, b.id).trust = clamp(directed(rel, b.id).trust + 2.2);
  logEvent(world, "reveal", [a.id, b.id], `${a.given} kể cho ${b.given}: ${fact.value}.`, 6);
  return linesFor(world, a, b, "reveal", fact.value);
}

function maybeCallback(world: World, a: Agent, b: Agent, rel: Relationship): Spoken[] {
  const day = clock(world.minute).day;
  const known = a.memories.find((m) => {
    if (m.kind !== "semantic" || m.subjectId !== b.id || !m.factValue || !m.factKey || m.source === "self") return false;
    return !a.memories.some((r) => r.tags.includes(`recalled:${m.factKey}`) && r.subjectId === b.id && day - r.day < 6);
  });
  if (!known?.factValue || !known.factKey || rng(world) > 0.38) return [];
  directed(rel, b.id).trust = clamp(directed(rel, b.id).trust + 3);
  directed(rel, b.id).affection = clamp(directed(rel, b.id).affection + 2.4);
  directed(rel, a.id).affection = clamp(directed(rel, a.id).affection + 1.2);
  b.emotions.joy = clamp(b.emotions.joy + 14);
  b.emotions.love = clamp(b.emotions.love + 6);
  addMemory(world, a, {
    kind: "episodic",
    subjectId: b.id,
    text: `Mình nhắc ${b.given} về chuyện ${known.factValue}.`,
    source: "self",
    importance: 5,
    tags: [`recalled:${known.factKey}`, `with:${b.id}`, `place:${a.locationId}`],
  });
  addMemory(world, b, {
    kind: "episodic",
    subjectId: a.id,
    text: `${a.given} nhớ rằng mình ${known.factValue}.`,
    source: "witnessed",
    importance: 7,
    tags: [`place:${a.locationId}`, "remembered", `with:${a.id}`, `recalled:${known.factKey}`],
  });
  logEvent(world, "memory", [a.id, b.id], `${a.given} nhắc lại điều ${b.given} từng kể: ${known.factValue}.`, 6);
  return linesFor(world, a, b, "callback", known.factValue);
}

function romanceSpeech(world: World, a: Agent, b: Agent, rel: Relationship): boolean {
  if (!a.alive || !b.alive || a.age < 18 || b.age < 18) return false;
  if (rel.status === "divorced") return false;
  const ab = directed(rel, a.id);
  const ba = directed(rel, b.id);
  if (partnerOf(world, a.id)) return false;
  if (partnerOf(world, b.id) && knowsPartner(world, a.id, b.id)) return false;
  if ((a.confessCooldown[b.id] ?? -1) > clock(world.minute).day) return false;

  if (rel.status === "broken" && ab.affection > 64 && ba.affection > 58 && ab.conflict < 30 && ba.conflict < 30) {
    if (rng(world) < 0.35) {
      rel.status = "dating";
      rel.sinceDay = clock(world.minute).day;
      rel.initiatorId = a.id;
      ab.commitment = clamp(ab.commitment + 20);
      ba.commitment = clamp(ba.commitment + 16);
      const back = linesFor(world, a, b, "return");
      pushLines(world, a.locationId, a.id, b.id, back);
      logEvent(world, "reunite", [a.id, b.id], `${a.given} và ${b.given} quyết định thử lại.`, 9);
      return true;
    }
  }

  if (rel.status === "dating") {
    const days = clock(world.minute).day - rel.sinceDay;
    if (days >= 12 && ab.commitment > 74 && ba.commitment > 66 && ab.affection > 70 && ba.affection > 64 && ab.conflict < 28) {
      const courage = a.traits.confidence * 0.4 + ab.commitment * 0.35;
      if (rng(world) * 100 < courage) {
        const ask = linesFor(world, a, b, "propose");
        pushLines(world, a.locationId, a.id, b.id, ask);
        const accept = ba.commitment > 70 && ba.affection > 66 && b.traits.romance > 35;
        if (accept) {
          rel.status = "married";
          rel.sinceDay = clock(world.minute).day;
          rel.initiatorId = a.id;
          ab.commitment = 92;
          ba.commitment = 90;
          a.emotions.love = clamp(a.emotions.love + 40);
          b.emotions.love = clamp(b.emotions.love + 40);
          a.emotions.joy = clamp(a.emotions.joy + 30);
          b.emotions.joy = clamp(b.emotions.joy + 30);
          pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "marry"));
          const sharedHome = a.rent >= b.rent ? a.homeId : b.homeId;
          a.homeId = sharedHome;
          b.homeId = sharedHome;
          b.rent = 0;
          const text = `${a.given} cầu hôn và ${b.given} đồng ý. Họ kết hôn và dọn về chung một nhà.`;
          logEvent(world, "marriage", [a.id, b.id], text, 10);
          rememberCouple(world, a, b, a.locationId, text);
        } else {
          a.confessCooldown[b.id] = clock(world.minute).day + 6;
          a.emotions.disappointment = clamp(a.emotions.disappointment + 22);
          pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "reject"));
          logEvent(world, "proposal_reject", [a.id, b.id], `${b.given} chưa muốn kết hôn với ${a.given}.`, 8);
        }
        return true;
      }
    }
    return false;
  }

  if (rel.status === "married" || rel.status === "broken") return false;
  if (ab.affection < 66 || ab.attraction < 54 || ab.familiarity < 28) return false;
  const courage = a.traits.confidence * 0.5 + ab.affection * 0.22 - a.traits.trustBarrier * 0.22;
  if (rng(world) * 100 > courage) {
    if (rng(world) < 0.4) a.lastThought = `${a.given} muốn nói với ${b.given} một câu quan trọng, nhưng nuốt lại.`;
    a.emotions.hope = clamp(a.emotions.hope + 6);
    return false;
  }
  pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "confess"));
  const acceptScore =
    ba.affection * 0.48 +
    ba.attraction * 0.28 +
    rel.compatibility * 0.22 +
    b.traits.romance * 0.12 -
    b.traits.trustBarrier * 0.2 -
    ba.conflict * 0.4;
  const accept = !partnerOf(world, b.id) && acceptScore > 78 && ba.affection >= 50;
  if (accept) {
    rel.status = "dating";
    rel.sinceDay = clock(world.minute).day;
    rel.initiatorId = a.id;
    ab.commitment = clamp(Math.max(ab.commitment, 28));
    ba.commitment = clamp(Math.max(ba.commitment, 24));
    a.emotions.love = clamp(a.emotions.love + 34);
    b.emotions.love = clamp(b.emotions.love + 28);
    a.emotions.joy = clamp(a.emotions.joy + 26);
    b.emotions.joy = clamp(b.emotions.joy + 22);
    a.needs.affection = clamp(a.needs.affection - 30);
    b.needs.affection = clamp(b.needs.affection - 22);
    pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "accept"));
    const text = `${a.given} tỏ tình với ${b.given} tại ${placeName(a.locationId)}. ${b.given} đồng ý.`;
    logEvent(world, "dating", [a.id, b.id], text, 9);
    rememberCouple(world, a, b, a.locationId, text);
  } else {
    a.confessCooldown[b.id] = clock(world.minute).day + 5;
    a.emotions.disappointment = clamp(a.emotions.disappointment + 30);
    a.emotions.shame = clamp(a.emotions.shame + 16);
    a.emotions.sadness = clamp(a.emotions.sadness + 18);
    a.emotions.hope = clamp(a.emotions.hope - 8);
    ab.affection = clamp(ab.affection - 4);
    b.emotions.shame = clamp(b.emotions.shame + (b.traits.kindness > 60 ? 6 : 2));
    pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "reject"));
    const why = partnerOf(world, b.id) ? `${b.given} đã có người` : `${b.given} không đáp lại`;
    const text = `${a.given} tỏ tình với ${b.given} và bị từ chối. ${why}.`;
    logEvent(world, "reject", [a.id, b.id], text, 8);
    addMemory(world, a, {
      kind: "episodic",
      subjectId: b.id,
      text: `${b.given} từ chối tình cảm của mình tại ${placeName(a.locationId)}.`,
      source: "witnessed",
      importance: 9,
      tags: [`with:${b.id}`, `place:${a.locationId}`, "reject"],
    });
    addMemory(world, b, {
      kind: "episodic",
      subjectId: a.id,
      text: `${a.given} tỏ tình. Mình từ chối.`,
      source: "witnessed",
      importance: 8,
      tags: [`with:${a.id}`, `place:${a.locationId}`, "reject"],
    });
  }
  return true;
}

function doGift(world: World, giver: Agent, receiver: Agent) {
  const gift = giver.holdingGift;
  if (!gift || gift.forId !== receiver.id) return;
  const rel = ensureRel(world, giver.id, receiver.id);
  const placeId = giver.locationId;
  giver.holdingGift = undefined;
  directed(rel, receiver.id).affection = clamp(directed(rel, receiver.id).affection + 14);
  directed(rel, receiver.id).trust = clamp(directed(rel, receiver.id).trust + 8);
  directed(rel, giver.id).affection = clamp(directed(rel, giver.id).affection + 6);
  directed(rel, giver.id).bond = clamp(directed(rel, giver.id).bond + 6);
  directed(rel, receiver.id).bond = clamp(directed(rel, receiver.id).bond + 8);
  receiver.emotions.joy = clamp(receiver.emotions.joy + 26);
  receiver.emotions.love = clamp(receiver.emotions.love + 12);
  giver.emotions.joy = clamp(giver.emotions.joy + 16);
  giver.stats.gifts += 1;
  const text = `${giver.given} tặng ${receiver.given} ${gift.label} tại ${placeName(placeId)}, vì nhớ một điều họ từng kể.`;
  logEvent(world, "gift", [giver.id, receiver.id], text, 8);
  addMemory(world, giver, {
    kind: "episodic",
    subjectId: receiver.id,
    text: `Mình tặng ${receiver.given} ${gift.label}.`,
    source: "self",
    importance: 8,
    tags: ["gifted", `with:${receiver.id}`, `place:${placeId}`, `fact:${gift.factKey}`],
  });
  addMemory(world, receiver, {
    kind: "episodic",
    subjectId: giver.id,
    text: `${giver.given} tặng mình ${gift.label} vì nhớ chuyện mình từng kể.`,
    source: "witnessed",
    importance: 8,
    tags: ["gifted", `with:${giver.id}`, `place:${placeId}`, `fact:${gift.factKey}`],
  });
  lockTalk(world, giver, receiver, 30);
  pushLines(world, placeId, giver.id, receiver.id, linesFor(world, giver, receiver, "gift", gift.label));
  refreshStatus(rel);
}

function doArgument(world: World, a: Agent, b: Agent, rel: Relationship) {
  const placeId = a.locationId;
  directed(rel, a.id).conflict = clamp(directed(rel, a.id).conflict + 12);
  directed(rel, b.id).conflict = clamp(directed(rel, b.id).conflict + 11);
  directed(rel, a.id).affection = clamp(directed(rel, a.id).affection - 5);
  directed(rel, b.id).affection = clamp(directed(rel, b.id).affection - 5);
  a.emotions.anger = clamp(a.emotions.anger + 22);
  b.emotions.anger = clamp(b.emotions.anger + 20);
  a.emotions.disappointment = clamp(a.emotions.disappointment + 12);
  b.emotions.disappointment = clamp(b.emotions.disappointment + 12);
  pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "argue"));
  const soften = (a.traits.kindness + b.traits.kindness) / 2 + ((directed(rel, a.id).bond + directed(rel, b.id).bond) / 2) * 0.35 - (a.traits.temper + b.traits.temper) * 0.12;
  let reconciled = false;
  if (soften > 62 && rng(world) < 0.72) {
    directed(rel, a.id).conflict = clamp(directed(rel, a.id).conflict - 18);
    directed(rel, b.id).conflict = clamp(directed(rel, b.id).conflict - 16);
    directed(rel, a.id).trust = clamp(directed(rel, a.id).trust + 3);
    directed(rel, b.id).trust = clamp(directed(rel, b.id).trust + 3);
    a.emotions.anger = clamp(a.emotions.anger - 10);
    b.emotions.anger = clamp(b.emotions.anger - 10);
    pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "apology"));
    logEvent(world, "reconcile", [a.id, b.id], `${a.given} và ${b.given} cãi nhau tại ${placeName(placeId)} rồi làm lành.`, 7);
    reconciled = true;
  } else {
    logEvent(world, "argument", [a.id, b.id], `${a.given} và ${b.given} tranh cãi tại ${placeName(placeId)}. Chưa ai chịu nhường.`, 7);
  }
  addMemory(world, a, {
    kind: "episodic",
    subjectId: b.id,
    text: reconciled ? `Cãi với ${b.given} rồi làm lành tại ${placeName(placeId)}.` : `Cãi với ${b.given} tại ${placeName(placeId)}. Mình còn ấm ức.`,
    source: "witnessed",
    importance: 7,
    tags: [`with:${b.id}`, `place:${placeId}`, reconciled ? "reconcile" : "argument"],
  });
  addMemory(world, b, {
    kind: "episodic",
    subjectId: a.id,
    text: reconciled ? `Cãi với ${a.given} rồi làm lành.` : `Cãi với ${a.given}. Mình chưa nguôi.`,
    source: "witnessed",
    importance: 7,
    tags: [`with:${a.id}`, `place:${placeId}`, reconciled ? "reconcile" : "argument"],
  });
  const commitment = (directed(rel, a.id).commitment + directed(rel, b.id).commitment) / 2;
  const conflict = (directed(rel, a.id).conflict + directed(rel, b.id).conflict) / 2;
  if (!reconciled && (rel.status === "dating" || rel.status === "married") && conflict > 74 && commitment < 52 && rng(world) < 0.62) {
    breakup(world, a, b, rel);
  }
  lockTalk(world, a, b, 30);
  refreshStatus(rel);
}

function breakup(world: World, a: Agent, b: Agent, rel: Relationship) {
  const wasMarried = rel.status === "married";
  rel.status = wasMarried ? "divorced" : "broken";
  rel.sinceDay = clock(world.minute).day;
  directed(rel, a.id).commitment = 8;
  directed(rel, b.id).commitment = 8;
  directed(rel, a.id).bond = clamp(directed(rel, a.id).bond * 0.45);
  directed(rel, b.id).bond = clamp(directed(rel, b.id).bond * 0.45);
  a.emotions.sadness = clamp(a.emotions.sadness + 34);
  b.emotions.sadness = clamp(b.emotions.sadness + 34);
  a.emotions.love = clamp(a.emotions.love * 0.4);
  b.emotions.love = clamp(b.emotions.love * 0.4);
  const text = wasMarried
    ? `${a.given} và ${b.given} ly hôn sau một thời gian không còn hợp.`
    : `${a.given} chia tay ${b.given}. Cả hai giữ lại ký ức, không giữ lại hẹn ước.`;
  logEvent(world, wasMarried ? "divorce" : "breakup", [a.id, b.id], text, 10);
  pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "break"));
  for (const [one, two] of [[a, b], [b, a]] as const) {
    addMemory(world, one, {
      kind: "episodic",
      subjectId: two.id,
      text,
      source: "witnessed",
      importance: 10,
      tags: [`with:${two.id}`, wasMarried ? "divorce" : "breakup"],
    });
  }
}

function lockTalk(world: World, a: Agent, b: Agent, minutes: number) {
  a.activity = "socializing";
  b.activity = "socializing";
  a.partnerId = b.id;
  b.partnerId = a.id;
  a.busyUntil = world.minute + minutes;
  b.busyUntil = world.minute + minutes;
  a.talksToday += 1;
  b.talksToday += 1;
  a.stats.talks += 1;
  b.stats.talks += 1;
  a.needs.social = clamp(a.needs.social - 24);
  b.needs.social = clamp(b.needs.social - 22);
  a.needs.affection = clamp(a.needs.affection - 8);
  b.needs.affection = clamp(b.needs.affection - 8);
  world.pairCooldown[pairKey(a.id, b.id)] = world.minute + 55;
}

export function interact(world: World, aId: string, bId: string) {
  const a = agent(world, aId);
  const b = agent(world, bId);
  if (a.locationId === "transit" || a.locationId !== b.locationId) return;
  const placeId = a.locationId;
  const rel = ensureRel(world, a.id, b.id);
  const ab = directed(rel, a.id);
  const ba = directed(rel, b.id);
  const first = ab.familiarity < 1 && ba.familiarity < 1;

  if (a.holdingGift?.forId === b.id) {
    doGift(world, a, b);
    return;
  }
  if (b.holdingGift?.forId === a.id) {
    doGift(world, b, a);
    return;
  }

  if (first) {
    const spark = rel.compatibility * (a.traits.romance / 100) * 0.2;
    const sparkB = rel.compatibility * (b.traits.romance / 100) * 0.2;
    ab.familiarity = 10;
    ba.familiarity = 10;
    ab.attraction = clamp(spark);
    ba.attraction = clamp(sparkB);
    ab.respect = 8;
    ba.respect = 8;
    const text = `${a.given} và ${b.given} gặp nhau lần đầu tại ${placeName(placeId)}.`;
    logEvent(world, "meet", [a.id, b.id], text, 6);
    addMemory(world, a, {
      kind: "episodic",
      subjectId: b.id,
      text: `Lần đầu gặp ${b.given} tại ${placeName(placeId)}.`,
      source: "witnessed",
      importance: 6,
      tags: [`with:${b.id}`, `place:${placeId}`, "first"],
    });
    addMemory(world, b, {
      kind: "episodic",
      subjectId: a.id,
      text: `Lần đầu gặp ${a.given} tại ${placeName(placeId)}.`,
      source: "witnessed",
      importance: 6,
      tags: [`with:${a.id}`, `place:${placeId}`, "first"],
    });
    pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "meet"));
  }

  const conflict = (ab.conflict + ba.conflict) / 2;
  const anger = Math.max(a.emotions.anger, b.emotions.anger);
  const jel = Math.max(a.emotions.jealousy, b.emotions.jealousy);
  if (!first && conflict > 50 && ab.familiarity > 16 && (anger > 36 || jel > 46 || conflict > 66)) {
    doArgument(world, a, b, rel);
    jealousyAround(world, a, b, placeId);
    return;
  }

  const vibe = vibeOf(rel, a, b);
  const amount = Math.max(0.35, (vibe - 32) / 14);
  if (!first) {
    applyWarm(rel, a, amount * (0.75 + b.traits.warmth / 180));
    applyWarm(rel, b, amount * (0.75 + a.traits.warmth / 180));
    if (vibe < 34 && a.traits.temper + b.traits.temper > 100) {
      ab.conflict = clamp(ab.conflict + 2);
      ba.conflict = clamp(ba.conflict + 2);
    }
  } else {
    applyWarm(rel, a, amount * 0.55);
    applyWarm(rel, b, amount * 0.55);
  }
  a.emotions.joy = clamp(a.emotions.joy + Math.max(0, vibe - 40) * 0.15);
  b.emotions.joy = clamp(b.emotions.joy + Math.max(0, vibe - 40) * 0.15);
  a.emotions.loneliness = clamp(a.emotions.loneliness - 8);
  b.emotions.loneliness = clamp(b.emotions.loneliness - 8);

  const summary = `Trò chuyện với ${b.given} tại ${placeName(placeId)}.`;
  if (!first) {
    addMemory(world, a, {
      kind: "episodic",
      subjectId: b.id,
      text: summary,
      source: "witnessed",
      importance: 3,
      tags: [`with:${b.id}`, `place:${placeId}`],
    });
    addMemory(world, b, {
      kind: "episodic",
      subjectId: a.id,
      text: `Trò chuyện với ${a.given} tại ${placeName(placeId)}.`,
      source: "witnessed",
      importance: 3,
      tags: [`with:${a.id}`, `place:${placeId}`],
    });
    pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "chat"));
  }

  const recalled = maybeCallback(world, a, b, rel).concat(maybeCallback(world, b, a, rel));
  if (recalled.length) pushLines(world, placeId, a.id, b.id, recalled);
  const revealed = maybeReveal(world, a, b, rel).concat(maybeReveal(world, b, a, rel));
  if (revealed.length) pushLines(world, placeId, a.id, b.id, revealed);

  const higher = ab.affection >= ba.affection ? [a, b] : [b, a];
  romanceSpeech(world, higher[0]!, higher[1]!, rel);
  if (rel.status === "dating" || rel.status === "married") romanceSpeech(world, higher[1]!, higher[0]!, rel);

  refreshStatus(rel);
  lockTalk(world, a, b, first ? 20 : 30);
  jealousyAround(world, a, b, placeId);

  if (rng(world) < 0.2) {
    logEvent(world, "talk", [a.id, b.id], `${a.given} và ${b.given} nói chuyện tại ${placeName(placeId)}.`, first ? 5 : 3);
  }
}

function jealousyAround(world: World, a: Agent, b: Agent, placeId: string) {
  for (const o of witnesses(world, placeId, [a.id, b.id])) {
    const p = partnerOf(world, o.id);
    if (p !== a.id && p !== b.id) continue;
    const other = p === a.id ? b : a;
    const spike = 8 + o.traits.jealousy * 0.22;
    o.emotions.jealousy = clamp(o.emotions.jealousy + spike);
    o.emotions.anger = clamp(o.emotions.anger + o.traits.jealousy * 0.08);
    const rel = ensureRel(world, o.id, p);
    directed(rel, o.id).conflict = clamp(directed(rel, o.id).conflict + 4 + o.traits.jealousy * 0.1);
    addMemory(world, o, {
      kind: "episodic",
      subjectId: p,
      text: `Thấy ${agent(world, p).given} nói chuyện với ${other.given} tại ${placeName(placeId)}.`,
      source: "witnessed",
      importance: 6,
      tags: [`with:${p}`, `place:${placeId}`, "jealousy", `saw:${other.id}`],
    });
    if (o.traits.jealousy > 60) {
      logEvent(
        world,
        "jealousy",
        [o.id, p, other.id],
        `${o.given} thấy ${agent(world, p).given} nói chuyện với ${other.given} và cảm thấy ghen.`,
        6,
      );
    }
  }
}

function release(world: World, a: Agent) {
  if (a.travel) {
    if (world.minute >= a.travel.endMinute) arrive(world, a);
    return;
  }
  if (a.activity === "working" && a.needs.hunger > 88) a.busyUntil = world.minute;
  if (a.activity === "sleeping" && a.needs.health < 22) a.busyUntil = world.minute;
  if (a.busyUntil > world.minute) return;
  if (a.activity === "working") {
    const shift = shiftOf(a, world);
    const hour = hourOf(world);
    const shiftOver = !shift || hour >= shift.end - 0.25;
    if (shiftOver && !a.paidToday) {
      a.money += a.wage;
      a.paidToday = true;
      if (rng(world) < 0.4) logEvent(world, "wage", [a.id], `${a.given} nhận lương ngày: ${a.wage}.`, 2);
    }
  }
  if (a.activity === "socializing") {
    clearWorking(a);
    a.partnerId = undefined;
  }
  if (a.activity !== "idle" && a.activity !== "sleeping") a.activity = "idle";
  if (a.activity === "sleeping" && a.busyUntil <= world.minute) a.activity = "idle";
}

function inferHabits(world: World) {
  for (const watcher of world.agents) {
    watcher.memories = watcher.memories.filter((m) => {
      if (m.kind !== "semantic" || m.source !== "inferred" || !m.factKey?.startsWith("habit:") || !m.subjectId) return true;
      const placeId = m.factKey.slice(6);
      return witnessedCount(watcher, m.subjectId, placeId) >= 3;
    });
    for (const other of world.agents) {
      if (other.id === watcher.id) continue;
      for (const placeId of ["park", "cafe", "mall", "restaurant"]) {
        if (witnessedCount(watcher, other.id, placeId) < 3) continue;
        if (knowsFact(watcher, other.id, `habit:${placeId}`)) continue;
        const name = placeName(placeId);
        addMemory(world, watcher, {
          kind: "semantic",
          subjectId: other.id,
          text: `${other.given} hay xuất hiện ở ${name}. Mình đoán từ những lần tự thấy.`,
          source: "inferred",
          factKey: `habit:${placeId}`,
          factValue: `hay ở ${name}`,
          importance: 4,
          tags: ["habit", `place:${placeId}`],
        });
      }
    }
  }
}


const DAYS_PER_YEAR = 28;
const BABY_NAMES = ["Bông", "Sóc", "Mầm", "Bi", "Nắng", "Mây", "Cốm", "Hạt Dẻ", "Minh Anh", "Gia Bảo"];

function checkConception(world: World) {
  const day = clock(world.minute).day;
  for (const rel of world.relationships) {
    if (rel.status !== "married") continue;
    if (day - rel.sinceDay < 4) continue;
    const a = agent(world, rel.aId);
    const b = agent(world, rel.bId);
    if (!a.alive || !b.alive) continue;
    if (a.age > 45 || b.age > 48) continue;
    if (a.pregnantWithId || b.pregnantWithId) continue;
    if (a.childrenIds.length >= 3) continue;

    const avgAff = (rel.aToB.affection + rel.bToA.affection) / 2;
    const avgCon = (rel.aToB.conflict + rel.bToA.conflict) / 2;
    if (avgAff > 72 && avgCon < 25 && a.money + b.money > 500 && rng(world) < 0.14) {
      const femaleIds = new Set(["linh", "ha", "mai", "chi"]);
      const carrier = femaleIds.has(a.id) ? a : femaleIds.has(b.id) ? b : a;
      const partner = carrier.id === a.id ? b : a;
      carrier.pregnantWithId = partner.id;
      carrier.pregnancyDays = 1;
      carrier.lastThought = `Mình đang mang thai con của ${partner.given}. Mọi thứ sắp thay đổi.`;
      logEvent(world, "pregnancy", [carrier.id, partner.id], `${carrier.given} và ${partner.given} sắp đón con đầu lòng!`, 9);
    }
  }
}

function giveBirth(world: World, mother: Agent, father: Agent) {
  const day = clock(world.minute).day;
  const given = BABY_NAMES[Math.floor(rng(world) * BABY_NAMES.length)]!;
  const familySurname = father.name.split(" ").pop() ?? "Nguyễn";
  const childId = `child_${world.nextId++}`;

  const mixTrait = (k: keyof Agent["traits"]) =>
    clamp(Math.round((mother.traits[k] + father.traits[k]) / 2 + (rng(world) - 0.5) * 24));

  const child: Agent = {
    id: childId,
    name: `${given} ${familySurname}`,
    given,
    age: 0,
    birthDay: day,
    job: "Trẻ nhỏ",
    workplaceId: "school",
    homeId: mother.homeId,
    wage: 0,
    rent: 0,
    money: 0,
    traits: {
      extroversion: mixTrait("extroversion"),
      warmth: mixTrait("warmth"),
      temper: mixTrait("temper"),
      humor: mixTrait("humor"),
      confidence: mixTrait("confidence"),
      romance: mixTrait("romance"),
      selfishness: mixTrait("selfishness"),
      kindness: mixTrait("kindness"),
      jealousy: mixTrait("jealousy"),
      trustBarrier: mixTrait("trustBarrier"),
    },
    needs: { hunger: 25, thirst: 20, sleepiness: 20, fun: 20, social: 20, affection: 10, safety: 10, health: 98 },
    emotions: { joy: 40, sadness: 0, anger: 0, anxiety: 0, jealousy: 0, shame: 0, loneliness: 0, disappointment: 0, hope: 30, love: 35 },
    facts: [{ key: "born", value: `sinh ra tại thành phố vào ngày ${day + 1}`, intimacy: 1 }],
    bio: `Con của ${father.given} và ${mother.given}.`,
    routine: "Ở nhà cùng bố mẹ cho đến khi đủ tuổi đến Trường Bình Minh.",
    family: `Bố là ${father.given}, mẹ là ${mother.given}.`,
    dream: "Lớn lên thật vui vẻ",
    appearance: {
      skin: rng(world) < 0.5 ? mother.appearance.skin : father.appearance.skin,
      hair: rng(world) < 0.5 ? mother.appearance.hair : father.appearance.hair,
      outfit: "#fde68a",
      pants: "#93c5fd",
      hairStyle: rng(world) < 0.5 ? "short" : "bob",
      height: 0.55,
    },
    memories: [],
    locationId: mother.homeId,
    activity: "sleeping",
    travel: null,
    busyUntil: world.minute + 120,
    activityApplied: false,
    lastThought: "Thế giới rộng lớn quá.",
    lastShopDay: day,
    paidToday: false,
    hadLunch: false,
    hadBreakfast: false,
    talksToday: 0,
    confessCooldown: {},
    workChatty: false,
    stats: { sleeps: 0, meals: 0, talks: 0, gifts: 0 },
    parentIds: [father.id, mother.id],
    childrenIds: [],
    pregnancyDays: 0,
    alive: true,
  };

  world.agents.push(child);
  mother.childrenIds.push(child.id);
  father.childrenIds.push(child.id);
  mother.pregnantWithId = undefined;
  mother.pregnancyDays = 0;

  for (const parent of [mother, father]) {
    const rel = ensureRel(world, parent.id, child.id);
    rel.status = "close";
    directed(rel, parent.id).affection = 95;
    directed(rel, parent.id).bond = 95;
    directed(rel, child.id).affection = 95;
    directed(rel, child.id).trust = 95;
  }

  logEvent(world, "birth", [mother.id, father.id, child.id], `Bé ${child.given} chào đời! Gia đình ${mother.given} – ${father.given} thêm thành viên mới.`, 10);
}

export function processAgingAndFamily(world: World) {
  const day = clock(world.minute).day;
  checkConception(world);

  for (const a of [...world.agents]) {
    if (!a.alive) continue;

    if (a.pregnantWithId) {
      a.pregnancyDays += 1;
      a.needs.sleepiness = clamp(a.needs.sleepiness + 10);
      if (a.pregnancyDays >= 9) {
        const father = world.agents.find((x) => x.id === a.pregnantWithId) ?? a;
        giveBirth(world, a, father);
      }
    }

    const newAge = Math.floor((day - a.birthDay) / DAYS_PER_YEAR);
    if (newAge > a.age) {
      a.age = newAge;
      if (a.age <= 18) {
        a.appearance.height = Number((0.55 + (a.age / 18) * 0.45).toFixed(2));
      }
      if (a.age === 6) {
        a.job = "Học sinh tiểu học";
        logEvent(world, "milestone", [a.id], `${a.given} tròn 6 tuổi và bắt đầu đi học tại Trường Bình Minh.`, 7);
      } else if (a.age === 18) {
        a.job = "Nhân viên tự do";
        a.workplaceId = "cafe";
        a.wage = 160;
        logEvent(world, "milestone", [a.id], `${a.given} tròn 18 tuổi, chính thức trưởng thành và bắt đầu đi làm!`, 8);
      } else if (a.age === 60) {
        a.appearance.hair = "#cbd5e1";
        logEvent(world, "milestone", [a.id], `${a.given} bước sang tuổi 60, mái tóc đã điểm bạc.`, 7);
      } else if (a.age === 65 && !a.retired) {
        a.retired = true;
        a.job = "Nghỉ hưu";
        a.wage = 120;
        logEvent(world, "milestone", [a.id], `${a.given} nghỉ hưu ở tuổi 65, tận hưởng tuổi già bình yên.`, 8);
      } else {
        logEvent(world, "birthday", [a.id], `Hôm nay là sinh nhật ${a.age} tuổi của ${a.given}.`, 5);
      }
    }

    if (a.age > 65) {
      const decline = (a.age - 65) * 0.18;
      a.needs.health = clamp(a.needs.health - decline);
      if (a.age >= 82 && rng(world) < (a.age - 80) * 0.03) {
        a.alive = false;
        a.activity = "idle";
        logEvent(world, "death", [a.id], `${a.given} đã ra đi thanh thản ở tuổi ${a.age}.`, 10);
      }
    }
  }
}

export function onNewDay(world: World) {
  const c = clock(world.minute);
  const roll = rng(world);
  const next = roll < 0.58 ? "clear" : roll < 0.82 ? "cloudy" : "rain";
  if (next !== world.weather) {
    world.weather = next;
    const label = next === "rain" ? "Trời mưa trên thành phố." : next === "cloudy" ? "Mây kéo dày." : "Trời quang trở lại.";
    logEvent(world, "weather", [], label, 2);
  } else world.weather = next;
  for (const a of world.agents) {
    if (!a.alive) continue;
    a.hadLunch = false;
    a.hadBreakfast = false;
    a.paidToday = false;
    a.talksToday = 0;
    if (c.dayIndex === 0) {
      a.money -= a.rent;
      if (a.money < 120) {
        a.emotions.anxiety = clamp(a.emotions.anxiety + 12);
        logEvent(world, "rent", [a.id], `${a.given} trả tiền nhà và ví mỏng đi thấy rõ.`, 4);
      }
    }
  }
  for (const rel of world.relationships) {
    const days = c.day - rel.sinceDay;
    void days;
    for (const dir of [rel.aToB, rel.bToA]) {
      if (dir.familiarity > 0) dir.familiarity = clamp(dir.familiarity - 0.35);
      if (dir.affection > 0 && rel.status !== "married") dir.affection = clamp(dir.affection - 0.25);
      if (dir.conflict > 0) dir.conflict = clamp(dir.conflict - 1.1);
    }
  }
  inferHabits(world);
  processAgingAndFamily(world);
}

export function step(world: World) {
  const prevDay = Math.floor(world.minute / 1440);
  world.minute += 10;
  if (Math.floor(world.minute / 1440) !== prevDay) onNewDay(world);

  for (const a of world.agents) {
    if (!a.alive) continue;
    release(world, a);
  }
  for (const a of world.agents) {
    if (!a.alive) continue;
    tickNeeds(a, 10);
    tickEmotions(a);
    a.workChatty = a.activity === "working" && serviceJob(a) && rng(world) < 0.2;
  }
  socialize(world);
  for (const a of world.agents) {
    if (!a.alive) continue;
    if (a.travel) continue;
    if (a.busyUntil > world.minute) continue;
    decide(world, a);
  }
}

function socialize(world: World) {
  const groups = new Map<string, Agent[]>();
  for (const a of world.agents) {
    if (!a.alive || !openToTalk(world, a)) continue;
    const list = groups.get(a.locationId) ?? [];
    list.push(a);
    groups.set(a.locationId, list);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const pairs: { a: Agent; b: Agent; score: number }[] = [];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        const key = pairKey(a.id, b.id);
        if ((world.pairCooldown[key] ?? 0) > world.minute) continue;
        const rel = ensureRel(world, a.id, b.id);
        const ab = directed(rel, a.id);
        const ba = directed(rel, b.id);
        const curiosity = ab.familiarity < 18 ? 16 : 0;
        const pull = (a.needs.social + b.needs.social) * 0.22;
        const interest = (ab.affection + ba.affection) * 0.28 + (ab.attraction + ba.attraction) * 0.12;
        const shy = (100 - a.traits.confidence) * 0.08 + (100 - b.traits.confidence) * 0.08;
        const block = (ab.conflict + ba.conflict) * 0.18;
        let score = pull + interest + curiosity + rel.compatibility * 0.08 - shy - block;
        if (a.holdingGift?.forId === b.id || b.holdingGift?.forId === a.id) score += 80;
        if (a.seekTargetId === b.id || b.seekTargetId === a.id) score += 24;
        pairs.push({ a, b, score });
      }
    }
    pairs.sort((x, y) => y.score - x.score);
    const used = new Set<string>();
    for (const p of pairs) {
      if (p.score < 30) continue;
      if (used.has(p.a.id) || used.has(p.b.id)) continue;
      used.add(p.a.id);
      used.add(p.b.id);
      interact(world, p.a.id, p.b.id);
    }
  }
}
