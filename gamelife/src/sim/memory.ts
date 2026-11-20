import type { Agent, Memory, MemorySource, World } from "./types.ts";
import { clock } from "./util.ts";

export function addMemory(
  world: World,
  owner: Agent,
  partial: Omit<Memory, "id" | "day" | "minute" | "tags"> & { tags?: string[] },
): Memory {
  const c = clock(world.minute);
  const memory: Memory = {
    id: `m${world.nextId++}`,
    day: c.day,
    minute: world.minute,
    tags: partial.tags ?? [],
    kind: partial.kind,
    text: partial.text,
    source: partial.source,
    importance: partial.importance,
  };
  if (partial.subjectId) memory.subjectId = partial.subjectId;
  if (partial.factKey) memory.factKey = partial.factKey;
  if (partial.factValue) memory.factValue = partial.factValue;
  owner.memories.push(memory);
  trim(owner, "episodic", 70);
  trim(owner, "semantic", 36);
  const working = owner.memories.filter((m) => m.kind === "working");
  if (working.length > 8) {
    const drop = new Set(working.slice(0, working.length - 8).map((m) => m.id));
    owner.memories = owner.memories.filter((m) => !drop.has(m.id));
  }
  return memory;
}

function trim(owner: Agent, kind: Memory["kind"], max: number) {
  const list = owner.memories.filter((m) => m.kind === kind);
  if (list.length <= max) return;
  const sticky = (m: Memory) =>
    m.tags.some((t) => t.startsWith("shared:") || t === "first" || t === "gifted" || t === "reject" || t === "breakup" || t === "romance" || t === "divorce");
  const droppable = list.filter((m) => !sticky(m));
  droppable.sort((a, b) => a.importance - b.importance || a.minute - b.minute);
  let extra = list.length - max;
  const drop = new Set<string>();
  for (const m of droppable) {
    if (extra <= 0) break;
    drop.add(m.id);
    extra -= 1;
  }
  if (extra > 0) {
    const rest = list.filter((m) => !drop.has(m.id)).sort((a, b) => a.importance - b.importance || a.minute - b.minute);
    for (const m of rest) {
      if (extra <= 0) break;
      drop.add(m.id);
      extra -= 1;
    }
  }
  owner.memories = owner.memories.filter((m) => !drop.has(m.id));
}

export function knowsFact(agent: Agent, subjectId: string, factKey: string): boolean {
  return agent.memories.some(
    (m) => m.kind === "semantic" && m.subjectId === subjectId && m.factKey === factKey,
  );
}

export function clearWorking(agent: Agent) {
  agent.memories = agent.memories.filter((m) => m.kind !== "working");
}

export function shareFact(world: World, speaker: Agent, listener: Agent, factKey: string) {
  const fact = speaker.facts.find((f) => f.key === factKey);
  if (!fact) return false;
  if (knowsFact(listener, speaker.id, fact.key)) return false;
  addMemory(world, listener, {
    kind: "semantic",
    subjectId: speaker.id,
    text: `${speaker.given} nói rằng mình ${fact.value}.`,
    source: "told",
    factKey: fact.key,
    factValue: fact.value,
    importance: 4 + fact.intimacy * 2,
    tags: ["fact", `fact:${fact.key}`],
  });
  addMemory(world, speaker, {
    kind: "episodic",
    subjectId: listener.id,
    text: `Mình đã kể cho ${listener.given}: ${fact.value}.`,
    source: "self",
    importance: 8,
    tags: [`shared:${fact.key}`, `with:${listener.id}`],
  });
  return true;
}

export function witnessedCount(agent: Agent, subjectId: string, placeId: string): number {
  return agent.memories.filter(
    (m) =>
      m.kind === "episodic" &&
      m.source === "witnessed" &&
      m.subjectId === subjectId &&
      m.tags.includes(`place:${placeId}`),
  ).length;
}

export function sourceRank(source: MemorySource): number {
  if (source === "witnessed" || source === "self") return 3;
  if (source === "told") return 2;
  return 1;
}
