import { goalsOf, shiftOf } from "../systems.ts";
import type { Agent, World } from "../types.ts";

export type Goal = {
  horizon: "now" | "today" | "soon" | "dream";
  label: string;
  because: string;
  weight: number;
};

const HORIZON: Record<Goal["horizon"], string> = {
  now: "Ngay lúc này",
  today: "Hôm nay",
  soon: "Sắp tới",
  dream: "Dài hạn",
};

export function horizonLabel(horizon: Goal["horizon"]): string {
  return HORIZON[horizon];
}

/** Layered goals. Read-only: the live choice still happens inside decide(). */
export function agenda(world: World, agent: Agent): Goal[] {
  if (!agent.alive) {
    return [{ horizon: "dream", label: "Đã khuất", because: "Người này không còn trong nhịp sống.", weight: 0 }];
  }
  const goals: Goal[] = [];
  if (agent.needs.health < 40) {
    goals.push({
      horizon: "now",
      label: "Chăm sóc sức khỏe",
      because: "Sức khỏe xuống thấp hơn mức an toàn.",
      weight: 120 - agent.needs.health,
    });
  }
  if (agent.needs.sleepiness > 72) {
    goals.push({ horizon: "now", label: "Đi ngủ", because: "Buồn ngủ đang lấn các nhu cầu khác.", weight: agent.needs.sleepiness });
  }
  if (agent.needs.hunger > 68) {
    goals.push({ horizon: "now", label: "Tìm cái ăn", because: "Đói đã đủ mạnh để ngắt lịch.", weight: agent.needs.hunger });
  }
  if (agent.needs.thirst > 74) {
    goals.push({ horizon: "now", label: "Uống nước", because: "Khát vượt ngưỡng chịu đựng.", weight: agent.needs.thirst });
  }
  const shift = shiftOf(agent, world);
  if (shift && !agent.retired) {
    goals.push({
      horizon: "today",
      label: `Giữ ca ${agent.job}`,
      because: `Có mặt tại nơi làm, lương ngày ${agent.wage}.`,
      weight: 58,
    });
  } else {
    goals.push({
      horizon: "today",
      label: agent.retired ? "Ngày nghỉ hưu" : "Ngày không ca",
      because: agent.retired ? "Không còn lịch làm." : "Hôm nay lịch không buộc họ đến nơi làm.",
      weight: 36,
    });
  }
  if (agent.needs.social > 58) {
    goals.push({
      horizon: "today",
      label: agent.traits.extroversion > 60 ? "Tìm chỗ đông người" : "Gặp một người quen",
      because: "Nhu cầu giao tiếp đang cao, tính cách quyết định họ tìm đám đông hay một người.",
      weight: agent.needs.social * (0.45 + agent.traits.extroversion / 200),
    });
  }
  if (agent.money < 180 && world.rules?.economy !== false) {
    goals.push({
      horizon: "soon",
      label: "Giữ tiền cho tiền nhà",
      because: "Ví mỏng làm họ né chỗ tốn kém.",
      weight: 70,
    });
  }
  for (const [index, goal] of goalsOf(world, agent).entries()) {
    goals.push({
      horizon: index === 0 ? "soon" : "dream",
      label: goal.label,
      because:
        goal.label === agent.dream
          ? "Đây là ước muốn riêng, không phải mục tiêu chung của cả thành phố."
          : "Cân từ tiền bạc, tình cảm và tính cách hiện có.",
      weight: goal.weight,
    });
  }
  return goals.sort((a, b) => b.weight - a.weight);
}
