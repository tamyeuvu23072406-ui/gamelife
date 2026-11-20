import { location } from "../data.ts";
import type { Agent, World } from "../types.ts";
import { activityLabel } from "../util.ts";

export type Explanation = { title: string; reasons: string[] };

function place(id: string | undefined): string {
  if (!id || id === "transit") return "phố";
  return location(id).name;
}

/** Why the current action is plausible. Does not roll a new decision. */
export function explainActivity(world: World, agent: Agent): Explanation {
  const reasons: string[] = [];
  const hour = Math.floor((((world.minute % 1440) + 1440) % 1440) / 60);
  if (agent.travel) {
    reasons.push(`Đang di chuyển tới ${place(agent.travel.destId)}.`);
    reasons.push(`Khi tới nơi họ sẽ ${activityLabel({ ...agent, activity: agent.travel.arriveActivity })}.`);
  }
  if (agent.activity === "sleeping" || (hour >= 23 || hour < 6)) {
    if (agent.activity === "sleeping") {
      reasons.push(agent.needs.sleepiness > 55 ? "Buồn ngủ còn cao." : "Đã vào giờ nghỉ, họ không bị gọi dậy.");
    }
  }
  if (agent.activity === "working") {
    reasons.push(`Ca làm của ${agent.job} tại ${place(agent.workplaceId)}.`);
    if (world.rules?.economy !== false) reasons.push(`Ngày công khoảng ${agent.wage}.`);
  }
  if (agent.activity === "eating") reasons.push("Cơn đói đủ lớn, hoặc đã tới bữa trong lịch.");
  if (agent.activity === "drinking") reasons.push("Khát đang được giải quyết, không phải một cuộc hẹn.");
  if (agent.activity === "treatment") reasons.push("Sức khỏe xuống thấp nên họ tự vào viện.");
  if (agent.activity === "seeking" && agent.seekTargetId) {
    const who = world.agents.find((other) => other.id === agent.seekTargetId);
    reasons.push(who ? `Muốn gặp ${who.given} vì tình cảm và ký ức, không phải vì bị điều khiển.` : "Đang tìm một người.");
  }
  if (agent.activity === "shopping" && agent.holdingGift) {
    const who = world.agents.find((other) => other.id === agent.holdingGift?.forId);
    reasons.push(`Đang giữ quà${who ? ` cho ${who.given}` : ""}, vì họ nhớ một điều đã được kể.`);
  }
  if (agent.traits.extroversion < 36 && (agent.activity === "idle" || agent.activity === "relaxing")) {
    reasons.push("Tính hướng nội khiến chỗ yên có điểm cao hơn chỗ đông.");
  }
  if (agent.money < 80 && world.rules?.economy !== false && agent.activity !== "working") {
    reasons.push("Ví mỏng nên những chỗ tốn kém bị trừ điểm.");
  }
  if (agent.emotions.anger > 55) reasons.push("Đang tức, nên dễ cự lại hơn là làm lành.");
  if (agent.emotions.loneliness > 60 && agent.activity !== "sleeping") reasons.push("Cô đơn đang kéo họ về phía người khác.");
  if (!reasons.length) reasons.push(agent.lastThought);
  return { title: activityLabel(agent), reasons };
}
