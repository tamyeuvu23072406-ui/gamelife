import { SEEDS } from "./data.ts";
import { addMemory } from "./memory.ts";
import { compatibility, ensureRel, step as stepWorld } from "./systems.ts";
import { SAVE_VERSION, type Agent, type Emotions, type Needs, type World } from "./types.ts";
import { clock } from "./util.ts";

export const SAVE_KEY = "soulmate-save-v1";

function needsOf(hunger: number, social: number): Needs {
  return {
    hunger,
    thirst: 28,
    sleepiness: 18,
    fun: 30,
    social,
    affection: 18,
    safety: 22,
    health: 93,
  };
}

function emotionsOf(): Emotions {
  return {
    joy: 18,
    sadness: 6,
    anger: 0,
    anxiety: 8,
    jealousy: 0,
    shame: 0,
    loneliness: 12,
    disappointment: 0,
    hope: 22,
    love: 0,
  };
}

export function createWorld(seed = 20261120): World {
  const world: World = {
    version: SAVE_VERSION,
    seed,
    rngState: seed >>> 0,
    minute: 7 * 60,
    weather: "clear",
    agents: [],
    relationships: [],
    events: [],
    lines: [],
    nextId: 1,
    pairCooldown: {},
  };
  world.agents = SEEDS.map((seedAgent) => {
    const agent: Agent = {
      id: seedAgent.id,
      name: seedAgent.name,
      given: seedAgent.given,
      age: seedAgent.age,
      job: seedAgent.job,
      workplaceId: seedAgent.workplaceId,
      homeId: seedAgent.homeId,
      wage: seedAgent.wage,
      rent: seedAgent.rent,
      money: seedAgent.money,
      traits: { ...seedAgent.traits },
      needs: needsOf(seedAgent.hunger, seedAgent.social),
      emotions: emotionsOf(),
      facts: seedAgent.facts.map((f) => ({ ...f, gift: f.gift ? { ...f.gift } : undefined })),
      bio: seedAgent.bio,
      routine: seedAgent.routine,
      family: seedAgent.family,
      dream: seedAgent.dream,
      appearance: { ...seedAgent.appearance },
      memories: [],
      locationId: seedAgent.homeId,
      activity: "idle",
      travel: null,
      busyUntil: 0,
      activityApplied: false,
      lastThought: "Một ngày mới. Mình chưa quyết định gì ngoài việc bước ra cửa.",
      lastShopDay: -3,
      paidToday: false,
      hadLunch: false,
      hadBreakfast: false,
      talksToday: 0,
      confessCooldown: {},
      workChatty: false,
      stats: { sleeps: 0, meals: 0, talks: 0, gifts: 0 },
      birthDay: -seedAgent.age * 28,
      childrenIds: [],
      pregnancyDays: 0,
      alive: true,
    };
    return agent;
  });
  for (let i = 0; i < world.agents.length; i++) {
    for (let j = i + 1; j < world.agents.length; j++) {
      const a = world.agents[i]!;
      const b = world.agents[j]!;
      const x = a.id < b.id ? a.id : b.id;
      const y = a.id < b.id ? b.id : a.id;
      world.relationships.push({
        aId: x,
        bId: y,
        aToB: { familiarity: 0, trust: 0, respect: 0, affection: 0, attraction: 0, bond: 0, conflict: 0, commitment: 0 },
        bToA: { familiarity: 0, trust: 0, respect: 0, affection: 0, attraction: 0, bond: 0, conflict: 0, commitment: 0 },
        compatibility: compatibility(a, b),
        status: "stranger",
        sinceDay: 0,
      });
    }
  }
  for (const a of world.agents) {
    addMemory(world, a, {
      kind: "episodic",
      text: `${a.family}`,
      source: "self",
      importance: 5,
      tags: ["family", "self"],
    });
    addMemory(world, a, {
      kind: "semantic",
      subjectId: a.id,
      text: a.dream,
      source: "self",
      factKey: "dream",
      factValue: a.dream,
      importance: 6,
      tags: ["self", "dream"],
    });
  }
  world.events.push({
    id: `e${world.nextId++}`,
    day: 0,
    minute: world.minute,
    hour: 7,
    min: 0,
    type: "dawn",
    actorIds: [],
    text: "Thành phố mở mắt. Tám người bắt đầu một ngày mà chưa ai viết sẵn kết cục.",
    importance: 4,
  });
  return world;
}

export function step(world: World) {
  stepWorld(world);
}

export function runDays(world: World, days: number) {
  const steps = Math.round(days * 144);
  for (let i = 0; i < steps; i++) step(world);
}

export function serialize(world: World): string {
  return JSON.stringify({ ...world, version: SAVE_VERSION });
}

export function deserialize(raw: string): World {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Bản lưu không đọc được.");
  }
  if (!data || typeof data !== "object") throw new Error("Bản lưu trống.");
  const world = data as World;
  if (world.version !== SAVE_VERSION || !Array.isArray(world.agents) || world.agents.length < 2) {
    throw new Error("Bản lưu không cùng phiên bản.");
  }
  if (typeof world.minute !== "number" || typeof world.rngState !== "number" || !world.pairCooldown) {
    throw new Error("Bản lưu thiếu thời gian.");
  }
  return world;
}

export function worldClock(world: World) {
  return clock(world.minute);
}

export { ensureRel };
