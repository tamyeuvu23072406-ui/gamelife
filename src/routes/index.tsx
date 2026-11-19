import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { startAmbient, type Ambient } from "@/lib/ambient";
import { drawRoom } from "@/lib/room";
import { LOCATIONS, MAP, ROADS_X, ROADS_Z, location as locationOf } from "@/sim/data";
import { SAVE_KEY, createWorld, deserialize, serialize, step } from "@/sim/engine";
import { drawAgent } from "@/lib/agent-sprite";
import { agentFacing, agentPosition } from "@/sim/path";
import type { Agent, World } from "@/sim/types";
import { activityLabel, dominantEmotion, formatClock } from "@/sim/util";

export const Route = createFileRoute("/")({ component: Home });

const WEATHER = { clear: "☀️ Nắng", cloudy: "☁️ Nhiều mây", rain: "🌧️ Mưa" } as const;
const NEEDS: [keyof Agent["needs"], string][] = [
  ["hunger", "Đói"],
  ["thirst", "Khát"],
  ["sleepiness", "Buồn ngủ"],
  ["fun", "Giải trí"],
  ["social", "Giao tiếp"],
  ["affection", "Tình cảm"],
  ["safety", "Bất an"],
  ["health", "Sức khỏe"],
];
const MAX_CATCHUP_STEPS = 288; // ~2 game days of "life while you were away"

const slotKey = (n: number) => `${SAVE_KEY}-slot${n}`;

function save(w: World, n: number) {
  try {
    localStorage.setItem(slotKey(n), JSON.stringify({ t: Date.now(), raw: serialize(w) }));
  } catch {
    /* storage full or blocked: keep playing, retry on next autosave */
  }
}

function load(n: number): World | null {
  try {
    const s = localStorage.getItem(slotKey(n));
    if (!s) return null;
    const { t, raw } = JSON.parse(s) as { t: number; raw: string };
    const w = deserialize(raw);
    const away = Math.max(0, Math.min(MAX_CATCHUP_STEPS, Math.floor((Date.now() - t) / 1000)));
    for (let i = 0; i < away; i++) step(w);
    return w;
  } catch {
    return null;
  }
}

function geom(W: number, H: number) {
  const sc = Math.min(W / (MAP.maxX - MAP.minX), H / (MAP.maxZ - MAP.minZ));
  return {
    sc,
    ox: (W - (MAP.maxX - MAP.minX) * sc) / 2 - MAP.minX * sc,
    oz: (H - (MAP.maxZ - MAP.minZ) * sc) / 2 - MAP.minZ * sc,
  };
}

function draw(ctx: CanvasRenderingContext2D, w: World, W: number, H: number, minute: number, sel: string | null, t: number) {
  const { sc, ox, oz } = geom(W, H);
  const X = (x: number) => ox + x * sc;
  const Z = (z: number) => oz + z * sc;
  ctx.fillStyle = "#9fc79a";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#6b6f76";
  ctx.lineWidth = 2.2 * sc;
  for (const x of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(X(x), Z(MAP.minZ));
    ctx.lineTo(X(x), Z(MAP.maxZ));
    ctx.stroke();
  }
  for (const z of ROADS_Z) {
    ctx.beginPath();
    ctx.moveTo(X(MAP.minX), Z(z));
    ctx.lineTo(X(MAP.maxX), Z(z));
    ctx.stroke();
  }
  ctx.font = `${Math.max(9, 1.5 * sc)}px sans-serif`;
  ctx.textAlign = "center";
  for (const l of LOCATIONS) {
    const b = l.build;
    if (b) {
      ctx.fillStyle = b.wall;
      ctx.fillRect(X(l.x + b.ox), Z(l.z + b.oz), b.w * sc, b.d * sc);
      ctx.fillStyle = b.roof;
      ctx.fillRect(X(l.x + b.ox), Z(l.z + b.oz), b.w * sc, b.d * sc * 0.35);
    } else {
      ctx.fillStyle = "#5f9f5b";
      ctx.beginPath();
      ctx.arc(X(l.x), Z(l.z), l.gather * sc * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1e293b";
    ctx.fillText(l.name, X(l.x), Z(l.z) - 1.2 * sc);
  }
  const hour = (minute / 60) % 24;
  const dark = hour >= 20 || hour < 5 ? 0.45 : hour >= 18 ? ((hour - 18) / 2) * 0.45 : hour < 7 ? ((7 - hour) / 2) * 0.45 : 0;
  if (dark > 0 || w.weather !== "clear") {
    ctx.fillStyle = w.weather === "clear" ? `rgba(10,15,45,${dark})` : `rgba(60,70,95,${Math.max(dark, 0.2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (w.weather === "rain") {
    ctx.strokeStyle = "rgba(190,210,255,.6)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = (i * 97 + minute * 29) % W;
      const y = (i * 53 + minute * 61) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 9);
      ctx.stroke();
    }
  }
  const talking = new Set(w.lines.slice(-8).filter((ln) => w.minute - ln.minute <= 20).map((ln) => ln.speakerId));
  const crowd = w.agents.filter((a) => a.alive).map((a) => ({ a, p: agentPosition(a, minute) })).sort((m, n) => m.p.z - n.p.z);
  for (const { a, p } of crowd) {
    const f = agentFacing(a, minute);
    const moving = !!a.travel && minute >= a.travel.startMinute && minute < a.travel.endMinute;
    if (a.id === sel) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(X(p.x), Z(p.z), 1.1 * sc, 0.45 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawAgent(ctx, a, X(p.x), Z(p.z), sc, { t, moving, fx: f.x, fz: f.z, speaking: talking.has(a.id), mood: dominantEmotion(a.emotions), rain: w.weather === "rain" && moving });
    ctx.fillStyle = "#0f172a";
    ctx.fillText(a.given, X(p.x), Z(p.z) + 1.4 * sc);
  }
  for (const ln of w.lines.slice(-8)) {
    if (w.minute - ln.minute > 20) continue;
    const s = w.agents.find((a) => a.id === ln.speakerId);
    if (!s) continue;
    const p = agentPosition(s, minute);
    const text = ln.text.length > 38 ? `${ln.text.slice(0, 37)}…` : ln.text;
    const tw = ctx.measureText(text).width + 10;
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillRect(X(p.x) - tw / 2, Z(p.z) - 5.4 * sc, tw, 1.9 * sc + 4);
    ctx.fillStyle = "#0f172a";
    ctx.fillText(text, X(p.x), Z(p.z) - 3.8 * sc);
  }
}

function fit(c: HTMLCanvasElement) {
  const d = window.devicePixelRatio || 1;
  const W = c.clientWidth;
  const H = c.clientHeight;
  if (c.width !== Math.round(W * d) || c.height !== Math.round(H * d)) {
    c.width = Math.round(W * d);
    c.height = Math.round(H * d);
  }
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  return { ctx, W, H };
}

function Bar({ label, v, good }: { label: string; v: number; good?: boolean }) {
  const bad = good ? v < 35 : v > 70;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-400">{label}</span>
      <div className="h-2 flex-1 rounded bg-slate-800">
        <div className={`h-2 rounded ${bad ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.round(v)}%` }} />
      </div>
    </div>
  );
}

function Home() {
  const worldRef = useRef<World | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(1);
  const selRef = useRef<string | null>(null);
  const slotRef = useRef(1);
  const animRef = useRef(0);
  const roomRef = useRef<HTMLCanvasElement>(null);
  const portraitRef = useRef<HTMLCanvasElement>(null);
  const ambientRef = useRef<Ambient | null>(null);
  const [sound, setSound] = useState(false);
  const [, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [slot, setSlot] = useState(1);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    worldRef.current = load(slot) ?? createWorld();
    setTick((t) => t + 1);
  }, [slot]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hud = 0;
    const frame = (now: number) => {
      const w = worldRef.current;
      const c = canvasRef.current;
      const box = boxRef.current;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      animRef.current += speedRef.current > 0 ? dt : 0;
      if (w && c && box) {
        acc += dt * speedRef.current;
        let n = 0;
        while (acc >= 1 && n < 40) {
          step(w);
          acc -= 1;
          n++;
        }
        if (n === 40) acc = 0;
        const dpr = window.devicePixelRatio || 1;
        const W = box.clientWidth;
        const H = box.clientHeight;
        if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
          c.width = Math.round(W * dpr);
          c.height = Math.round(H * dpr);
        }
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          draw(ctx, w, W, H, w.minute + acc * 10, selRef.current, animRef.current);
        }
        const sa = selRef.current ? w.agents.find((x) => x.id === selRef.current) : undefined;
        const rc = roomRef.current ? fit(roomRef.current) : null;
        if (rc && sa) {
          if (sa.travel) {
            rc.ctx.fillStyle = "#0f172a";
            rc.ctx.fillRect(0, 0, rc.W, rc.H);
            rc.ctx.fillStyle = "#94a3b8";
            rc.ctx.font = "13px sans-serif";
            rc.ctx.textAlign = "center";
            rc.ctx.fillText("Đang trên đường…", rc.W / 2, rc.H / 2);
          } else drawRoom(rc.ctx, rc.W, rc.H, w, locationOf(sa.locationId), animRef.current, sa.id);
        }
        const pt = portraitRef.current ? fit(portraitRef.current) : null;
        if (pt && sa) {
          pt.ctx.fillStyle = "#1e293b";
          pt.ctx.fillRect(0, 0, pt.W, pt.H);
          drawAgent(pt.ctx, sa, pt.W / 2, pt.H * 1.22, pt.H * 0.3, { t: animRef.current, moving: false, fx: 0, fz: 1, speaking: false, mood: dominantEmotion(sa.emotions), badge: false });
        }
        hud += dt;
        if (hud > 0.4) {
          hud = 0;
          ambientRef.current?.update(w.weather, (w.minute / 60) % 24, !!sa && !sa.travel && locationOf(sa.locationId).kind !== "park");
          setTick((t) => t + 1);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const persist = () => {
      if (worldRef.current) save(worldRef.current, slotRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    const iv = setInterval(persist, 15000);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
      ambientRef.current?.stop();
      persist();
    };
  }, []);

  const pick = (id: string | null) => {
    selRef.current = id;
    setSel(id);
  };
  const setSpeedBoth = (s: number) => {
    speedRef.current = s;
    setSpeed(s);
  };
  const onPick = (e: PointerEvent<HTMLCanvasElement>) => {
    const w = worldRef.current;
    const c = canvasRef.current;
    if (!w || !c) return;
    const r = c.getBoundingClientRect();
    const { sc, ox, oz } = geom(r.width, r.height);
    const wx = (e.clientX - r.left - ox) / sc;
    const wz = (e.clientY - r.top - oz) / sc;
    let best: string | null = null;
    let bd = 16;
    for (const a of w.agents) {
      if (!a.alive) continue;
      const p = agentPosition(a, w.minute);
      const d = (p.x - wx) ** 2 + (p.z - wz) ** 2;
      if (d < bd) {
        bd = d;
        best = a.id;
      }
    }
    pick(best);
  };
  const changeSlot = (n: number) => {
    if (worldRef.current) save(worldRef.current, slotRef.current);
    slotRef.current = n;
    pick(null);
    setSlot(n);
  };
  const toggleSound = () => {
    if (ambientRef.current) {
      ambientRef.current.stop();
      ambientRef.current = null;
      setSound(false);
    } else {
      ambientRef.current = startAmbient();
      setSound(!!ambientRef.current);
    }
  };
  const newWorld = () => {
    worldRef.current = createWorld(Math.floor(Math.random() * 2 ** 31));
    pick(null);
    setTick((t) => t + 1);
  };

  const w = worldRef.current;
  const a = w?.agents.find((x) => x.id === sel) ?? null;
  const activeRel = a ? w?.relationships.find((r) => (r.aId === a.id || r.bId === a.id) && (r.status === "dating" || r.status === "married")) : undefined;
  const spouseOrPartnerId = activeRel ? (activeRel.aId === a?.id ? activeRel.bId : activeRel.aId) : a?.partnerId;
  const partner = spouseOrPartnerId ? w?.agents.find((x) => x.id === spouseOrPartnerId) : undefined;
  const isMarried = activeRel?.status === "married";
  const childrenNames = a?.childrenIds.map((cid) => w?.agents.find((x) => x.id === cid)?.given).filter(Boolean).join(", ");
  const btn = "rounded-md px-3 py-1.5 text-sm font-medium";

  return (
    <main className="flex h-dvh flex-col bg-slate-950 text-slate-100 lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 p-2 text-sm">
          <b>{w ? formatClock(w.minute) : "Đang tải thế giới…"}</b>
          <span>{w ? WEATHER[w.weather] : ""}</span>
          <span className="ml-auto flex flex-wrap gap-1">
            {[0, 1, 4, 16].map((s) => (
              <button key={s} onClick={() => setSpeedBoth(s)} className={`${btn} ${speed === s ? "bg-sky-600" : "bg-slate-800"}`}>
                {s === 0 ? "⏸" : `${s}x`}
              </button>
            ))}
            <select value={slot} onChange={(e) => changeSlot(Number(e.target.value))} className={`${btn} bg-slate-800`}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  Ô lưu {n}
                </option>
              ))}
            </select>
            <button onClick={newWorld} className={`${btn} bg-slate-800`}>
              Thế giới mới
            </button>
            <button onClick={toggleSound} className={`${btn} ${sound ? "bg-sky-600" : "bg-slate-800"}`} aria-label="Âm thanh">
              {sound ? "🔊" : "🔇"}
            </button>
          </span>
        </header>
        <div ref={boxRef} className="relative min-h-0 flex-1">
          <canvas ref={canvasRef} onPointerDown={onPick} className="absolute inset-0 size-full touch-none" />
        </div>
      </section>
      <aside className="max-h-[42dvh] space-y-3 overflow-y-auto border-t border-slate-800 p-3 text-sm lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">
        <div className="flex flex-wrap gap-1">
          {w?.agents.filter((x) => x.alive).map((x) => (
            <button key={x.id} onClick={() => pick(x.id)} className={`${btn} ${x.id === sel ? "bg-amber-500 text-slate-900" : "bg-slate-800"}`}>
              {x.given}
            </button>
          ))}
        </div>
        {a ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <canvas ref={portraitRef} className="size-22 shrink-0 rounded-lg" />
              <h2 className="text-base font-semibold">
                {a.name} · {a.age} tuổi · {a.job}
              </h2>
            </div>
            <canvas ref={roomRef} className="h-44 w-full rounded-lg" />
            <p className="text-slate-300">
              {activityLabel(a)} · {dominantEmotion(a.emotions).label} · {Math.round(a.money).toLocaleString("vi-VN")}đ
              {partner ? ` · ${isMarried ? "Vợ/Chồng" : "Người yêu"}: ${partner.given}` : ""}{a.pregnantWithId ? ` · 🤰 Mang thai (${a.pregnancyDays}/9 ngày)` : ""}{childrenNames ? ` · 👶 Con: ${childrenNames}` : ""}
            </p>
            <p className="italic text-slate-400">“{a.lastThought}”</p>
            {NEEDS.map(([k, label]) => (
              <Bar key={k} label={label} v={a.needs[k]} good={k === "health"} />
            ))}
          </div>
        ) : (
          <p className="text-slate-400">Chạm vào một nhân vật trên bản đồ để xem nhu cầu, cảm xúc và suy nghĩ của họ.</p>
        )}
        <div className="space-y-1 border-t border-slate-800 pt-2">
          <h3 className="font-semibold">Nhật ký thế giới</h3>
          {w?.events
            .slice(-8)
            .reverse()
            .map((ev) => (
              <p key={ev.id} className="text-xs text-slate-300">
                <span className="text-slate-500">
                  {String(ev.hour).padStart(2, "0")}:{String(ev.min).padStart(2, "0")}
                </span>{" "}
                {ev.text}
              </p>
            ))}
        </div>
      </aside>
    </main>
  );
}
