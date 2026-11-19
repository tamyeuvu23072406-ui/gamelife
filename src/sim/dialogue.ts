import type { Agent, World } from "./types.ts";
import { location } from "./data.ts";
import { pick, rng } from "./util.ts";

export type Spoken = { speakerId: string; text: string };

function voice(world: World, speaker: Agent, line: string): string {
  let text = line;
  if (speaker.traits.temper > 70 && rng(world) < 0.7) {
    text = text.replace(/ nhé/g, "").replace(/ nha/g, "");
  }
  if (speaker.traits.confidence < 34 && !text.endsWith("…")) {
    text = text.replace(/[.!]$/, "…");
  }
  if (speaker.traits.humor > 78 && rng(world) < 0.28 && !text.includes("Đùa")) {
    text = `${text.replace(/[.…!]$/, "")}. Đùa một nửa.`;
  }
  return text;
}

function say(world: World, speaker: Agent, line: string): Spoken {
  return { speakerId: speaker.id, text: voice(world, speaker, line) };
}

export function linesFor(
  world: World,
  a: Agent,
  b: Agent,
  mode:
    | "meet"
    | "chat"
    | "gift"
    | "argue"
    | "apology"
    | "confess"
    | "accept"
    | "reject"
    | "propose"
    | "marry"
    | "break"
    | "return"
    | "callback"
    | "reveal",
  extra?: string,
): Spoken[] {
  const place = a.locationId !== "transit" ? location(a.locationId).name : "phố";
  if (mode === "meet") {
    return [
      say(world, a, pick(world, [
        `Chào ${b.given}. Mình là ${a.given}. Hình như mình chưa gặp nhau.`,
        `${b.given} phải không? Mình ${a.given}. Lần đầu thấy cậu ở ${place}.`,
        `Xin lỗi, mình ngồi đây được không? Mình là ${a.given}.`,
      ])),
      say(world, b, pick(world, [
        `Mình là ${b.given}. Chào ${a.given}.`,
        `${a.given}. Mình nhớ tên cậu. Hôm nay ${place.toLowerCase()} cũng ổn.`,
        `Chào ${a.given}. Mình ${b.given}.`,
      ])),
    ];
  }
  if (mode === "chat") {
    const opener = pick(world, [
      `Hôm nay cậu thế nào?`,
      `${place} hôm nay lạ hơn mọi khi.`,
      world.weather === "rain" ? "Mưa này làm mình muốn nán lại." : "Trời đẹp, nhưng mình vẫn thích chỗ có mái.",
      a.traits.selfishness > 60 ? "Ca của mình hôm nay dài thấy sợ." : "Cậu vừa xong việc à?",
      b.traits.humor > 70 ? "Nếu cậu đang định kể chuyện buồn thì mình sẽ đùa. Báo trước cho công bằng." : "Mình ngồi thêm một chút.",
    ]);
    const reply = pick(world, [
      b.traits.extroversion < 35 ? "Mình ổn. Không có nhiều chuyện để kể." : "Cũng được. Có vài chuyện vụn, nhưng đủ để kể.",
      b.needs.hunger > 65 ? "Mình đói hơn là mình tưởng. Cậu ăn chưa?" : "Mình vừa thở ra một cái. Thế là khá rồi.",
      world.weather === "rain" ? "Mưa thì mình ít muốn về ngay." : "Mình định lát nữa sẽ đi.",
      b.traits.warmth > 75 ? "Cậu trông có vẻ đang nghĩ gì đó. Không cần nói nếu chưa muốn." : "Ừ. Nghe đây.",
    ]);
    return [say(world, a, opener), say(world, b, reply)];
  }
  if (mode === "callback" && extra) {
    return [
      say(world, a, pick(world, [
        `Mình vẫn nhớ cậu từng nói ${extra}.`,
        `Không phải mình cố nhớ đâu, nhưng ${extra} — cậu nói thật chứ?`,
        `Lần trước cậu kể ${extra}. Mình để ý từ hôm đó.`,
      ])),
      say(world, b, pick(world, [
        "Cậu nhớ thật à. Mình không ngờ.",
        "Ừ. Ít người giữ chuyện đó lại.",
        b.traits.confidence < 40 ? "Mình… nói vậy thôi mà." : "Đúng. Và mình vẫn vậy.",
      ])),
    ];
  }
  if (mode === "reveal" && extra) {
    return [
      say(world, a, pick(world, [
        `Mình chưa kể cậu: ${extra}.`,
        `Có một chuyện nhỏ. ${extra[0]?.toUpperCase()}${extra.slice(1)}.`,
        `Không phải bí mật lớn, nhưng ${extra}.`,
      ])),
      say(world, b, pick(world, [
        "Cảm ơn vì đã nói.",
        "Mình sẽ nhớ.",
        b.traits.kindness > 70 ? "Cậu kể được là tốt rồi." : "Ừ. Mình nghe.",
      ])),
    ];
  }
  if (mode === "gift" && extra) {
    return [
      say(world, a, pick(world, [
        `Cái này cho cậu. ${extra}. Mình nhớ cậu thích.`,
        `Đừng cười. Mình mua ${extra.toLowerCase()} vì cậu từng nhắc.`,
        `${b.given}, cầm lấy. ${extra}.`,
      ])),
      say(world, b, pick(world, [
        "Cậu nhớ thật. Mình không biết nói gì hơn là cảm ơn.",
        "Mình thích. Không chỉ vì món này.",
        b.traits.temper > 65 ? "Cậu làm mình hết biết cách cáu." : "Để mình giữ cẩn thận.",
      ])),
    ];
  }
  if (mode === "argue") {
    return [
      say(world, a, pick(world, [
        "Mình không thích cách cậu im trong chuyện này.",
        "Cậu có nghe mình nói không, hay chỉ đang đợi đến lượt mình?",
        a.emotions.jealousy > 40 ? "Mình thấy cậu với người kia. Đừng bảo là mình tưởng tượng." : "Mình mệt vì phải đoán ý cậu.",
      ])),
      say(world, b, pick(world, [
        b.traits.temper > 60 ? "Cậu đang đổ hết lên mình." : "Mình không cố làm cậu tổn thương.",
        "Nếu cậu đã kết luận rồi thì mình nói thêm cũng vô ích.",
        b.traits.kindness > 75 ? "Mình đang nghe. Nhưng cậu đang đau, và cậu đang làm mình đau theo." : "Thế cậu muốn gì?",
      ])),
    ];
  }
  if (mode === "apology") {
    return [
      say(world, a, pick(world, [
        "Mình nói quá. Mình xin lỗi.",
        "Mình không muốn thắng cuộc cãi này. Mình muốn cậu còn ở đây.",
        "Lỗi phần nhiều là mình. Mình nhận.",
      ])),
      say(world, b, pick(world, [
        "Mình cũng có phần. Mình không đi nữa.",
        "Được. Mình vẫn giận một chút, nhưng mình ở lại.",
        "Xin lỗi của cậu mình nhận. Lần sau nói sớm hơn.",
      ])),
    ];
  }
  if (mode === "confess") {
    return [
      say(world, a, pick(world, [
        `${b.given}, mình không muốn chỉ đi ngang qua cậu nữa.`,
        "Mình thích cậu. Không phải kiểu thích thoáng qua.",
        "Nếu cậu không muốn, mình sẽ lùi lại. Nhưng mình phải nói.",
      ])),
    ];
  }
  if (mode === "accept") {
    return [say(world, b, pick(world, [
      "Mình cũng muốn thử. Đi cùng nhau, chậm thôi.",
      "Mình đồng ý. Đừng hứa lớn. Hãy ở lại.",
      "Được. Mình chọn cậu — hôm nay, và mình sẽ xem ngày mai.",
    ]))];
  }
  if (mode === "reject") {
    const kind = b.traits.kindness > 62;
    return [say(world, b, kind
      ? pick(world, [
          "Mình quý cậu. Nhưng mình không thấy cùng một hướng. Mình không muốn giả vờ.",
          "Cảm ơn vì đã nói thẳng. Mình không đáp lại được như cậu cần.",
          "Cậu xứng đáng nghe câu rõ ràng: mình không thể bước tiếp theo cách đó.",
        ])
      : pick(world, [
          "Mình không nghĩ về cậu theo cách đó.",
          "Đừng. Mình không muốn mối quan hệ này đi xa hơn.",
          "Cậu nhầm rồi. Mình không có cảm giác ấy.",
        ]))];
  }
  if (mode === "propose") {
    return [say(world, a, pick(world, [
      "Mình muốn cưới cậu. Không phải lúc cao hứng. Mình đã nghĩ nhiều ngày.",
      `${b.given}, ở lại với mình như một người nhà. Cưới nhau nhé.`,
      "Mình không cần đám cưới lớn. Mình cần cậu gật đầu.",
    ]))];
  }
  if (mode === "marry") {
    return [say(world, b, pick(world, [
      "Mình gật. Mình chọn cậu.",
      "Được. Mình cưới cậu.",
      "Có. Và mình biết mình đang nói gì.",
    ]))];
  }
  if (mode === "break") {
    return [
      say(world, a, pick(world, [
        "Mình không còn muốn tiếp tục. Mình nói để cậu khỏi phải đoán.",
        "Mình đã cố. Mình dừng lại đây.",
        "Ta không còn hợp. Mình không muốn làm nhau tệ hơn.",
      ])),
      say(world, b, pick(world, [
        "Mình nghe rồi.",
        "Thế thì mình không níu.",
        b.traits.temper > 60 ? "Được. Đừng giải thích thêm." : "Mình buồn. Nhưng mình tôn trọng câu đó.",
      ])),
    ];
  }
  if (mode === "return") {
    return [
      say(world, a, "Mình nhớ cậu theo cách không chịu hết. Ta thử lại, được không?"),
      say(world, b, "Chậm thôi. Nhưng mình đồng ý thử lại."),
    ];
  }
  return [say(world, a, "…"), say(world, b, "Ừ.")];
}
