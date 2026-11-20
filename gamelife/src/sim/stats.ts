import type { World } from "./types.ts";

export type CityStats = {
  population: number;
  employed: number;
  married: number;
  dating: number;
  friends: number;
  meanMoney: number;
  births: number;
  deaths: number;
};

export function worldStats(world: World): CityStats {
  const alive = world.agents.filter((agent) => agent.alive);
  const money = alive.reduce((sum, agent) => sum + agent.money, 0);
  return {
    population: alive.length,
    employed: alive.filter((agent) => agent.age >= 18 && agent.wage > 0 && !agent.retired).length,
    married: world.relationships.filter((rel) => rel.status === "married").length,
    dating: world.relationships.filter((rel) => rel.status === "dating").length,
    friends: world.relationships.filter((rel) => rel.status === "friends" || rel.status === "close").length,
    meanMoney: alive.length ? money / alive.length : 0,
    births: world.events.filter((event) => event.type === "birth").length,
    deaths: world.events.filter((event) => event.type === "death").length,
  };
}
