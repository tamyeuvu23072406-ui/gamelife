export const SAVE_VERSION = 2;

export type TraitKey =
  | "extroversion"
  | "warmth"
  | "temper"
  | "humor"
  | "confidence"
  | "romance"
  | "selfishness"
  | "kindness"
  | "jealousy"
  | "trustBarrier";

export type Traits = Record<TraitKey, number>;

export type Needs = {
  hunger: number;
  thirst: number;
  sleepiness: number;
  fun: number;
  social: number;
  affection: number;
  safety: number;
  health: number;
};

export type EmotionKey =
  | "joy"
  | "sadness"
  | "anger"
  | "anxiety"
  | "jealousy"
  | "shame"
  | "loneliness"
  | "disappointment"
  | "hope"
  | "love";

export type Emotions = Record<EmotionKey, number>;

export type Activity =
  | "idle"
  | "walking"
  | "working"
  | "eating"
  | "drinking"
  | "sleeping"
  | "relaxing"
  | "shopping"
  | "socializing"
  | "seeking"
  | "treatment";

export type Fact = {
  key: string;
  value: string;
  intimacy: 1 | 2 | 3;
  gift?: { item: string; label: string; place: string; cost: number };
};

export type MemorySource = "witnessed" | "told" | "inferred" | "self";

export type Memory = {
  id: string;
  kind: "working" | "episodic" | "semantic";
  subjectId?: string;
  text: string;
  tags: string[];
  source: MemorySource;
  factKey?: string;
  factValue?: string;
  day: number;
  minute: number;
  importance: number;
};

export type DirRel = {
  familiarity: number;
  trust: number;
  respect: number;
  affection: number;
  attraction: number;
  bond: number;
  conflict: number;
  commitment: number;
};

export type RelStatus =
  | "stranger"
  | "acquaintance"
  | "friends"
  | "close"
  | "dating"
  | "married"
  | "distant"
  | "broken"
  | "divorced";

export type Relationship = {
  aId: string;
  bId: string;
  aToB: DirRel;
  bToA: DirRel;
  compatibility: number;
  status: RelStatus;
  sinceDay: number;
  initiatorId?: string;
};

export type Pt = { x: number; z: number };

export type Travel = {
  path: Pt[];
  cum: number[];
  total: number;
  startMinute: number;
  endMinute: number;
  destId: string;
  arriveActivity: Activity;
  seekId?: string;
};

export type Appearance = {
  skin: string;
  hair: string;
  outfit: string;
  pants: string;
  hairStyle: "short" | "long" | "bun" | "bob" | "spiky";
  height: number;
  glasses?: boolean;
};

export type Gift = { forId: string; item: string; label: string; factKey: string };

export type LifeStage = "toddler" | "child" | "teen" | "adult" | "senior";

export type AgentStats = { sleeps: number; meals: number; talks: number; gifts: number };

export type Agent = {
  id: string;
  name: string;
  given: string;
  age: number;
  job: string;
  workplaceId: string;
  homeId: string;
  wage: number;
  rent: number;
  money: number;
  traits: Traits;
  needs: Needs;
  emotions: Emotions;
  facts: Fact[];
  bio: string;
  routine: string;
  family: string;
  dream: string;
  appearance: Appearance;
  memories: Memory[];
  locationId: string;
  activity: Activity;
  destinationId?: string;
  partnerId?: string;
  seekTargetId?: string;
  travel: Travel | null;
  busyUntil: number;
  activityApplied: boolean;
  lastThought: string;
  lastShopDay: number;
  paidToday: boolean;
  hadLunch: boolean;
  hadBreakfast: boolean;
  talksToday: number;
  holdingGift?: Gift;
  planGift?: Gift & { place: string };
  confessCooldown: Record<string, number>;
  workChatty: boolean;
  stats: AgentStats;
  birthDay: number;
  parentIds?: [string, string];
  childrenIds: string[];
  pregnantWithId?: string;
  pregnancyDays: number;
  retired?: boolean;
  alive: boolean;
};

export type WorldEvent = {
  id: string;
  day: number;
  minute: number;
  hour: number;
  min: number;
  type: string;
  actorIds: string[];
  text: string;
  importance: number;
};

export type Line = {
  id: string;
  speakerId: string;
  text: string;
  day: number;
  minute: number;
  placeId: string;
  partnerId: string;
};

export type Weather = "clear" | "cloudy" | "rain";

export type BuildSpec = {
  ox: number;
  oz: number;
  w: number;
  d: number;
  h: number;
  wall: string;
  roof: string;
  awning?: boolean;
  floors?: number;
};

export type LocationDef = {
  id: string;
  name: string;
  kind: "home" | "cafe" | "park" | "restaurant" | "market" | "office" | "school" | "mall" | "hospital";
  x: number;
  z: number;
  gather: number;
  blurb: string;
  build?: BuildSpec;
};

export type WorldRules = {
  /** Characters still choose their own relationships. False only skips new romance beats. */
  romance: boolean;
  family: boolean;
  economy: boolean;
};

export type World = {
  version: number;
  seed: number;
  rngState: number;
  minute: number;
  weather: Weather;
  agents: Agent[];
  relationships: Relationship[];
  events: WorldEvent[];
  lines: Line[];
  nextId: number;
  pairCooldown: Record<string, number>;
  rules: WorldRules;
};
