import { sourceRank } from "../memory.ts";
import type { Agent, Memory } from "../types.ts";

export type MemoryQuery = {
  subjectId?: string;
  placeId?: string;
  kind?: Memory["kind"] | "all";
  source?: Memory["source"] | "all";
  text?: string;
};

export function scoreMemory(memory: Memory, nowMinute: number, query: MemoryQuery): number {
  const ageDays = Math.max(0, (nowMinute - memory.minute) / 1440);
  const recency = 12 / (1 + ageDays);
  let score = memory.importance * 1.7 + recency + sourceRank(memory.source);
  if (query.subjectId && memory.subjectId === query.subjectId) score += 8;
  if (query.placeId && memory.tags.includes(`place:${query.placeId}`)) score += 5;
  if (query.text && memory.text.toLowerCase().includes(query.text.toLowerCase())) score += 6;
  if (memory.tags.some((tag) => tag === "first" || tag === "romance" || tag === "gifted" || tag === "breakup")) {
    score += 2.5;
  }
  return score;
}

export function retrieveMemories(agent: Agent, nowMinute: number, query: MemoryQuery, limit = 14): Memory[] {
  return agent.memories
    .filter((memory) => (query.kind && query.kind !== "all" ? memory.kind === query.kind : true))
    .filter((memory) => (query.source && query.source !== "all" ? memory.source === query.source : true))
    .map((memory) => ({ memory, score: scoreMemory(memory, nowMinute, query) }))
    .sort((a, b) => b.score - a.score || b.memory.minute - a.memory.minute)
    .slice(0, limit)
    .map((row) => row.memory);
}
