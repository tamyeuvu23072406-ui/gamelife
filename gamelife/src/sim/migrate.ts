import { SAVE_VERSION, type Agent, type EmotionKey, type Emotions, type World, type WorldRules } from "./types.ts";

const NEED_KEYS = ["hunger", "thirst", "sleepiness", "fun", "social", "affection", "safety", "health"] as const;
const EMOTION_KEYS: EmotionKey[] = [
  "joy",
  "sadness",
  "anger",
  "anxiety",
  "jealousy",
  "shame",
  "loneliness",
  "disappointment",
  "hope",
  "love",
];

function finite(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clamp100(n: unknown, fallback: number): number {
  return Math.max(0, Math.min(100, finite(n, fallback)));
}

function sanitizeAgent(item: unknown): Agent {
  if (!item || typeof item !== "object") throw new Error("Bản lưu thiếu nhân vật.");
  const agent = item as Agent;
  if (!agent.id || !agent.name || !agent.needs || !agent.emotions || !agent.traits || !agent.appearance) {
    throw new Error("Bản lưu thiếu nhân vật.");
  }
  for (const key of NEED_KEYS) agent.needs[key] = clamp100(agent.needs[key], 40);
  for (const key of EMOTION_KEYS) agent.emotions[key] = clamp100((agent.emotions as Partial<Emotions>)[key], 0);
  if (!Array.isArray(agent.memories)) agent.memories = [];
  if (!Array.isArray(agent.childrenIds)) agent.childrenIds = [];
  if (!agent.stats) agent.stats = { sleeps: 0, meals: 0, talks: 0, gifts: 0 };
  if (!agent.confessCooldown) agent.confessCooldown = {};
  if (agent.alive === undefined) agent.alive = true;
  if (!Number.isFinite(agent.pregnancyDays)) agent.pregnancyDays = 0;
  if (!Number.isFinite(agent.money)) agent.money = 0;
  if (agent.travel && (!Array.isArray(agent.travel.path) || agent.travel.path.length < 2)) agent.travel = null;
  return agent;
}

/** Accepts save v1 and v2. v1 is stamped to v2 without dropping fields. */
export function migrateWorld(data: unknown): World {
  if (!data || typeof data !== "object") throw new Error("Bản lưu trống.");
  const raw = data as Record<string, unknown>;
  if (raw.version !== 1 && raw.version !== 2) throw new Error("Bản lưu không cùng phiên bản.");
  if (!Array.isArray(raw.agents) || raw.agents.length < 2) throw new Error("Bản lưu thiếu nhân vật.");
  if (typeof raw.minute !== "number" || !Number.isFinite(raw.minute)) throw new Error("Bản lưu thiếu thời gian.");
  if (typeof raw.rngState !== "number" || !Number.isFinite(raw.rngState)) throw new Error("Bản lưu thiếu thời gian.");

  const incoming = raw.rules;
  const rules: WorldRules =
    incoming && typeof incoming === "object"
      ? {
          romance: (incoming as Partial<WorldRules>).romance !== false,
          family: (incoming as Partial<WorldRules>).family !== false,
          economy: (incoming as Partial<WorldRules>).economy !== false,
        }
      : { romance: true, family: true, economy: true };

  return {
    version: SAVE_VERSION,
    seed: finite(raw.seed, 1) >>> 0,
    rngState: (raw.rngState as number) >>> 0,
    minute: raw.minute,
    weather: raw.weather === "rain" || raw.weather === "cloudy" ? raw.weather : "clear",
    agents: raw.agents.map(sanitizeAgent),
    relationships: Array.isArray(raw.relationships) ? (raw.relationships as World["relationships"]) : [],
    events: Array.isArray(raw.events) ? (raw.events as World["events"]) : [],
    lines: Array.isArray(raw.lines) ? (raw.lines as World["lines"]) : [],
    nextId: Math.max(1, Math.floor(finite(raw.nextId, 1))),
    pairCooldown:
      raw.pairCooldown && typeof raw.pairCooldown === "object" ? (raw.pairCooldown as Record<string, number>) : {},
    rules,
  };
}
