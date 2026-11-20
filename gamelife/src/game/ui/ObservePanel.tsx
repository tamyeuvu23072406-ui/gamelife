import { useEffect, useState } from "react";
import { drawAgent } from "@/lib/agent-sprite";
import { drawRoom } from "@/lib/room";
import { agenda, horizonLabel } from "@/sim/ai/agenda";
import { explainActivity } from "@/sim/ai/explain";
import { perceive } from "@/sim/ai/perceive";
import { retrieveMemories } from "@/sim/ai/retrieve";
import { location as locationOf } from "@/sim/data";
import { worldStats } from "@/sim/stats";
import type { Agent, Memory, World, WorldRules } from "@/sim/types";
import { activityLabel, dominantEmotion, emotionLabel, lifeStage, sourceLabel, statusLabel, traitWords } from "@/sim/util";
import type { EmotionKey } from "@/sim/types";
import { fitCanvas } from "@/game/renderer/canvas2d";

type Tab = "life" | "bond" | "tree" | "memory" | "time" | "city" | "save";

const TABS: { id: Tab; label: string }[] = [
  { id: "life", label: "Người" },
  { id: "bond", label: "Quan hệ" },
  { id: "tree", label: "Gia phả" },
  { id: "memory", label: "Ký ức" },
  { id: "time", label: "Dòng thời gian" },
  { id: "city", label: "Thành phố" },
  { id: "save", label: "Lưu" },
];

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

type Props = {
  world: World | null;
  worldRef: { current: World | null };
  minuteRef: { current: number };
  animRef: { current: number };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  slot: number;
  slotName: string;
  notice: string | null;
  error: string | null;
  onSlot: (n: number) => void;
  onRename: (name: string) => void;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onRestore: () => void;
  onSave: () => void;
  onRule: (key: keyof WorldRules, value: boolean) => void;
};

function Bar({ label, value, good }: { label: string; value: number; good?: boolean }) {
  const warn = good ? value < 35 : value > 70;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-mute">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-ink">
        <div className={`h-2 rounded-full ${warn ? "bg-danger" : "bg-leaf"}`} style={{ width: `${Math.round(value)}%` }} />
      </div>
    </div>
  );
}

function Portrait({ worldRef, animRef, agentId }: { worldRef: Props["worldRef"]; animRef: Props["animRef"]; agentId: string }) {
  const [node, setNode] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!node) return;
    let frame = 0;
    const loop = () => {
      const world = worldRef.current;
      const person = world?.agents.find((agent) => agent.id === agentId);
      const fitted = fitCanvas(node);
      if (fitted && world && person) {
        fitted.ctx.fillStyle = "#2c251f";
        fitted.ctx.fillRect(0, 0, fitted.width, fitted.height);
        drawAgent(fitted.ctx, person, fitted.width / 2, fitted.height * 1.18, fitted.height * 0.28, {
          t: animRef.current,
          moving: false,
          fx: 0,
          fz: 1,
          speaking: false,
          mood: dominantEmotion(person.emotions),
          badge: false,
        });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [agentId, animRef, node, worldRef]);
  return <canvas ref={setNode} className="h-24 w-24 shrink-0 rounded-lg bg-panel-2" />;
}

function RoomView({ worldRef, animRef, agentId }: { worldRef: Props["worldRef"]; animRef: Props["animRef"]; agentId: string }) {
  const [node, setNode] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!node) return;
    let frame = 0;
    const loop = () => {
      const world = worldRef.current;
      const person = world?.agents.find((agent) => agent.id === agentId);
      const fitted = fitCanvas(node);
      if (fitted && world && person) {
        if (person.travel || person.locationId === "transit") {
          fitted.ctx.fillStyle = "#221c17";
          fitted.ctx.fillRect(0, 0, fitted.width, fitted.height);
          fitted.ctx.fillStyle = "#b3a494";
          fitted.ctx.font = "13px sans-serif";
          fitted.ctx.textAlign = "center";
          fitted.ctx.fillText("Đang trên đường", fitted.width / 2, fitted.height / 2);
        } else {
          drawRoom(fitted.ctx, fitted.width, fitted.height, world, locationOf(person.locationId), animRef.current, person.id);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [agentId, animRef, node, worldRef]);
  return <canvas ref={setNode} className="h-36 w-full rounded-lg bg-panel-2" />;
}

function personById(world: World, id: string | undefined) {
  return id ? world.agents.find((agent) => agent.id === id) : undefined;
}

export function ObservePanel(props: Props) {
  const [tab, setTab] = useState<Tab>("life");
  const [kind, setKind] = useState<Memory["kind"] | "all">("all");
  const [source, setSource] = useState<Memory["source"] | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const world = props.world;
  const person = world?.agents.find((agent) => agent.id === props.selectedId) ?? null;

  return (
    <aside className="flex h-[40dvh] min-h-0 flex-col border-t border-line bg-panel lg:h-dvh lg:w-96 lg:border-l lg:border-t-0">
      <div className="flex gap-1 overflow-x-auto px-2 py-2">
        {world?.agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => props.onSelect(agent.id)}
            className={`min-h-11 shrink-0 rounded-full px-3 text-sm ${agent.id === props.selectedId ? "bg-ember text-ember-ink" : "bg-panel-2 text-cream"} ${agent.alive ? "" : "opacity-50"}`}
          >
            {agent.given}
          </button>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto px-2 pb-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-11 shrink-0 rounded-lg px-3 text-sm ${tab === item.id ? "bg-cream text-ink" : "text-mute"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-4 text-sm">
        {props.error ? <p className="rounded-lg bg-danger px-3 py-2 text-cream">{props.error}</p> : null}
        {props.notice ? <p className="rounded-lg bg-panel-2 px-3 py-2 text-gold">{props.notice}</p> : null}
        {tab === "life" ? <LifeTab world={world} person={person} worldRef={props.worldRef} animRef={props.animRef} /> : null}
        {tab === "bond" ? <BondTab world={world} person={person} onSelect={props.onSelect} /> : null}
        {tab === "tree" ? <TreeTab world={world} person={person} onSelect={props.onSelect} /> : null}
        {tab === "memory" ? (
          <MemoryTab world={world} person={person} kind={kind} source={source} onKind={setKind} onSource={setSource} />
        ) : null}
        {tab === "time" ? <TimeTab world={world} person={person} onlyMine={onlyMine} onOnlyMine={setOnlyMine} /> : null}
        {tab === "city" ? <CityTab world={world} onRule={props.onRule} /> : null}
        {tab === "save" ? (
          <SaveTab
            slot={props.slot}
            slotName={props.slotName}
            onSlot={props.onSlot}
            onRename={props.onRename}
            onNew={props.onNew}
            onExport={props.onExport}
            onImport={props.onImport}
            onRestore={props.onRestore}
            onSave={props.onSave}
          />
        ) : null}
      </div>
    </aside>
  );
}

function LifeTab({
  world,
  person,
  worldRef,
  animRef,
}: {
  world: World | null;
  person: Agent | null;
  worldRef: Props["worldRef"];
  animRef: Props["animRef"];
}) {
  if (!world || !person) {
    return <p className="text-mute">Chạm một người trên phố. Họ đang sống theo nhu cầu của mình — bạn chỉ quan sát.</p>;
  }
  const why = explainActivity(world, person);
  const seen = perceive(world, person);
  const goals = agenda(world, person).slice(0, 4);
  const stage = lifeStage(person.age);
  const mood = dominantEmotion(person.emotions);
  const partnerRel = world.relationships.find(
    (rel) => (rel.aId === person.id || rel.bId === person.id) && (rel.status === "dating" || rel.status === "married"),
  );
  const partnerId = partnerRel ? (partnerRel.aId === person.id ? partnerRel.bId : partnerRel.aId) : undefined;
  const partner = personById(world, partnerId);
  const emotions = (Object.keys(person.emotions) as EmotionKey[])
    .map((key) => ({ key, value: person.emotions[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Portrait worldRef={worldRef} animRef={animRef} agentId={person.id} />
        <div>
          <h2 className="text-base font-semibold">{person.name}</h2>
          <p className="text-mute">
            {person.age} tuổi · {stage.label} · {person.job}
          </p>
          <p>
            {activityLabel(person)} · {mood.label} {Math.round(mood.value)}
          </p>
        </div>
      </div>
      <RoomView worldRef={worldRef} animRef={animRef} agentId={person.id} />
      <p className="text-mute">
        {Math.round(person.money).toLocaleString("vi-VN")}đ · lương {person.wage} · nhà {person.rent}
        {partner ? ` · ${partnerRel?.status === "married" ? "vợ/chồng" : "người yêu"} ${partner.given}` : ""}
        {person.pregnantWithId ? ` · mang thai ngày ${person.pregnancyDays}` : ""}
      </p>
      <p className="italic text-gold">“{person.lastThought}”</p>
      <div>
        <h3 className="mb-1 font-semibold">Vì sao</h3>
        <p className="text-cream">{why.title}</p>
        {why.reasons.map((reason) => (
          <p key={reason} className="text-mute">
            {reason}
          </p>
        ))}
      </div>
      <div className="space-y-1">
        {NEEDS.map(([key, label]) => (
          <Bar key={key} label={label} value={person.needs[key]} good={key === "health"} />
        ))}
      </div>
      <p className="text-mute">{traitWords(person.traits).join(" · ") || "Tính cách đang ở khoảng giữa."}</p>
      <div className="flex flex-wrap gap-1">
        {emotions.map((emotion) => (
          <span key={emotion.key} className="rounded-full bg-panel-2 px-2 py-1 text-mute">
            {emotionLabel(emotion.key)} {Math.round(emotion.value)}
          </span>
        ))}
      </div>
      <div>
        <h3 className="mb-1 font-semibold">Mục tiêu</h3>
        {goals.map((goal) => (
          <p key={`${goal.horizon}-${goal.label}`}>
            <span className="text-gold">{horizonLabel(goal.horizon)}. </span>
            {goal.label}
            <span className="block text-mute">{goal.because}</span>
          </p>
        ))}
      </div>
      <div>
        <h3 className="mb-1 font-semibold">Đang nhận ra</h3>
        <p>
          {seen.placeName}
          {seen.nearby.length ? ` · cùng ${seen.nearby.map((near) => `${near.name} (${near.known})`).join(", ")}` : " · không có ai khác ở đây"}
        </p>
        <p className="text-mute">{seen.boundary}</p>
      </div>
      <p className="text-mute">{person.bio}</p>
      <p className="text-mute">{person.dream}</p>
    </div>
  );
}

function BondTab({ world, person, onSelect }: { world: World | null; person: Agent | null; onSelect: (id: string) => void }) {
  if (!world || !person) return <p className="text-mute">Chọn một người để xem quan hệ hai chiều, không phải một điểm số.</p>;
  const rows = world.relationships
    .filter((rel) => rel.aId === person.id || rel.bId === person.id)
    .map((rel) => {
      const otherId = rel.aId === person.id ? rel.bId : rel.aId;
      const mine = rel.aId === person.id ? rel.aToB : rel.bToA;
      const theirs = rel.aId === person.id ? rel.bToA : rel.aToB;
      return { rel, other: personById(world, otherId), mine, theirs };
    })
    .filter((row) => row.other && (row.mine.familiarity > 0 || row.rel.status !== "stranger"))
    .sort((a, b) => b.mine.affection + b.mine.familiarity - (a.mine.affection + a.mine.familiarity));
  if (!rows.length) return <p className="text-mute">Chưa có mối quan hệ nào đủ để nhớ. Đứng gần nhau một mình chưa làm họ thân hơn.</p>;
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const history = world.events.filter(
          (event) => event.actorIds.includes(person.id) && row.other && event.actorIds.includes(row.other.id),
        );
        return (
          <button key={row.rel.aId + row.rel.bId} type="button" onClick={() => row.other && onSelect(row.other.id)} className="w-full rounded-lg bg-panel-2 p-3 text-left">
            <p className="font-semibold">
              {row.other?.given} · {statusLabel(row.rel.status)}
            </p>
            <p className="text-mute">
              Mình cảm thấy: thân {Math.round(row.mine.familiarity)} · tin {Math.round(row.mine.trust)} · mến {Math.round(row.mine.affection)} · xung đột {Math.round(row.mine.conflict)}
            </p>
            <p className="text-mute">
              Họ cảm thấy: thân {Math.round(row.theirs.familiarity)} · tin {Math.round(row.theirs.trust)} · mến {Math.round(row.theirs.affection)} · xung đột {Math.round(row.theirs.conflict)}
            </p>
            {history.slice(-2).map((event) => (
              <p key={event.id} className="mt-1 text-cream">
                {event.text}
              </p>
            ))}
          </button>
        );
      })}
    </div>
  );
}

function TreeTab({ world, person, onSelect }: { world: World | null; person: Agent | null; onSelect: (id: string) => void }) {
  if (!world || !person) return <p className="text-mute">Chọn một người để xem gia đình.</p>;
  const parents = (person.parentIds ?? []).map((id) => personById(world, id)).filter((agent): agent is Agent => !!agent);
  const partnerRel = world.relationships.find(
    (rel) => (rel.aId === person.id || rel.bId === person.id) && (rel.status === "married" || rel.status === "dating"),
  );
  const partner = personById(world, partnerRel ? (partnerRel.aId === person.id ? partnerRel.bId : partnerRel.aId) : undefined);
  const children = person.childrenIds.map((id) => personById(world, id)).filter((agent): agent is Agent => !!agent);
  const siblings = world.agents.filter(
    (agent) =>
      agent.id !== person.id &&
      agent.parentIds?.some((id) => person.parentIds?.includes(id)),
  );
  const Node = ({ agent, caption }: { agent: Agent; caption: string }) => (
    <button type="button" onClick={() => onSelect(agent.id)} className="min-h-11 rounded-lg bg-panel-2 px-3 py-2 text-left">
      <span className="block text-mute">{caption}</span>
      {agent.given}
      {!agent.alive ? " · đã khuất" : ""}
    </button>
  );
  return (
    <div className="space-y-3">
      <p className="text-mute">{person.family}</p>
      {parents.length ? (
        <div className="flex flex-wrap gap-2">
          {parents.map((agent) => (
            <Node key={agent.id} agent={agent} caption="Cha/mẹ" />
          ))}
        </div>
      ) : (
        <p className="text-mute">Không có cha mẹ trong thành phố này.</p>
      )}
      <div className="rounded-lg border border-line px-3 py-2">
        <p className="font-semibold">{person.given}</p>
        <p className="text-mute">{partner ? `${partnerRel?.status === "married" ? "Vợ/chồng" : "Đang hẹn hò"}: ${partner.given}` : "Chưa có bạn đời"}</p>
      </div>
      {partner ? <Node agent={partner} caption={partnerRel?.status === "married" ? "Vợ/chồng" : "Bạn đời"} /> : null}
      {siblings.length ? (
        <div className="flex flex-wrap gap-2">
          {siblings.map((agent) => (
            <Node key={agent.id} agent={agent} caption="Anh chị em" />
          ))}
        </div>
      ) : null}
      {children.length ? (
        <div className="flex flex-wrap gap-2">
          {children.map((agent) => (
            <Node key={agent.id} agent={agent} caption="Con" />
          ))}
        </div>
      ) : (
        <p className="text-mute">Chưa có con.</p>
      )}
    </div>
  );
}

function MemoryTab({
  world,
  person,
  kind,
  source,
  onKind,
  onSource,
}: {
  world: World | null;
  person: Agent | null;
  kind: Memory["kind"] | "all";
  source: Memory["source"] | "all";
  onKind: (kind: Memory["kind"] | "all") => void;
  onSource: (source: Memory["source"] | "all") => void;
}) {
  if (!world || !person) return <p className="text-mute">Ký ức hiện khi bạn chọn một người.</p>;
  const memories = retrieveMemories(person, world.minute, { kind, source }, 16);
  return (
    <div className="space-y-2">
      <p className="text-mute">Sắp theo mức liên quan — ký ức quan trọng có thể đứng trên chuyện vừa xảy ra.</p>
      <div className="flex flex-wrap gap-1">
        {(["all", "episodic", "semantic", "working"] as const).map((item) => (
          <button key={item} type="button" onClick={() => onKind(item)} className={`min-h-11 rounded-full px-3 ${kind === item ? "bg-ember text-ember-ink" : "bg-panel-2"}`}>
            {item === "all" ? "Mọi loại" : item === "episodic" ? "Sự kiện" : item === "semantic" ? "Niềm tin" : "Đang nghĩ"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {(["all", "witnessed", "told", "inferred", "self"] as const).map((item) => (
          <button key={item} type="button" onClick={() => onSource(item)} className={`min-h-11 rounded-full px-3 ${source === item ? "bg-cream text-ink" : "bg-panel-2"}`}>
            {item === "all" ? "Mọi nguồn" : sourceLabel(item)}
          </button>
        ))}
      </div>
      {memories.length ? (
        memories.map((memory) => (
          <article key={memory.id} className="rounded-lg bg-panel-2 p-3">
            <p>{memory.text}</p>
            <p className="text-mute">
              Ngày {memory.day + 1} · {sourceLabel(memory.source)} · quan trọng {memory.importance}
              {memory.subjectId ? ` · về ${personById(world, memory.subjectId)?.given ?? "một người"}` : ""}
            </p>
          </article>
        ))
      ) : (
        <p className="text-mute">Không có ký ức khớp bộ lọc.</p>
      )}
    </div>
  );
}

function TimeTab({
  world,
  person,
  onlyMine,
  onOnlyMine,
}: {
  world: World | null;
  person: Agent | null;
  onlyMine: boolean;
  onOnlyMine: (value: boolean) => void;
}) {
  if (!world) return <p className="text-mute">Đang mở dòng thời gian…</p>;
  const events = world.events
    .filter((event) => (onlyMine && person ? event.actorIds.includes(person.id) : true))
    .slice(-24)
    .reverse();
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => onOnlyMine(!onlyMine)} className={`min-h-11 rounded-lg px-3 ${onlyMine ? "bg-ember text-ember-ink" : "bg-panel-2"}`} disabled={!person}>
        {onlyMine ? "Đang lọc theo người được chọn" : "Lọc theo người được chọn"}
      </button>
      {events.length ? (
        events.map((event) => (
          <p key={event.id}>
            <span className="text-mute">
              Ngày {event.day + 1} {String(event.hour).padStart(2, "0")}:{String(event.min).padStart(2, "0")} · {event.type}
            </span>
            <span className="block">{event.text}</span>
          </p>
        ))
      ) : (
        <p className="text-mute">Chưa có sự kiện trong bộ lọc này.</p>
      )}
    </div>
  );
}

function CityTab({ world, onRule }: { world: World | null; onRule: Props["onRule"] }) {
  if (!world) return <p className="text-mute">Thành phố chưa mở.</p>;
  const stats = worldStats(world);
  const cards = [
    ["Dân số", String(stats.population)],
    ["Đang đi làm", String(stats.employed)],
    ["Hôn nhân", String(stats.married)],
    ["Đang hẹn hò", String(stats.dating)],
    ["Bạn bè", String(stats.friends)],
    ["Tiền trung bình", `${Math.round(stats.meanMoney).toLocaleString("vi-VN")}đ`],
    ["Sinh", String(stats.births)],
    ["Mất", String(stats.deaths)],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-panel-2 p-3">
            <p className="text-mute">{label}</p>
            <p className="text-base font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-mute">Ba công tắc này đổi quy tắc thế giới. Chúng không ra lệnh cho từng bước chân.</p>
      <RuleSwitch label="Cho phép tình cảm mới" on={world.rules.romance} onChange={(value) => onRule("romance", value)} />
      <RuleSwitch label="Cho phép gia đình và sinh con" on={world.rules.family} onChange={(value) => onRule("family", value)} />
      <RuleSwitch label="Tiền lương, tiền nhà, chi tiêu" on={world.rules.economy} onChange={(value) => onRule("economy", value)} />
    </div>
  );
}

function RuleSwitch({ label, on, onChange }: { label: string; on: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 text-left">
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full ${on ? "bg-ember" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream ${on ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function SaveTab(props: {
  slot: number;
  slotName: string;
  onSlot: (n: number) => void;
  onRename: (name: string) => void;
  onNew: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onRestore: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" onClick={() => props.onSlot(n)} className={`min-h-11 flex-1 rounded-lg ${props.slot === n ? "bg-ember text-ember-ink" : "bg-panel-2"}`}>
            Ô {n}
          </button>
        ))}
      </div>
      <label className="block text-mute">
        Tên ô lưu
        <input
          value={props.slotName}
          onChange={(event) => props.onRename(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-line bg-ink px-3 text-cream"
          maxLength={32}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={props.onSave} className="min-h-11 rounded-lg bg-cream text-ink">
          Lưu ngay
        </button>
        <button type="button" onClick={props.onNew} className="min-h-11 rounded-lg bg-panel-2">
          Thế giới mới
        </button>
        <button type="button" onClick={props.onExport} className="min-h-11 rounded-lg bg-panel-2">
          Xuất tệp
        </button>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-panel-2">
          Nhập tệp
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onImport(file);
              event.target.value = "";
            }}
          />
        </label>
        <button type="button" onClick={props.onRestore} className="col-span-2 min-h-11 rounded-lg bg-panel-2">
          Khôi phục bản sao trước khi nâng cấp
        </button>
      </div>
      <p className="text-mute">Bản lưu cũ được giữ lại trước khi chuyển sang phiên bản 2. Nếu nâng cấp lỗi, thành phố hiện tại không bị ghi đè.</p>
    </div>
  );
}
