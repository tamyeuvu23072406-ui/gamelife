import { location } from "../data.ts";
import type { Agent, World } from "../types.ts";
import { activityLabel, statusLabel } from "../util.ts";

export type Perception = {
  placeName: string;
  hour: number;
  weather: World["weather"];
  nearby: { id: string; name: string; activity: string; known: string }[];
  boundary: string;
};

/** What this person can actually notice. Does not invent knowledge or mutate the world. */
export function perceive(world: World, agent: Agent): Perception {
  const hour = Math.floor((((world.minute % 1440) + 1440) % 1440) / 60);
  const here = agent.locationId !== "transit" && !agent.travel;
  const nearby = here
    ? world.agents.filter(
        (other) => other.alive && other.id !== agent.id && !other.travel && other.locationId === agent.locationId,
      )
    : [];
  return {
    placeName: agent.travel ? "Trên đường" : agent.locationId === "transit" ? "Trên đường" : location(agent.locationId).name,
    hour,
    weather: world.weather,
    nearby: nearby.map((other) => {
      const rel = world.relationships.find(
        (row) =>
          (row.aId === agent.id && row.bId === other.id) || (row.bId === agent.id && row.aId === other.id),
      );
      return {
        id: other.id,
        name: other.given,
        activity: activityLabel(other),
        known: rel ? statusLabel(rel.status) : "Người lạ",
      };
    }),
    boundary: "Họ không biết chuyện mình chưa chứng kiến, chưa được kể, hoặc chưa đủ manh mối để suy ra.",
  };
}
