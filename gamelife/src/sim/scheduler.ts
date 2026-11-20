/** Fixed-step clock. Rendering may call this; it never draws. */
export const STEP_SECONDS = 1;
export const MAX_STEPS_PER_FRAME = 24;
export const MAX_CATCHUP_STEPS = 288;

export type SimClock = {
  acc: number;
  speed: number;
};

export function createClock(speed = 1): SimClock {
  return { acc: 0, speed };
}

export function advanceClock(
  clock: SimClock,
  dtSeconds: number,
  step: () => void,
): { steps: number; alpha: number } {
  if (clock.speed <= 0) {
    return { steps: 0, alpha: Math.min(1, clock.acc / STEP_SECONDS) };
  }
  const dt = Math.min(0.1, Math.max(0, dtSeconds));
  clock.acc += dt * clock.speed;
  let steps = 0;
  while (clock.acc >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
    step();
    clock.acc -= STEP_SECONDS;
    steps += 1;
  }
  if (steps === MAX_STEPS_PER_FRAME) clock.acc = Math.min(clock.acc, STEP_SECONDS);
  return { steps, alpha: Math.min(1, clock.acc / STEP_SECONDS) };
}

export function catchUp(steps: number, step: () => void, cap = MAX_CATCHUP_STEPS): number {
  const n = Math.max(0, Math.min(cap, Math.floor(steps)));
  for (let i = 0; i < n; i++) step();
  return n;
}
