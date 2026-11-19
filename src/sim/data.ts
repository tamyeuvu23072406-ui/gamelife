import type { Agent, Fact, LocationDef, Traits } from "./types.ts";

export const ROADS_X = [-24, -12, 0, 14, 28, 42];
export const ROADS_Z = [-18, -6, 8, 20];

export const MAP = { minX: -50, maxX: 58, minZ: -40, maxZ: 40 };

export const LOCATIONS: LocationDef[] = [
  { id: "home_linh", name: "Nhà Linh", kind: "home", x: -24, z: -18, gather: 0.85, blurb: "Căn nhà nhỏ nhìn ra vườn, cửa sổ hay để mở.", build: { ox: -5.2, oz: -4.2, w: 4.2, d: 3.6, h: 2.8, wall: "#e4d2b8", roof: "#8a4b3c" } },
  { id: "home_minh", name: "Nhà Minh", kind: "home", x: -24, z: -6, gather: 0.85, blurb: "Studio gọn, kệ đĩa nhạc sát cửa sổ.", build: { ox: -5.2, oz: 0.2, w: 4.4, d: 3.8, h: 3.15, wall: "#d7c6ae", roof: "#6e5344" } },
  { id: "home_ha", name: "Nhà Hà", kind: "home", x: -24, z: 8, gather: 0.85, blurb: "Nhiều sách và một bậu cửa để mèo ngồi.", build: { ox: -5.2, oz: -0.4, w: 4, d: 3.5, h: 2.7, wall: "#efe2cc", roof: "#8d5a49" } },
  { id: "home_khoa", name: "Nhà Khoa", kind: "home", x: -24, z: 20, gather: 0.85, blurb: "Nhà yên, giày chạy luôn để sẵn ở hiên.", build: { ox: -5.2, oz: 4, w: 4.5, d: 3.7, h: 3, wall: "#ddd4c6", roof: "#5e5148" } },
  { id: "home_mai", name: "Nhà Mai", kind: "home", x: -12, z: -18, gather: 0.85, blurb: "Căn hộ sáng, gương lớn và giá treo đồ.", build: { ox: -5, oz: -4.2, w: 3.8, d: 3.4, h: 2.65, wall: "#f0d7c8", roof: "#7a4038" } },
  { id: "home_duc", name: "Nhà Đức", kind: "home", x: -12, z: -6, gather: 0.85, blurb: "Bếp chiếm nửa nhà. Mùi gia vị không bao giờ tắt.", build: { ox: -5, oz: 0.4, w: 4.3, d: 3.7, h: 2.9, wall: "#e7c8a4", roof: "#6a3b32" } },
  { id: "home_an", name: "Nhà An", kind: "home", x: -12, z: 8, gather: 0.85, blurb: "Rèm dày, bàn đặt máy ảnh và một ghế bên cửa sổ.", build: { ox: -5, oz: -0.2, w: 3.7, d: 3.4, h: 2.75, wall: "#d9d3c8", roof: "#4e5854" } },
  { id: "home_chi", name: "Nhà Chi", kind: "home", x: -12, z: 20, gather: 0.85, blurb: "Nhà sạch, một lọ hoa hay đổi theo tuần.", build: { ox: -5, oz: 4, w: 4, d: 3.5, h: 2.8, wall: "#f3e6d4", roof: "#8b5a4a" } },
  { id: "cafe", name: "Café Sương", kind: "cafe", x: 0, z: -6, gather: 1.35, blurb: "Quán cà phê góc phố. Cuối quầy luôn có hướng dương.", build: { ox: 0.2, oz: -6.4, w: 7.2, d: 5, h: 3.3, wall: "#c46b4a", roof: "#6e3b32", awning: true } },
  { id: "park", name: "Công viên Hướng Dương", kind: "park", x: 0, z: 8, gather: 2.5, blurb: "Bãi cỏ, ghế đá và một đài phun nước thấp." },
  { id: "restaurant", name: "Nhà hàng Đêm", kind: "restaurant", x: 14, z: -6, gather: 1.3, blurb: "Bếp mở, đèn ấm. Món thay đổi theo người đứng bếp.", build: { ox: 0.4, oz: -6.3, w: 6.6, d: 5.1, h: 3.35, wall: "#a65448", roof: "#4a2e2c", awning: true } },
  { id: "market", name: "Siêu thị Sen", kind: "market", x: 14, z: 8, gather: 1.4, blurb: "Kệ thực phẩm, hoa và đồ lặt vặt cuối ngày.", build: { ox: 6.2, oz: 0.2, w: 8.2, d: 5.4, h: 3.5, wall: "#6e8f86", roof: "#314842" } },
  { id: "school", name: "Trường Bình Minh", kind: "school", x: 28, z: -18, gather: 1.5, blurb: "Sân gạch và hành lang dài. Chiều thường vắng.", build: { ox: 6.4, oz: -4.2, w: 9.2, d: 6, h: 3.7, wall: "#e2c56e", roof: "#8a6232" } },
  { id: "office", name: "Văn phòng Ánh", kind: "office", x: 28, z: -6, gather: 1.35, blurb: "Khối nhà kính, đèn màn hình còn sáng khá khuya.", build: { ox: 6.3, oz: 0, w: 6.2, d: 6.2, h: 8.2, wall: "#8aa0ad", roof: "#31424c", floors: 3 } },
  { id: "mall", name: "Trung tâm Lotus", kind: "mall", x: 28, z: 20, gather: 1.6, blurb: "Trung tâm thương mại nhỏ: thời trang, nhạc, quà.", build: { ox: 6.6, oz: 3.6, w: 10.4, d: 7, h: 4.4, wall: "#cbb7a4", roof: "#5c5148", floors: 2 } },
  { id: "hospital", name: "Bệnh viện An Tâm", kind: "hospital", x: 42, z: 8, gather: 1.55, blurb: "Sảnh trắng, trực ngày và trực tối.", build: { ox: 6.5, oz: 0.2, w: 8.4, d: 6.2, h: 5.2, wall: "#e7efe9", roof: "#6d8f8a", floors: 2 } },
];

export function location(id: string): LocationDef {
  const found = LOCATIONS.find((l) => l.id === id);
  if (!found) throw new Error(`missing location ${id}`);
  return found;
}

const T = (p: Traits): Traits => p;

type Seed = Omit<
  Agent,
  | "memories"
  | "locationId"
  | "activity"
  | "travel"
  | "busyUntil"
  | "activityApplied"
  | "lastThought"
  | "lastShopDay"
  | "paidToday"
  | "hadLunch"
  | "hadBreakfast"
  | "talksToday"
  | "confessCooldown"
  | "workChatty"
  | "stats"
  | "needs"
  | "emotions"
  | "money"
> & { money: number; hunger: number; social: number };

function fact(key: string, value: string, intimacy: 1 | 2 | 3, gift?: Fact["gift"]): Fact {
  return { key, value, intimacy, gift };
}

export const SEEDS: Seed[] = [
  {
    id: "linh",
    name: "Linh Trần",
    given: "Linh",
    age: 27,
    job: "Chủ quán cà phê",
    workplaceId: "cafe",
    homeId: "home_linh",
    wage: 170,
    rent: 240,
    money: 860,
    hunger: 48,
    social: 42,
    traits: T({ extroversion: 58, warmth: 82, temper: 24, humor: 64, confidence: 48, romance: 76, selfishness: 18, kindness: 86, jealousy: 34, trustBarrier: 38 }),
    facts: [
      fact("sunflower", "thích hoa hướng dương", 1, { item: "sunflower", label: "một bó hướng dương", place: "cafe", cost: 24 }),
      fact("storm", "sợ giông và tiếng sấm", 2),
      fact("second-cafe", "muốn mở một quán thứ hai, nhỏ hơn, chỉ bán bánh và hoa", 3),
    ],
    bio: "Mở quán vì thích nhìn người ta nán lại thêm một chút.",
    routine: "Mở Café Sương gần như cả tuần, nghỉ Chủ Nhật. Chiều thường còn nán lại dọn hoa.",
    family: "Bố mẹ ở Hội An. Gọi về mỗi Chủ Nhật, không phải lúc nào cũng kể thật.",
    dream: "Một quán nhỏ hơn, chỉ bán bánh và hoa",
    appearance: { skin: "#e0b08a", hair: "#2a211c", outfit: "#f2d3a2", pants: "#6b4a3a", hairStyle: "bun", height: 1 },
  },
  {
    id: "minh",
    name: "Minh Phạm",
    given: "Minh",
    age: 29,
    job: "Kỹ sư phần mềm",
    workplaceId: "office",
    homeId: "home_minh",
    wage: 320,
    rent: 340,
    money: 2400,
    hunger: 44,
    social: 50,
    traits: T({ extroversion: 70, warmth: 52, temper: 42, humor: 84, confidence: 76, romance: 48, selfishness: 58, kindness: 50, jealousy: 28, trustBarrier: 32 }),
    facts: [
      fact("jazz", "thích jazz và đĩa than", 1, { item: "jazz", label: "một đĩa jazz", place: "mall", cost: 46 }),
      fact("night", "hay thức khuya vì code, dù sáng hôm sau hay hối", 2),
      fact("house", "muốn mua một căn nhà không phải đi thuê", 3),
    ],
    bio: "Nói nhanh khi đùa, im khi chuyện trở nên thật.",
    routine: "Văn phòng Ánh các ngày trong tuần, 9 giờ đến 18 giờ. Tối đôi khi ghé quán.",
    family: "Em gái đang học ở Đà Nẵng. Minh gửi tiền đều, ít hỏi han.",
    dream: "Mua được nhà trước năm 35 tuổi",
    appearance: { skin: "#c98a62", hair: "#1c1a1a", outfit: "#2f3d52", pants: "#24282e", hairStyle: "short", height: 1.06 },
  },
  {
    id: "ha",
    name: "Hà Nguyễn",
    given: "Hà",
    age: 26,
    job: "Giáo viên ngữ văn",
    workplaceId: "school",
    homeId: "home_ha",
    wage: 155,
    rent: 220,
    money: 740,
    hunger: 40,
    social: 28,
    traits: T({ extroversion: 24, warmth: 88, temper: 14, humor: 42, confidence: 30, romance: 82, selfishness: 12, kindness: 92, jealousy: 22, trustBarrier: 56 }),
    facts: [
      fact("poetry", "thích thơ và hay chép lại câu mình nhớ", 1, { item: "poetry", label: "một tập thơ", place: "mall", cost: 32 }),
      fact("cats", "nuôi một con mèo tên Mít, dù ít khi khoe", 1, { item: "cat", label: "đồ ăn cho mèo", place: "market", cost: 18 }),
      fact("family", "muốn một gia đình yên, không cần đông", 3),
    ],
    bio: "Dạy văn ban ngày. Chiều thích ngồi chỗ ít người.",
    routine: "Dạy ở Trường Bình Minh các ngày trong tuần. Chiều thường ra công viên một mình.",
    family: "Ở với mẹ đến năm ngoái. Mẹ vẫn gọi mỗi tối.",
    dream: "Viết một tập truyện thật mỏng và in nó",
    appearance: { skin: "#efc2a0", hair: "#3a241c", outfit: "#d9e2d2", pants: "#5d6a62", hairStyle: "long", height: 0.96 },
  },
  {
    id: "khoa",
    name: "Khoa Lê",
    given: "Khoa",
    age: 32,
    job: "Bác sĩ nội khoa",
    workplaceId: "hospital",
    homeId: "home_khoa",
    wage: 410,
    rent: 380,
    money: 3100,
    hunger: 38,
    social: 30,
    traits: T({ extroversion: 40, warmth: 46, temper: 18, humor: 32, confidence: 74, romance: 26, selfishness: 30, kindness: 68, jealousy: 14, trustBarrier: 48 }),
    facts: [
      fact("running", "chạy bộ mỗi khi đầu óc quá tải", 1, { item: "running", label: "đôi giày chạy", place: "mall", cost: 70 }),
      fact("paper", "đang viết một bài nghiên cứu và hay bị trực làm gián đoạn", 2),
      fact("quiet", "không thích nói chuyện xã giao cho có", 2),
    ],
    bio: "Ít lời. Tin vào việc làm hơn là lời hứa.",
    routine: "Bệnh viện An Tâm. Một số ngày trực muộn đến tối. Chủ Nhật ở nhà.",
    family: "Bố từng là bác sĩ. Khoa không thích bị so sánh.",
    dream: "Xuất bản bài nghiên cứu đang viết dở",
    appearance: { skin: "#d7a57c", hair: "#2c2420", outfit: "#e8f0f2", pants: "#3d4c55", hairStyle: "short", height: 1.08, glasses: true },
  },
  {
    id: "mai",
    name: "Mai Võ",
    given: "Mai",
    age: 24,
    job: "Quản lý cửa hàng",
    workplaceId: "mall",
    homeId: "home_mai",
    wage: 200,
    rent: 260,
    money: 980,
    hunger: 46,
    social: 62,
    traits: T({ extroversion: 86, warmth: 60, temper: 66, humor: 74, confidence: 82, romance: 72, selfishness: 60, kindness: 42, jealousy: 82, trustBarrier: 28 }),
    facts: [
      fact("fashion", "để ý quần áo của người khác trước cả khuôn mặt", 1, { item: "fashion", label: "một chiếc khăn lụa", place: "mall", cost: 40 }),
      fact("photo", "thích được chụp, và cũng thích đứng sau máy", 1, { item: "film", label: "một cuộn film", place: "mall", cost: 28 }),
      fact("ordinary", "sợ mình trở thành người bình thường đến mức không ai nhớ", 3),
    ],
    bio: "Nói to khi vui, nói sắc khi tổn thương.",
    routine: "Trung tâm Lotus từ 10 giờ đến 19 giờ, nghỉ Thứ Hai. Tối thích chỗ đông.",
    family: "Cha mẹ ly hôn từ khi Mai 16. Ở với dì một thời gian.",
    dream: "Có một thương hiệu nhỏ mang tên mình",
    appearance: { skin: "#e8b896", hair: "#1a120f", outfit: "#d85a4a", pants: "#2b2428", hairStyle: "bob", height: 1.02 },
  },
  {
    id: "duc",
    name: "Đức Hoàng",
    given: "Đức",
    age: 33,
    job: "Bếp trưởng",
    workplaceId: "restaurant",
    homeId: "home_duc",
    wage: 230,
    rent: 250,
    money: 1200,
    hunger: 36,
    social: 58,
    traits: T({ extroversion: 80, warmth: 78, temper: 54, humor: 86, confidence: 66, romance: 62, selfishness: 32, kindness: 74, jealousy: 44, trustBarrier: 24 }),
    facts: [
      fact("cooking", "tin rằng nấu cho ai là một cách nói thương", 1, { item: "spice", label: "một hũ gia vị hiếm", place: "market", cost: 30 }),
      fact("recipe", "giữ vài công thức của mẹ và chưa đưa cho ai", 2),
      fact("own-place", "muốn có nhà hàng mang tên mình, không còn làm thuê", 3),
    ],
    bio: "Cười lớn. Dễ tha thứ, trừ khi đụng đến bếp.",
    routine: "Nhà hàng Đêm từ 11 giờ đến 21 giờ, nghỉ Thứ Ba. Hay mời người ta nếm thử.",
    family: "Mẹ ở quê. Đức gửi món ăn về mỗi khi có người đi nhờ.",
    dream: "Nhà hàng mang tên mình",
    appearance: { skin: "#c68658", hair: "#3a2718", outfit: "#f4f1ea", pants: "#4a342c", hairStyle: "spiky", height: 1.05 },
  },
  {
    id: "an",
    name: "An Đỗ",
    given: "An",
    age: 28,
    job: "Nhiếp ảnh tự do",
    workplaceId: "cafe",
    homeId: "home_an",
    wage: 180,
    rent: 230,
    money: 640,
    hunger: 42,
    social: 24,
    traits: T({ extroversion: 20, warmth: 64, temper: 18, humor: 46, confidence: 26, romance: 58, selfishness: 18, kindness: 78, jealousy: 18, trustBarrier: 84 }),
    facts: [
      fact("rain", "thích đi bộ lúc trời mưa", 1, { item: "umbrella", label: "một chiếc ô màu trầm", place: "mall", cost: 26 }),
      fact("filmcam", "chỉ tin máy film, vì mỗi khung hình phải trả giá", 1, { item: "film", label: "một cuộn film", place: "mall", cost: 28 }),
      fact("trust", "từng bị bạn thân phản bội nên rất chậm tin người mới", 3),
    ],
    bio: "Nhận việc chụp để trả nhà. Phần còn lại của ngày thường im.",
    routine: "Hay ngồi làm ở Café Sương. Thứ Sáu chiều có mặt ở Lotus. Nghỉ Chủ Nhật và Thứ Năm.",
    family: "Anh trai sống xa, nhắn tin nhiều hơn nói chuyện.",
    dream: "Một triển lãm ảnh nhỏ, dù chỉ một căn phòng",
    appearance: { skin: "#e6c3a4", hair: "#4a3428", outfit: "#6e7c86", pants: "#2e3338", hairStyle: "bob", height: 0.98, glasses: true },
  },
  {
    id: "chi",
    name: "Chi Bùi",
    given: "Chi",
    age: 25,
    job: "Điều dưỡng",
    workplaceId: "hospital",
    homeId: "home_chi",
    wage: 165,
    rent: 220,
    money: 700,
    hunger: 43,
    social: 40,
    traits: T({ extroversion: 52, warmth: 84, temper: 34, humor: 50, confidence: 56, romance: 86, selfishness: 22, kindness: 82, jealousy: 70, trustBarrier: 44 }),
    facts: [
      fact("sunflower", "thích hoa hướng dương từ hồi còn đi học", 1, { item: "sunflower", label: "một bó hướng dương", place: "cafe", cost: 24 }),
      fact("notice", "để ý những thay đổi rất nhỏ ở người khác", 2),
      fact("clinic", "muốn mở một phòng khám nhỏ cho khu phố, không nói với đồng nghiệp", 3),
    ],
    bio: "Chăm người khác rất tự nhiên. Chậm nhận ra mình đang cần gì.",
    routine: "Ca sáng ở Bệnh viện An Tâm, nghỉ Chủ Nhật. Chiều thích chỗ có hoa hoặc có người.",
    family: "Em trai đang học cấp ba. Chi gửi tiền sách mỗi tháng.",
    dream: "Mở phòng khám nhỏ trong khu phố",
    appearance: { skin: "#f0c2a6", hair: "#241816", outfit: "#7ec8c3", pants: "#f4f6f5", hairStyle: "long", height: 0.97 },
  },
];

export const TREE_SPOTS: { x: number; z: number; s: number }[] = [
  { x: -3.2, z: 5.2, s: 1 },
  { x: 3.4, z: 6.1, s: 1.15 },
  { x: -4.2, z: 10.4, s: 0.9 },
  { x: 4.6, z: 11.2, s: 1.05 },
  { x: -1.2, z: 13.4, s: 1.2 },
  { x: 2.2, z: 4.2, s: 0.85 },
  { x: 6.2, z: 9.4, s: 0.95 },
  { x: -6.4, z: 8.2, s: 1.1 },
  { x: -30, z: -10, s: 0.8 },
  { x: -18, z: -12, s: 0.75 },
  { x: -18, z: 14, s: 0.85 },
  { x: -30, z: 16, s: 0.9 },
  { x: 8, z: -14, s: 0.8 },
  { x: 20, z: 2, s: 0.85 },
  { x: 36, z: 16, s: 0.9 },
  { x: 36, z: -2, s: 0.8 },
  { x: 8, z: 16, s: 0.88 },
  { x: -6, z: -14, s: 0.78 },
];
