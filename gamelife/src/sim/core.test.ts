import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agenda } from "./ai/agenda.ts";
import { explainActivity } from "./ai/explain.ts";
import { perceive } from "./ai/perceive.ts";
import { retrieveMemories, scoreMemory } from "./ai/retrieve.ts";
import { createWorld, deserialize, serialize } from "./engine.ts";
import { advanceClock, catchUp, createClock } from "./scheduler.ts";
import { onNewDay } from "./systems.ts";
import { worldStats } from "./stats.ts";
import type { Memory } from "./types.ts";
import { agent } from "./util.ts";

describe("scheduler", () => {
  it("steps once per real second at 1x, independent of how the frames are split", () => {
    const fine = createClock(1);
    const coarse = createClock(1);
    let fineSteps = 0;
    let coarseSteps = 0;
    for (let i = 0; i < 70; i++) advanceClock(fine, 1 / 60, () => fineSteps++);
    for (let i = 0; i < 12; i++) advanceClock(coarse, 0.09, () => coarseSteps++);
    assert.equal(fineSteps, 1);
    assert.equal(coarseSteps, 1);
  });

  it("pause does not advance the world", () => {
    const clock = createClock(0);
    let steps = 0;
    const result = advanceClock(clock, 2, () => steps++);
    assert.equal(steps, 0);
    assert.equal(result.steps, 0);
  });

  it("caps offline catch-up", () => {
    let steps = 0;
    assert.equal(catchUp(5000, () => steps++), 288);
    assert.equal(steps, 288);
  });
});

describe("save migration", () => {
  it("migrates a v1 payload to v2 and keeps people, money, and memories", () => {
    const world = createWorld(11);
    world.agents[0]!.needs.hunger = Number.NaN;
    const payload = JSON.parse(serialize(world)) as { version: number; rules?: unknown; agents: { needs: { hunger: number } }[] };
    payload.version = 1;
    delete payload.rules;
    const loaded = deserialize(JSON.stringify(payload));
    assert.equal(loaded.version, 2);
    assert.equal(loaded.rules.romance, true);
    assert.equal(loaded.rules.family, true);
    assert.equal(loaded.rules.economy, true);
    assert.equal(loaded.agents.length, world.agents.length);
    assert.equal(loaded.agents[0]!.needs.hunger, 40);
    assert.equal(loaded.agents[1]!.money, world.agents[1]!.money);
    assert.deepEqual(loaded.agents[2]!.memories, world.agents[2]!.memories);
    const again = deserialize(serialize(loaded));
    assert.equal(again.version, 2);
    assert.equal(again.rules.economy, true);
  });

  it("rejects an unknown save version with a readable error", () => {
    const world = createWorld(1);
    const payload = JSON.parse(serialize(world)) as { version: number };
    payload.version = 99;
    assert.throws(() => deserialize(JSON.stringify(payload)), /phiên bản/);
  });

  it("stops rent when the economy rule is off and still charges when it is on", () => {
    const off = createWorld(3);
    off.minute = 7 * 1440;
    off.rules.economy = false;
    const before = off.agents.map((person) => person.money);
    onNewDay(off);
    assert.deepEqual(
      off.agents.map((person) => person.money),
      before,
    );

    const on = createWorld(3);
    on.minute = 7 * 1440;
    const rent = on.agents[0]!.rent;
    const money = on.agents[0]!.money;
    onNewDay(on);
    assert.equal(on.agents[0]!.money, money - rent);
  });
});

describe("advanced ai read layer", () => {
  it("ranks an important old memory above a trivial new one", () => {
    const world = createWorld(1);
    const linh = agent(world, "linh");
    const old: Memory = {
      id: "old",
      kind: "episodic",
      subjectId: "minh",
      text: "Minh hứa sẽ quay lại quán.",
      tags: ["romance", "with:minh"],
      source: "witnessed",
      day: 0,
      minute: 100,
      importance: 9,
    };
    const fresh: Memory = {
      id: "new",
      kind: "episodic",
      text: "Một câu chuyện vụn trên phố.",
      tags: [],
      source: "witnessed",
      day: 4,
      minute: 4000,
      importance: 1,
    };
    linh.memories.push(old, fresh);
    const ranked = retrieveMemories(linh, 4200, { subjectId: "minh" }, 2);
    assert.equal(ranked[0]?.id, "old");
    assert.ok(scoreMemory(old, 4200, { subjectId: "minh" }) > scoreMemory(fresh, 4200, { subjectId: "minh" }));
  });

  it("does not perceive people who are somewhere else", () => {
    const world = createWorld(1);
    const linh = agent(world, "linh");
    const khoa = agent(world, "khoa");
    linh.locationId = "cafe";
    linh.travel = null;
    khoa.locationId = "hospital";
    khoa.travel = null;
    const seen = perceive(world, linh);
    assert.equal(seen.placeName, "Café Sương");
    assert.equal(
      seen.nearby.some((person) => person.id === "khoa"),
      false,
    );
    assert.match(seen.boundary, /chưa chứng kiến/);
  });

  it("gives hungry people an immediate meal goal and keeps dreams personal", () => {
    const world = createWorld(1);
    const linh = agent(world, "linh");
    const khoa = agent(world, "khoa");
    linh.needs.hunger = 90;
    const linhGoals = agenda(world, linh);
    const khoaGoals = agenda(world, khoa);
    assert.equal(linhGoals.some((goal) => goal.horizon === "now" && goal.label === "Tìm cái ăn"), true);
    assert.notEqual(
      linhGoals.find((goal) => goal.label === linh.dream)?.label,
      khoaGoals.find((goal) => goal.label === khoa.dream)?.label,
    );
  });

  it("explains sleep from the body, not from a random mood", () => {
    const world = createWorld(1);
    const ha = agent(world, "ha");
    ha.activity = "sleeping";
    ha.needs.sleepiness = 80;
    ha.travel = null;
    const why = explainActivity(world, ha);
    assert.match(why.reasons.join(" "), /ngủ|nghỉ/i);
  });
});

describe("city stats", () => {
  it("counts the starting city without inventing families", () => {
    const world = createWorld(1);
    const stats = worldStats(world);
    assert.equal(stats.population, 8);
    assert.equal(stats.married, 0);
    assert.equal(stats.births, 0);
    assert.ok(Number.isFinite(stats.meanMoney));
    assert.ok(stats.meanMoney > 0);
  });
});
