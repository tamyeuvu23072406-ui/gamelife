import { SAVE_KEY, createWorld, deserialize, serialize, step } from "./engine.ts";
import { MAX_CATCHUP_STEPS, catchUp } from "./scheduler.ts";
import type { World } from "./types.ts";

export type SlotRecord = { t: number; name: string; raw: string; backup?: string };

const slotKey = (n: number) => `${SAVE_KEY}-slot${n}`;
const backupKey = (n: number) => `${SAVE_KEY}-slot${n}-v1backup`;

export function readRecord(n: number): SlotRecord | null {
  try {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SlotRecord>;
    if (typeof parsed.raw !== "string") return null;
    return {
      t: typeof parsed.t === "number" ? parsed.t : Date.now(),
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : `Ô ${n}`,
      raw: parsed.raw,
      backup: typeof parsed.backup === "string" ? parsed.backup : undefined,
    };
  } catch {
    return null;
  }
}

export function writeRecord(n: number, world: World, name?: string) {
  const prev = readRecord(n);
  const rec: SlotRecord = {
    t: Date.now(),
    name: (name ?? prev?.name ?? `Ô ${n}`).slice(0, 32),
    raw: serialize(world),
    backup: prev?.backup,
  };
  localStorage.setItem(slotKey(n), JSON.stringify(rec));
}

export function renameSlot(n: number, name: string) {
  const prev = readRecord(n);
  if (!prev) return;
  prev.name = name.trim().slice(0, 32) || `Ô ${n}`;
  localStorage.setItem(slotKey(n), JSON.stringify(prev));
}

export function openSlot(n: number): { world: World; notice: string | null } {
  const rec = readRecord(n);
  if (!rec) return { world: createWorld(), notice: null };
  let version = 0;
  try {
    version = Number((JSON.parse(rec.raw) as { version?: number }).version);
  } catch {
    throw new Error("Bản lưu không đọc được.");
  }
  if (version === 1) {
    localStorage.setItem(backupKey(n), rec.raw);
    localStorage.setItem(slotKey(n), JSON.stringify({ ...rec, backup: rec.raw }));
  }
  const world = deserialize(rec.raw);
  const away = Math.max(0, Math.min(MAX_CATCHUP_STEPS, Math.floor((Date.now() - rec.t) / 1000)));
  const stepped = catchUp(away, () => step(world));
  const notice = [
    version === 1 ? "Đã nâng bản lưu cũ lên phiên bản 2. Bản sao gốc vẫn được giữ." : "",
    stepped > 0 ? `Thành phố đã tự sống ${stepped} nhịp lúc bạn không xem.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { world, notice: notice || null };
}

export function restoreBackup(n: number): World {
  const raw = localStorage.getItem(backupKey(n)) ?? readRecord(n)?.backup;
  if (!raw) throw new Error("Không có bản sao để khôi phục.");
  return deserialize(raw);
}

export function importRaw(raw: string): World {
  return deserialize(raw);
}
