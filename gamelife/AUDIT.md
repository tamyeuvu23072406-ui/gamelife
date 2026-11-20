# SOULMATE audit

Verified against the attached source, not the preliminary notes alone.

## What was already true

- React 19, TanStack Start, Vite, Capacitor scripts, Zustand present but the live game is local React state.
- Three, React Three Fiber and Drei were declared and unused. The city was a top-down canvas.
- Simulation lived in `src/sim`: 8 people, 16 places, needs, emotions, directional relationships, memory with witnessed/told/inferred/self, work, money, weather, pregnancy, aging.
- `systems.ts` was one 1400-line module. `decide()` is already a utility scorer. It stays the authority so old behavior does not drift.
- Save version was 1, key `soulmate-save-v1`. Stepping happened inside the render `requestAnimationFrame`, but it already used an accumulator, so FPS did not directly equal tick rate.
- Dialogue is templated. No model API is required. Multiplayer files exist and are not part of this game.

## Kept

- Observe mode. The player does not walk anyone.
- Seeded RNG, relationship rules, gift memory, the 30-day regression, canvas characters, room view, synthesized ambience.
- The storage key name, so older slots are still found.

## Added in this pass

- Fixed-step `SimClock` (`src/sim/scheduler.ts`). Pause does not tick. Offline catch-up stays capped at 288 steps.
- Save v2 with v1 migration, backup before convert, import, export, restore.
- Read-only AI: perception, relevance-ranked memory, layered goals, an explanation of the current action.
- World rules that really gate new romance, conception, and money. Defaults stay on, so old stories do not change.
- Isometric 2.5D view (instanced trees, extruded buildings, day and night) and the old flat map as a fallback.
- Observe notebook: person, relationships, family, memories, timeline, city, saves.

## Not done

- `systems.ts` was not split. Moving it would risk the RNG order the regression depends on.
- No external language model. Hugging Face was available and intentionally not used: the city must run with no key.
- No authored sprite sheets, no Android APK in this environment, no 100-person stress promise.

## Order if work continues

1. Extract `decide()` scoring into a pure function without changing RNG order, then let the notebook show the rejected options.
2. Split `systems.ts` behind the same tests.
3. Stronger LOD once a device profile exists.
