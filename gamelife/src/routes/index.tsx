import { createFileRoute } from "@tanstack/react-router";
import { Cloud, CloudRain, Eye, Minus, Pause, Play, Plus, Sun, Volume2, VolumeX } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { startAmbient, type Ambient } from "@/lib/ambient";
import { CanvasMap } from "@/game/renderer/CanvasMap";
import type { Quality } from "@/game/renderer/IsoWorld";
import { ObservePanel } from "@/game/ui/ObservePanel";
import { location as locationOf } from "@/sim/data";
import { createWorld, serialize, step } from "@/sim/engine";
import { advanceClock, createClock } from "@/sim/scheduler";
import { importRaw, openSlot, readRecord, renameSlot, restoreBackup, writeRecord } from "@/sim/slots";
import type { World, WorldRules } from "@/sim/types";
import { formatClock } from "@/sim/util";

export const Route = createFileRoute("/")({ component: Home });

const IsoStage = lazy(() => import("@/game/renderer/IsoWorld").then((mod) => ({ default: mod.IsoStage })));

const SPEEDS = [0, 1, 4, 16] as const;

function Home() {
  const worldRef = useRef<World | null>(null);
  const minuteRef = useRef(7 * 60);
  const animRef = useRef(0);
  const selectedRef = useRef<string | null>(null);
  const followRef = useRef(false);
  const clockRef = useRef(createClock(1));
  const slotRef = useRef(1);
  const zoomRef = useRef(16);
  const ambientRef = useRef<Ambient | null>(null);
  const [tick, setTick] = useState(0);
  const [booted, setBooted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [slot, setSlot] = useState(1);
  const [slotName, setSlotName] = useState("Ô 1");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [quality, setQuality] = useState<Quality>("med");
  const [mode, setMode] = useState<"iso" | "flat">("iso");
  const [panel, setPanel] = useState(true);
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const opened = openSlot(slot);
      worldRef.current = opened.world;
      minuteRef.current = opened.world.minute;
      setNotice(opened.notice);
      setError(null);
    } catch (err) {
      worldRef.current = createWorld();
      setError(err instanceof Error ? err.message : "Không mở được ô lưu.");
    }
    setSlotName(readRecord(slot)?.name ?? `Ô ${slot}`);
    setBooted(true);
    setTick((value) => value + 1);
  }, [slot]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let hud = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (clockRef.current.speed > 0) animRef.current += dt;
      const world = worldRef.current;
      if (world) {
        const { alpha } = advanceClock(clockRef.current, dt, () => step(world));
        minuteRef.current = world.minute + alpha * 10;
      }
      hud += dt;
      if (hud > 0.45) {
        hud = 0;
        const hour = (((minuteRef.current / 60) % 24) + 24) % 24;
        const focus = selectedRef.current ? world?.agents.find((agent) => agent.id === selectedRef.current) : undefined;
        const indoors = !!focus && !focus.travel && focus.locationId !== "transit" && locationOf(focus.locationId).kind !== "park";
        ambientRef.current?.update(world?.weather ?? "clear", hour, indoors);
        setTick((value) => value + 1);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const persist = () => {
      if (worldRef.current) writeRecord(slotRef.current, worldRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    const timer = window.setInterval(persist, 15000);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
      ambientRef.current?.stop();
      persist();
    };
  }, []);

  const select = (id: string | null) => {
    if (id && id === selectedRef.current) {
      followRef.current = true;
      setFollow(true);
      setPanel(true);
      return;
    }
    selectedRef.current = id;
    setSelectedId(id);
    if (!id) {
      followRef.current = false;
      setFollow(false);
    } else setPanel(true);
  };

  const changeSpeed = (value: number) => {
    clockRef.current.speed = value;
    setSpeed(value);
  };

  const changeSlot = (n: number) => {
    if (worldRef.current) writeRecord(slotRef.current, worldRef.current, slotName);
    slotRef.current = n;
    select(null);
    setSlot(n);
  };

  const toggleSound = () => {
    if (ambientRef.current) {
      ambientRef.current.stop();
      ambientRef.current = null;
      setSound(false);
      return;
    }
    ambientRef.current = startAmbient();
    setSound(!!ambientRef.current);
  };

  const onNew = () => {
    const world = createWorld((Math.floor(Math.random() * 2 ** 30) ^ Date.now()) >>> 0);
    worldRef.current = world;
    minuteRef.current = world.minute;
    writeRecord(slot, world, slotName);
    select(null);
    setNotice("Một thành phố mới vừa mở mắt.");
    setError(null);
    setTick((value) => value + 1);
  };

  const onExport = () => {
    const world = worldRef.current;
    if (!world) return;
    const blob = new Blob([serialize(world)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slotName || "soulmate"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      const world = importRaw(await file.text());
      worldRef.current = world;
      minuteRef.current = world.minute;
      writeRecord(slot, world, slotName);
      setNotice("Đã nhập bản lưu.");
      setError(null);
      setTick((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không nhập được bản lưu.");
    }
  };

  const onRestore = () => {
    try {
      const world = restoreBackup(slot);
      worldRef.current = world;
      minuteRef.current = world.minute;
      setNotice("Đã khôi phục bản sao.");
      setError(null);
      setTick((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không khôi phục được.");
    }
  };

  const onRule = (key: keyof WorldRules, value: boolean) => {
    const world = worldRef.current;
    if (!world) return;
    world.rules = { ...world.rules, [key]: value };
    setTick((n) => n + 1);
  };

  const world = worldRef.current;
  const weather = world?.weather ?? "clear";
  const headline = world?.events.filter((event) => event.importance >= 5).at(-1);

  return (
    <main className="flex h-dvh flex-col bg-ink text-cream lg:flex-row">
      <section className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex flex-col gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-wide">SOULMATE</h1>
            <p className="text-sm text-mute">{world ? formatClock(world.minute) : "Đang mở thành phố…"}</p>
            <p className="flex items-center gap-1 text-sm">
              {weather === "rain" ? <CloudRain className="size-4" /> : weather === "cloudy" ? <Cloud className="size-4" /> : <Sun className="size-4" />}
              {weather === "rain" ? "Mưa" : weather === "cloudy" ? "Nhiều mây" : "Nắng"}
            </p>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {SPEEDS.map((value) => (
              <button key={value} type="button" onClick={() => changeSpeed(value)} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm ${speed === value ? "bg-ember text-ember-ink" : "bg-panel text-cream"}`}>
                {value === 0 ? <Pause className="size-4" /> : <Play className="size-4" />}
                {value === 0 ? "Dừng" : `${value}×`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if (!selectedId) return;
                followRef.current = !followRef.current;
                setFollow(followRef.current);
              }}
              className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm ${follow ? "bg-gold text-ink" : "bg-panel"}`}
            >
              <Eye className="size-4" />
              Theo dõi
            </button>
            <button type="button" onClick={() => setMode(mode === "iso" ? "flat" : "iso")} className="min-h-11 rounded-lg bg-panel px-3 text-sm">
              {mode === "iso" ? "Phẳng" : "2.5D"}
            </button>
            <button
              type="button"
              onClick={() => setQuality(quality === "low" ? "med" : quality === "med" ? "high" : "low")}
              className="min-h-11 rounded-lg bg-panel px-3 text-sm"
            >
              {quality === "low" ? "Thấp" : quality === "med" ? "Vừa" : "Cao"}
            </button>
            <button type="button" onClick={toggleSound} className={`inline-flex size-11 items-center justify-center rounded-lg ${sound ? "bg-ember text-ember-ink" : "bg-panel"}`} aria-label={sound ? "Tắt âm" : "Bật âm"}>
              {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
            <button type="button" onClick={() => setPanel((open) => !open)} className="min-h-11 rounded-lg bg-panel px-3 text-sm">
              {panel ? "Ẩn sổ" : "Sổ tay"}
            </button>
          </div>
        </header>
        <div className="world-stage relative min-h-0 flex-1">
          {booted && mode === "flat" ? (
            <CanvasMap worldRef={worldRef} minuteRef={minuteRef} animRef={animRef} selectedRef={selectedRef} onSelect={select} />
          ) : null}
          {booted && mode === "iso" ? (
            <Suspense fallback={<p className="p-6 text-mute">Đang dựng phố…</p>}>
              <IsoStage
                worldRef={worldRef}
                minuteRef={minuteRef}
                animRef={animRef}
                selectedRef={selectedRef}
                followRef={followRef}
                zoomRef={zoomRef}
                quality={quality}
                revision={tick}
                onSelect={select}
                onReleaseFollow={() => setFollow(false)}
              />
            </Suspense>
          ) : null}
          {mode === "iso" ? (
            <div className="absolute bottom-3 left-3 z-10 flex gap-2">
              <button type="button" aria-label="Thu nhỏ" onClick={() => { zoomRef.current = Math.max(9, zoomRef.current * 0.86); }} className="inline-flex size-11 items-center justify-center rounded-lg bg-panel">
                <Minus className="size-4" />
              </button>
              <button type="button" aria-label="Phóng to" onClick={() => { zoomRef.current = Math.min(38, zoomRef.current * 1.16); }} className="inline-flex size-11 items-center justify-center rounded-lg bg-panel">
                <Plus className="size-4" />
              </button>
            </div>
          ) : null}
          {headline ? <p className="pointer-events-none absolute right-3 bottom-3 left-28 z-10 line-clamp-2 rounded-lg bg-panel/90 px-3 py-2 text-sm">{headline.text}</p> : null}
        </div>
      </section>
      {panel ? (
        <ObservePanel
          world={booted ? world : null}
          worldRef={worldRef}
          minuteRef={minuteRef}
          animRef={animRef}
          selectedId={selectedId}
          onSelect={select}
          slot={slot}
          slotName={slotName}
          notice={notice}
          error={error}
          onSlot={changeSlot}
          onRename={(name) => {
            setSlotName(name);
            renameSlot(slot, name);
          }}
          onNew={onNew}
          onExport={onExport}
          onImport={(file) => void onImport(file)}
          onRestore={onRestore}
          onSave={() => {
            if (worldRef.current) {
              writeRecord(slot, worldRef.current, slotName);
              setNotice("Đã lưu ô này.");
            }
          }}
          onRule={onRule}
        />
      ) : null}
    </main>
  );
}
