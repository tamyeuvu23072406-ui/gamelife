import type { Agent, DirRel, EmotionKey, Emotions, Relationship, World } from "./types.ts";

export function clamp(n: number, a = 0, b = 100): number {
  if (Number.isNaN(n)) return a;
  return Math.max(a, Math.min(b, n));
}

export function rng(world: World): number {
  let a = world.rngState >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  world.rngState = a;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pick<T>(world: World, items: readonly T[]): T {
  return items[Math.floor(rng(world) * items.length)]!;
}

export function clock(minute: number) {
  const day = Math.floor(minute / 1440);
  const mod = ((minute % 1440) + 1440) % 1440;
  return {
    day,
    dayIndex: ((day % 7) + 7) % 7,
    hour: Math.floor(mod / 60),
    minute: mod % 60,
    abs: minute,
  };
}

export const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"] as const;

export function formatClock(minute: number): string {
  const c = clock(minute);
  const hh = String(c.hour).padStart(2, "0");
  const mm = String(c.minute).padStart(2, "0");
  return `${WEEKDAYS[c.dayIndex]} · Ngày ${c.day + 1} · ${hh}:${mm}`;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function emptyDir(): DirRel {
  return {
    familiarity: 0,
    trust: 0,
    respect: 0,
    affection: 0,
    attraction: 0,
    bond: 0,
    conflict: 0,
    commitment: 0,
  };
}

export function agent(world: World, id: string): Agent {
  const found = world.agents.find((a) => a.id === id);
  if (!found) throw new Error(`missing agent ${id}`);
  return found;
}

export function otherId(rel: Relationship, id: string): string {
  return rel.aId === id ? rel.bId : rel.aId;
}

export function directed(rel: Relationship, fromId: string): DirRel {
  if (rel.aId === fromId) return rel.aToB;
  if (rel.bId === fromId) return rel.bToA;
  throw new Error("directed");
}

const EMOTION_LABEL: Record<EmotionKey, string> = {
  joy: "Vui",
  sadness: "Buồn",
  anger: "Tức giận",
  anxiety: "Lo lắng",
  jealousy: "Ghen",
  shame: "Xấu hổ",
  loneliness: "Cô đơn",
  disappointment: "Thất vọng",
  hope: "Hy vọng",
  love: "Yêu thương",
};

export function dominantEmotion(emotions: Emotions): { key: EmotionKey; label: string; value: number } {
  let key: EmotionKey = "joy";
  let value = -1;
  for (const k of Object.keys(emotions) as EmotionKey[]) {
    if (emotions[k] > value) {
      value = emotions[k];
      key = k;
    }
  }
  return { key, label: EMOTION_LABEL[key], value };
}

export function emotionLabel(key: EmotionKey): string {
  return EMOTION_LABEL[key];
}

export function traitWords(t: Agent["traits"]): string[] {
  const words: { ok: boolean; label: string }[] = [
    { ok: t.extroversion >= 62, label: "Hướng ngoại" },
    { ok: t.extroversion <= 38, label: "Hướng nội" },
    { ok: t.warmth >= 68, label: "Dịu dàng" },
    { ok: t.temper >= 60, label: "Nóng tính" },
    { ok: t.humor >= 68, label: "Hài hước" },
    { ok: t.humor <= 38, label: "Ít nói" },
    { ok: t.confidence >= 68, label: "Tự tin" },
    { ok: t.confidence <= 36, label: "Nhút nhát" },
    { ok: t.romance >= 68, label: "Lãng mạn" },
    { ok: t.selfishness >= 55, label: "Hơi ích kỷ" },
    { ok: t.kindness >= 72, label: "Tốt bụng" },
    { ok: t.jealousy >= 62, label: "Hay ghen" },
    { ok: t.trustBarrier >= 62, label: "Khó tin người" },
  ];
  return words.filter((w) => w.ok).map((w) => w.label);
}

export function activityLabel(a: Agent): string {
  const map: Record<Agent["activity"], string> = {
    idle: "Ở nhà",
    walking: "Đang đi",
    working: "Đang làm việc",
    eating: "Đang ăn",
    drinking: "Đang uống",
    sleeping: "Đang ngủ",
    relaxing: "Đang nghỉ",
    shopping: "Đang mua sắm",
    socializing: "Đang trò chuyện",
    seeking: "Đang tìm một người",
    treatment: "Đang được khám",
  };
  return map[a.activity];
}

export function sourceLabel(s: Agent["memories"][number]["source"]): string {
  if (s === "witnessed") return "Chứng kiến";
  if (s === "told") return "Được kể";
  if (s === "inferred") return "Suy đoán";
  return "Bản thân";
}
