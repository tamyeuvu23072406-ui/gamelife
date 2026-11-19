import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWorld, deserialize, runDays, serialize, step } from "./engine.ts";
import { knowsFact } from "./memory.ts";
import { ensureRel, interact } from "./systems.ts";
import type { Agent, World } from "./types.ts";
import { agent, directed } from "./util.ts";

function findAgent(world: World, id: string): Agent {
  return agent(world, id);
}

describe("soulmate simulation", () => {
  it("runs 30 days without leaking unwitnessed secrets", () => {
    const world = createWorld(20261120);
    runDays(world, 30);
    for (const person of world.agents) {
      for (const key of ["hunger", "thirst", "sleepiness", "fun", "social", "affection", "safety", "health"] as const) {
        const v = person.needs[key];
        assert.ok(v >= 0 && v <= 100, `${person.id} need ${key} ${v}`);
      }
      assert.ok(person.stats.sleeps >= 20, `${person.id} slept ${person.stats.sleeps}`);
      assert.ok(person.memories.some((m) => m.kind === "episodic"), `${person.id} has no episodic memory`);
    }
    for (const person of world.agents) {
      for (const mem of person.memories) {
        if (mem.kind !== "semantic" || !mem.factKey || !mem.subjectId || mem.subjectId === person.id) continue;
        if (mem.source === "self") continue;
        const owner = findAgent(world, mem.subjectId);
        if (mem.source === "told") {
          const proof = owner.memories.some(
            (m) => m.tags.includes(`shared:${mem.factKey}`) && m.subjectId === person.id,
          );
          assert.equal(proof, true, `${person.id} knows ${mem.factKey} about ${owner.id} without a share`);
        }
        if (mem.source === "inferred" && mem.factKey.startsWith("habit:")) {
          const placeId = mem.factKey.slice(6);
          const seen = person.memories.filter(
            (m) => m.kind === "episodic" && m.source === "witnessed" && m.subjectId === owner.id && m.tags.includes(`place:${placeId}`),
          ).length;
          assert.ok(seen >= 3, `${person.id} inferred ${placeId} about ${owner.id} from ${seen} sights`);
        }
      }
    }
    const meetMemories = world.agents.reduce((n, person) => n + person.memories.filter((m) => m.tags.includes("first")).length, 0);
    const talks = world.agents.reduce((n, person) => n + person.stats.talks, 0);
    assert.ok(meetMemories >= 8, `only ${meetMemories} first-meeting memories`);
    assert.ok(talks >= 20, `only ${talks} talks`);
    const romance = world.events.filter((e) =>
      ["dating", "reject", "marriage", "breakup", "divorce", "gift", "jealousy", "argument", "reconcile", "reunite"].includes(e.type),
    );
    console.log(
      JSON.stringify(
        {
          day: Math.floor(world.minute / 1440) + 1,
          meetMemories,
          talks,
          romance: romance.map((e) => `${e.type}: ${e.text}`),
          headlines: world.events.filter((e) => e.importance >= 7).map((e) => e.text),
        },
        null,
        2,
      ),
    );
  });

  it("round-trips memories through a save", () => {
    const world = createWorld(7);
    runDays(world, 2);
    const raw = serialize(world);
    const loaded = deserialize(raw);
    assert.equal(loaded.agents.length, world.agents.length);
    for (let i = 0; i < world.agents.length; i++) {
      assert.deepEqual(loaded.agents[i]!.memories, world.agents[i]!.memories);
      assert.equal(loaded.agents[i]!.money, world.agents[i]!.money);
    }
    assert.deepEqual(loaded.relationships, world.relationships);
    const again = deserialize(serialize(loaded));
    step(again);
    assert.ok(again.minute > loaded.minute);
  });

  it("rejects a confession that is not returned", () => {
    const world = createWorld(3);
    const linh = findAgent(world, "linh");
    const khoa = findAgent(world, "khoa");
    linh.locationId = "park";
    khoa.locationId = "park";
    linh.activity = "relaxing";
    khoa.activity = "relaxing";
    linh.travel = null;
    khoa.travel = null;
    const rel = ensureRel(world, linh.id, khoa.id);
    directed(rel, linh.id).affection = 84;
    directed(rel, linh.id).attraction = 76;
    directed(rel, linh.id).familiarity = 48;
    directed(rel, khoa.id).affection = 18;
    directed(rel, khoa.id).attraction = 10;
    directed(rel, khoa.id).familiarity = 40;
    linh.traits.confidence = 96;
    linh.traits.trustBarrier = 5;
    let rejected = false;
    for (let i = 0; i < 12 && !rejected; i++) {
      world.pairCooldown = {};
      linh.activity = "relaxing";
      khoa.activity = "relaxing";
      linh.busyUntil = 0;
      khoa.busyUntil = 0;
      interact(world, linh.id, khoa.id);
      rejected = world.events.some((e) => e.type === "reject");
    }
    assert.equal(rejected, true);
    assert.equal(rel.status === "dating", false);
    assert.ok(linh.memories.some((m) => m.tags.includes("reject")));
    assert.equal(knowsFact(khoa, "chi", "clinic"), false);
  });

  it("accepts love only when both sides feel it", () => {
    const world = createWorld(4);
    const mai = findAgent(world, "mai");
    const duc = findAgent(world, "duc");
    mai.locationId = "restaurant";
    duc.locationId = "restaurant";
    mai.activity = "eating";
    duc.activity = "eating";
    mai.travel = null;
    duc.travel = null;
    const rel = ensureRel(world, mai.id, duc.id);
    for (const dir of [directed(rel, mai.id), directed(rel, duc.id)]) {
      dir.affection = 78;
      dir.attraction = 70;
      dir.familiarity = 50;
      dir.trust = 40;
    }
    mai.traits.confidence = 90;
    mai.traits.trustBarrier = 10;
    let dating = false;
    for (let i = 0; i < 8 && !dating; i++) {
      world.pairCooldown = {};
      mai.busyUntil = 0;
      duc.busyUntil = 0;
      mai.activity = "eating";
      duc.activity = "eating";
      interact(world, mai.id, duc.id);
      dating = rel.status === "dating";
    }
    assert.equal(dating, true);
    assert.ok(world.events.some((e) => e.type === "dating"));
  });

  it("remembers a private like and can give it back", () => {
    const world = createWorld(9);
    world.minute = 5 * 1440 + 17 * 60;
    const minh = findAgent(world, "minh");
    const linh = findAgent(world, "linh");
    minh.money = 800;
    minh.needs.hunger = 10;
    minh.needs.sleepiness = 10;
    minh.needs.thirst = 10;
    minh.locationId = minh.homeId;
    minh.activity = "idle";
    minh.busyUntil = 0;
    minh.travel = null;
    const rel = ensureRel(world, minh.id, linh.id);
    directed(rel, minh.id).affection = 72;
    directed(rel, minh.id).familiarity = 40;
    directed(rel, minh.id).attraction = 40;
    minh.memories.push({
      id: "seed-fact",
      kind: "semantic",
      subjectId: linh.id,
      text: "Linh nói rằng mình thích hoa hướng dương.",
      tags: ["fact"],
      source: "told",
      factKey: "sunflower",
      factValue: "thích hoa hướng dương",
      day: 1,
      minute: 100,
      importance: 8,
    });
    linh.memories.push({
      id: "seed-share",
      kind: "episodic",
      subjectId: minh.id,
      text: "Mình đã kể cho Minh.",
      tags: ["shared:sunflower"],
      source: "self",
      day: 1,
      minute: 100,
      importance: 8,
    });
    let gifted = false;
    for (let i = 0; i < 500 && !gifted; i++) step(world);
    gifted = world.events.some((e) => e.type === "gift" && e.actorIds.includes("minh") && e.actorIds.includes("linh"));
    assert.equal(gifted, true, world.events.filter((e) => e.importance >= 6).map((e) => e.text).join("\n"));
    const memory = linh.memories.find((m) => m.tags.includes("gifted") && m.subjectId === "minh");
    assert.ok(memory);
    assert.match(memory!.text, /hướng dương/);
  });

  it("can fight, reconcile, and also end a relationship", () => {
    const world = createWorld(11);
    const mai = findAgent(world, "mai");
    const duc = findAgent(world, "duc");
    mai.locationId = "mall";
    duc.locationId = "mall";
    mai.travel = null;
    duc.travel = null;
    mai.activity = "shopping";
    duc.activity = "shopping";
    const rel = ensureRel(world, mai.id, duc.id);
    rel.status = "dating";
    rel.sinceDay = 0;
    directed(rel, mai.id).familiarity = 60;
    directed(rel, duc.id).familiarity = 60;
    directed(rel, mai.id).affection = 40;
    directed(rel, duc.id).affection = 40;
    directed(rel, mai.id).conflict = 72;
    directed(rel, duc.id).conflict = 70;
    directed(rel, mai.id).commitment = 20;
    directed(rel, duc.id).commitment = 18;
    directed(rel, mai.id).bond = 10;
    directed(rel, duc.id).bond = 10;
    mai.emotions.anger = 70;
    duc.emotions.anger = 64;
    mai.traits.kindness = 15;
    duc.traits.kindness = 15;
    mai.traits.temper = 90;
    duc.traits.temper = 88;
    let ended = false;
    for (let i = 0; i < 10 && !ended; i++) {
      world.pairCooldown = {};
      mai.activity = "shopping";
      duc.activity = "shopping";
      mai.busyUntil = 0;
      duc.busyUntil = 0;
      mai.locationId = "mall";
      duc.locationId = "mall";
      interact(world, mai.id, duc.id);
      ended = rel.status === "broken" || rel.status === "divorced";
    }
    assert.equal(ended, true);

    const world2 = createWorld(12);
    const ha = findAgent(world2, "ha");
    const an = findAgent(world2, "an");
    ha.locationId = "park";
    an.locationId = "park";
    ha.activity = "relaxing";
    an.activity = "relaxing";
    const rel2 = ensureRel(world2, ha.id, an.id);
    rel2.status = "friends";
    directed(rel2, ha.id).familiarity = 50;
    directed(rel2, an.id).familiarity = 50;
    directed(rel2, ha.id).conflict = 64;
    directed(rel2, an.id).conflict = 60;
    directed(rel2, ha.id).bond = 70;
    directed(rel2, an.id).bond = 68;
    directed(rel2, ha.id).affection = 55;
    directed(rel2, an.id).affection = 52;
    ha.emotions.anger = 48;
    an.emotions.anger = 20;
    ha.traits.kindness = 95;
    an.traits.kindness = 90;
    ha.traits.temper = 10;
    an.traits.temper = 10;
    let reconciled = false;
    for (let i = 0; i < 8 && !reconciled; i++) {
      world2.pairCooldown = {};
      ha.activity = "relaxing";
      an.activity = "relaxing";
      ha.busyUntil = 0;
      an.busyUntil = 0;
      const before = world2.events.length;
      interact(world2, ha.id, an.id);
      reconciled = world2.events.slice(before).some((e) => e.type === "reconcile");
    }
    assert.equal(reconciled, true);
  });
});
