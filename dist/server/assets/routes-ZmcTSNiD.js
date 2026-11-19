import { useEffect, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/lib/ambient.ts
/** Synthesized ambience (no audio assets). Must be started from a user gesture. */
function startAmbient() {
	const AC = window.AudioContext ?? window.webkitAudioContext;
	if (!AC) return null;
	const ctx = new AC();
	const master = ctx.createGain();
	master.gain.value = .5;
	const muffle = ctx.createBiquadFilter();
	muffle.type = "lowpass";
	muffle.frequency.value = 12e3;
	master.connect(muffle);
	muffle.connect(ctx.destination);
	const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
	const layer = (type, freq) => {
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		const f = ctx.createBiquadFilter();
		f.type = type;
		f.frequency.value = freq;
		const g = ctx.createGain();
		g.gain.value = 0;
		src.connect(f);
		f.connect(g);
		g.connect(master);
		src.start();
		return g;
	};
	const rain = layer("highpass", 1500);
	const wind = layer("lowpass", 500);
	let day = false;
	let night = false;
	const tone = (freq, dur, vol, type = "sine", when = 0) => {
		const t0 = ctx.currentTime + when;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime(freq, t0);
		o.frequency.linearRampToValueAtTime(freq * 1.25, t0 + dur);
		g.gain.setValueAtTime(0, t0);
		g.gain.linearRampToValueAtTime(vol, t0 + dur * .3);
		g.gain.linearRampToValueAtTime(0, t0 + dur);
		o.connect(g);
		g.connect(master);
		o.start(t0);
		o.stop(t0 + dur + .05);
	};
	const iv = setInterval(() => {
		if (day && Math.random() < .45) {
			const f = 2200 + Math.random() * 1600;
			tone(f, .09, .05);
			if (Math.random() < .6) tone(f * 1.1, .09, .05, "sine", .14);
		}
		if (night && Math.random() < .8) for (let i = 0; i < 3; i++) tone(4300, .04, .025, "square", i * .07);
	}, 700);
	return {
		update(weather, hour, indoors) {
			const wet = weather === "rain";
			day = hour >= 6 && hour < 18 && !wet;
			night = hour >= 19 || hour < 5;
			const t = ctx.currentTime;
			rain.gain.setTargetAtTime(wet ? .22 : 0, t, .6);
			wind.gain.setTargetAtTime(weather === "cloudy" ? .12 : wet ? .08 : .03, t, .8);
			muffle.frequency.setTargetAtTime(indoors ? 500 : 12e3, t, .3);
		},
		stop() {
			clearInterval(iv);
			ctx.close();
		}
	};
}
//#endregion
//#region src/lib/agent-sprite.ts
var MOOD = {
	joy: "😊",
	sadness: "😢",
	anger: "😠",
	anxiety: "😰",
	jealousy: "😒",
	shame: "😳",
	loneliness: "😞",
	disappointment: "😕",
	love: "💕"
};
/** Draws one character with its feet at (x, y). `u` = pixels per world unit, `p.t` = animation clock (s). */
function drawAgent(ctx, a, x, y, u, p) {
	const ap = a.appearance;
	const s = u * (ap.height > 3 ? ap.height / 170 : ap.height);
	const t = p.t;
	const act = a.activity;
	const len = Math.hypot(p.fx, p.fz) || 1;
	const fx = p.fx / len;
	const back = p.fz / len < -.4;
	const dot = (cx, cy, r) => {
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
	};
	const limb = (x1, y1, x2, y2, w, c) => {
		ctx.strokeStyle = c;
		ctx.lineWidth = w;
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	};
	ctx.save();
	ctx.translate(x, y);
	ctx.lineCap = "round";
	ctx.fillStyle = "rgba(0,0,0,.25)";
	ctx.beginPath();
	ctx.ellipse(0, 0, .7 * s, .25 * s, 0, 0, Math.PI * 2);
	ctx.fill();
	if (act === "sleeping") {
		ctx.fillStyle = "#cbd5e1";
		ctx.beginPath();
		ctx.roundRect(-1.3 * s, -.9 * s, 2.6 * s, 1 * s, .2 * s);
		ctx.fill();
		ctx.fillStyle = ap.outfit;
		ctx.beginPath();
		ctx.roundRect(-.5 * s, -.95 * s, 1.7 * s, .7 * s, .3 * s);
		ctx.fill();
		ctx.fillStyle = ap.skin;
		dot(-.85 * s, -.65 * s, .38 * s);
		ctx.fillStyle = ap.hair;
		ctx.beginPath();
		ctx.arc(-.85 * s, -.65 * s, .4 * s, Math.PI * .6, Math.PI * 1.6);
		ctx.fill();
		ctx.fillStyle = "#e2e8f0";
		ctx.font = `${.8 * s}px sans-serif`;
		ctx.textAlign = "center";
		for (let i = 0; i < 3; i++) ctx.fillText("z", -.4 * s + i * .5 * s, -1.3 * s - (t * .5 + i * .33) % 1 * .9 * s);
		ctx.restore();
		return;
	}
	const phase = t * 9;
	const swing = p.moving ? Math.sin(phase) : 0;
	const bob = p.moving ? Math.abs(Math.sin(phase)) * .12 * s : Math.sin(t * 2 + x) * .04 * s;
	if (act === "relaxing" && !p.moving) ctx.rotate(Math.sin(t * 1.5) * .05);
	for (const d of [-1, 1]) {
		const sw = swing * d;
		limb(d * .2 * s, -.95 * s - bob, d * .2 * s + sw * .35 * s, -Math.max(0, sw) * .2 * s, .32 * s, ap.pants);
	}
	ctx.fillStyle = ap.outfit;
	ctx.beginPath();
	ctx.roundRect(-.42 * s, -2.05 * s - bob, .84 * s, 1.1 * s, .2 * s);
	ctx.fill();
	const home = a.locationId === a.homeId && !p.moving;
	const kind = home ? "casual" : /Bác sĩ|Điều dưỡng/.test(a.job) ? "coat" : /Bếp|Chủ quán|Quản lý/.test(a.job) ? "apron" : /Giáo viên/.test(a.job) ? "tie" : "casual";
	if (p.rain) {
		ctx.fillStyle = "#facc15";
		ctx.beginPath();
		ctx.roundRect(-.46 * s, -2.08 * s - bob, .92 * s, 1.3 * s, .2 * s);
		ctx.fill();
	} else if (kind === "coat") {
		ctx.fillStyle = "#f8fafc";
		ctx.beginPath();
		ctx.roundRect(-.46 * s, -2.08 * s - bob, .92 * s, 1.5 * s, .15 * s);
		ctx.fill();
	} else if (kind === "apron") {
		ctx.fillStyle = "#f1f5f9";
		ctx.fillRect(-.3 * s, -1.7 * s - bob, .6 * s, .75 * s);
	} else if (kind === "tie") {
		ctx.fillStyle = "#b91c1c";
		ctx.fillRect(-.06 * s, -2 * s - bob, .12 * s, .6 * s);
	}
	if (act === "working" && !p.moving) {
		ctx.fillStyle = `rgba(125,200,255,${.18 + .1 * Math.sin(t * 3)})`;
		dot(0, -1.3 * s, .9 * s);
		ctx.fillStyle = "#334155";
		ctx.fillRect(-.45 * s, -1.55 * s, .9 * s, .5 * s);
		ctx.fillStyle = "#94a3b8";
		ctx.fillRect(-.55 * s, -1.05 * s, 1.1 * s, .1 * s);
	}
	if (act === "eating" && !p.moving) {
		ctx.fillStyle = "#f8fafc";
		ctx.beginPath();
		ctx.ellipse(.85 * s, -.5 * s, .4 * s, .15 * s, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#f97316";
		dot(.85 * s, -.55 * s, .1 * s);
	}
	let hl = [-.55 * s, -1 * s - bob];
	let hr = [.55 * s, -1 * s - bob];
	if (p.moving) {
		hl = [-.5 * s, -1.1 * s - bob + swing * .4 * s];
		hr = [.5 * s, -1.1 * s - bob - swing * .4 * s];
	} else if (act === "working") {
		hl = [-.25 * s, -1.1 * s + Math.sin(t * 14) * .1 * s];
		hr = [.25 * s, -1.1 * s + Math.sin(t * 14 + 2) * .1 * s];
	} else if (act === "eating" || act === "drinking") hr = [.25 * s, -2.25 * s - bob + Math.sin(t * 5) * .1 * s];
	else if (p.speaking || act === "socializing") hr = [.7 * s, -1.7 * s + Math.sin(t * 6) * .25 * s];
	if (act === "shopping") {
		ctx.fillStyle = "#f59e0b";
		ctx.fillRect(hl[0] - .25 * s, hl[1], .5 * s, .45 * s);
	}
	if (act === "drinking") {
		ctx.fillStyle = "#e2e8f0";
		ctx.fillRect(hr[0] - .08 * s, hr[1] - .25 * s, .16 * s, .25 * s);
	}
	for (const [sx, h] of [[-.45, hl], [.45, hr]]) {
		limb(sx * s, -1.95 * s - bob, h[0], h[1], .24 * s, ap.outfit);
		ctx.fillStyle = ap.skin;
		dot(h[0], h[1], .13 * s);
	}
	const hy = -2.55 * s - bob - (p.speaking ? Math.abs(Math.sin(t * 10)) * .04 * s : 0);
	if (ap.hairStyle === "long" || ap.hairStyle === "bob") {
		ctx.fillStyle = ap.hair;
		ctx.beginPath();
		ctx.roundRect(-.48 * s, hy - .1 * s, .96 * s, (ap.hairStyle === "long" ? 1 : .6) * s, .2 * s);
		ctx.fill();
	}
	ctx.fillStyle = back ? ap.hair : ap.skin;
	dot(0, hy, .42 * s);
	ctx.fillStyle = ap.hair;
	ctx.beginPath();
	ctx.arc(0, hy, .46 * s, Math.PI, 0);
	ctx.fill();
	if (ap.hairStyle === "bun") dot(0, hy - .55 * s, .2 * s);
	if (ap.hairStyle === "spiky") for (let i = -2; i <= 2; i++) {
		ctx.beginPath();
		ctx.moveTo(i * .18 * s - .1 * s, hy - .35 * s);
		ctx.lineTo(i * .18 * s, hy - .75 * s);
		ctx.lineTo(i * .18 * s + .1 * s, hy - .35 * s);
		ctx.fill();
	}
	if (!home && /Bếp/.test(a.job)) {
		ctx.fillStyle = "#f8fafc";
		ctx.beginPath();
		ctx.roundRect(-.36 * s, hy - .95 * s, .72 * s, .6 * s, .2 * s);
		ctx.fill();
	}
	const mk = p.mood && p.mood.value > 25 ? p.mood.key : void 0;
	const sad = mk === "sadness" || mk === "loneliness" || mk === "disappointment";
	const glad = mk === "joy" || mk === "love" || mk === "hope";
	if (!back) {
		const ex = fx * .08 * s;
		const blink = (t * .8 + x * .013) % 4 < .12;
		for (const d of [-1, 1]) {
			const bx = d * .15 * s + ex;
			ctx.strokeStyle = "#111827";
			ctx.fillStyle = "#111827";
			ctx.lineWidth = .035 * s;
			if (blink) limb(bx - .05 * s, hy + .04 * s, bx + .05 * s, hy + .04 * s, .035 * s, "#111827");
			else if (mk === "joy") {
				ctx.beginPath();
				ctx.arc(bx, hy + .06 * s, .06 * s, Math.PI, 0);
				ctx.stroke();
			} else dot(bx, hy + .03 * s, .05 * s);
			const tilt = mk === "anger" ? .06 : sad || mk === "anxiety" ? -.06 : 0;
			const lift = mk === "anxiety" ? .05 : 0;
			limb(bx - d * .1 * s, hy + (-.14 - lift + tilt) * s, bx + d * .1 * s, hy + (-.14 - lift - tilt) * s, .035 * s, ap.hair);
			if (sad && d === -1) {
				ctx.fillStyle = "#7dd3fc";
				dot(bx, hy + (.1 + t * .6 % 1 * .25) * s, .035 * s);
			}
			if (mk === "shame" || mk === "love") {
				ctx.fillStyle = "rgba(244,114,182,.4)";
				dot(d * .27 * s + ex, hy + .14 * s, .08 * s);
			}
			if (ap.glasses) {
				ctx.strokeStyle = "#334155";
				ctx.lineWidth = .04 * s;
				ctx.beginPath();
				ctx.arc(bx, hy + .03 * s, .12 * s, 0, Math.PI * 2);
				ctx.stroke();
			}
		}
		const my = hy + .22 * s;
		ctx.strokeStyle = "#7f1d1d";
		ctx.fillStyle = "#7f1d1d";
		ctx.lineWidth = .035 * s;
		if (p.speaking) {
			ctx.beginPath();
			ctx.ellipse(ex, my, .08 * s, (.03 + .05 * Math.abs(Math.sin(t * 12))) * s, 0, 0, Math.PI * 2);
			ctx.fill();
		} else if (glad) {
			ctx.beginPath();
			ctx.arc(ex, my - .05 * s, .11 * s, Math.PI * .1, Math.PI * .9);
			ctx.stroke();
		} else if (sad || mk === "shame") {
			ctx.beginPath();
			ctx.arc(ex, my + .1 * s, .1 * s, Math.PI * 1.15, Math.PI * 1.85);
			ctx.stroke();
		} else if (mk === "anxiety") {
			ctx.beginPath();
			ctx.ellipse(ex, my, .05 * s, .06 * s, 0, 0, Math.PI * 2);
			ctx.fill();
		} else if (mk === "jealousy") limb(ex - .1 * s, my, ex + .1 * s, my - .05 * s, .035 * s, "#7f1d1d");
		else limb(ex - .07 * s, my, ex + .07 * s, my, .035 * s, "#7f1d1d");
	}
	if (p.rain) {
		ctx.fillStyle = "#2563eb";
		ctx.beginPath();
		ctx.arc(0, hy - .5 * s, .95 * s, Math.PI, 0);
		ctx.fill();
	} else if (p.badge !== false && p.mood && p.mood.value > 35 && MOOD[p.mood.key]) {
		ctx.font = `${1 * s}px sans-serif`;
		ctx.textAlign = "center";
		ctx.fillText(MOOD[p.mood.key] ?? "", 0, hy - .8 * s);
	}
	ctx.restore();
}
//#endregion
//#region src/sim/util.ts
function clamp(n, a = 0, b = 100) {
	if (Number.isNaN(n)) return a;
	return Math.max(a, Math.min(b, n));
}
function rng(world) {
	let a = world.rngState >>> 0;
	a = a + 1831565813 >>> 0;
	let t = Math.imul(a ^ a >>> 15, a | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	world.rngState = a;
	return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function pick(world, items) {
	return items[Math.floor(rng(world) * items.length)];
}
function clock(minute) {
	const day = Math.floor(minute / 1440);
	const mod = (minute % 1440 + 1440) % 1440;
	return {
		day,
		dayIndex: (day % 7 + 7) % 7,
		hour: Math.floor(mod / 60),
		minute: mod % 60,
		abs: minute
	};
}
var WEEKDAYS = [
	"Thứ Hai",
	"Thứ Ba",
	"Thứ Tư",
	"Thứ Năm",
	"Thứ Sáu",
	"Thứ Bảy",
	"Chủ Nhật"
];
function formatClock(minute) {
	const c = clock(minute);
	const hh = String(c.hour).padStart(2, "0");
	const mm = String(c.minute).padStart(2, "0");
	return `${WEEKDAYS[c.dayIndex]} · Ngày ${c.day + 1} · ${hh}:${mm}`;
}
function pairKey(a, b) {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function emptyDir() {
	return {
		familiarity: 0,
		trust: 0,
		respect: 0,
		affection: 0,
		attraction: 0,
		bond: 0,
		conflict: 0,
		commitment: 0
	};
}
function agent(world, id) {
	const found = world.agents.find((a) => a.id === id);
	if (!found) throw new Error(`missing agent ${id}`);
	return found;
}
function directed(rel, fromId) {
	if (rel.aId === fromId) return rel.aToB;
	if (rel.bId === fromId) return rel.bToA;
	throw new Error("directed");
}
var EMOTION_LABEL = {
	joy: "Vui",
	sadness: "Buồn",
	anger: "Tức giận",
	anxiety: "Lo lắng",
	jealousy: "Ghen",
	shame: "Xấu hổ",
	loneliness: "Cô đơn",
	disappointment: "Thất vọng",
	hope: "Hy vọng",
	love: "Yêu thương"
};
function dominantEmotion(emotions) {
	let key = "joy";
	let value = -1;
	for (const k of Object.keys(emotions)) if (emotions[k] > value) {
		value = emotions[k];
		key = k;
	}
	return {
		key,
		label: EMOTION_LABEL[key],
		value
	};
}
function activityLabel(a) {
	return {
		idle: "Ở nhà",
		walking: "Đang đi",
		working: "Đang làm việc",
		eating: "Đang ăn",
		drinking: "Đang uống",
		sleeping: "Đang ngủ",
		relaxing: "Đang nghỉ",
		shopping: "Đang mua sắm",
		socializing: "Đang trò chuyện",
		seeking: "Đang tìm một người",
		treatment: "Đang được khám"
	}[a.activity];
}
//#endregion
//#region src/lib/room.ts
var SETS = {
	home: [
		["bed", .2],
		["tv", .52],
		["sofa", .55],
		["table", .8],
		["plant", .95]
	],
	cafe: [
		["counter", .25],
		["coffee", .18],
		["table", .6],
		["table", .85],
		["plant", .97]
	],
	restaurant: [
		["counter", .18],
		["table", .55],
		["table", .8]
	],
	market: [
		["shelf", .2],
		["shelf", .45],
		["counter", .8],
		["plant", .97]
	],
	office: [
		["desk", .2],
		["desk", .5],
		["desk", .8],
		["shelf", .97]
	],
	school: [
		["board", .4],
		["desk", .2],
		["desk", .45],
		["desk", .7]
	],
	mall: [
		["shelf", .2],
		["shelf", .45],
		["plant", .55],
		["counter", .8]
	],
	hospital: [
		["bed", .2],
		["bed", .55],
		["counter", .88]
	],
	park: [
		["tree", .15],
		["bench", .5],
		["fountain", .8],
		["tree", .93]
	]
};
var FLOOR = {
	home: "#b88a5a",
	cafe: "#8a6240",
	restaurant: "#6b4a3a",
	market: "#cfd3d6",
	office: "#9aa3ad",
	school: "#c9b28a",
	mall: "#d9cdbd",
	hospital: "#e5ecef",
	park: "#6aa86a"
};
var WANT = {
	sleeping: ["bed"],
	working: [
		"desk",
		"counter",
		"board"
	],
	eating: ["table", "counter"],
	drinking: ["table", "counter"],
	relaxing: [
		"sofa",
		"bench",
		"table"
	],
	treatment: ["bed"]
};
var BOOKS = [
	"#ef4444",
	"#3b82f6",
	"#eab308",
	"#22c55e"
];
function item(c, type, x, y, k, t) {
	const R = (dx, dy, w, h, col) => {
		c.fillStyle = col;
		c.fillRect(x + dx * k, y + dy * k, w * k, h * k);
	};
	const O = (dx, dy, r, col) => {
		c.fillStyle = col;
		c.beginPath();
		c.arc(x + dx * k, y + dy * k, r * k, 0, Math.PI * 2);
		c.fill();
	};
	const glow = `rgba(125,200,255,${.55 + .15 * Math.sin(t * 3 + x)})`;
	switch (type) {
		case "bed":
			R(-1.3, -.45, 2.6, .45, "#7c5a3a");
			R(-1.3, -1, .12, 1, "#5b3f27");
			R(-1.2, -.7, 2.4, .3, "#e2e8f0");
			R(-.2, -.72, 1.4, .32, "#60a5fa");
			R(-1.15, -.8, .5, .2, "#fff");
			break;
		case "sofa":
			R(-1, -1, 2, .6, "#a1626b");
			R(-1, -.55, 2, .4, "#c07c86");
			R(-1.1, -.7, .2, .7, "#8c4f58");
			R(.9, -.7, .2, .7, "#8c4f58");
			break;
		case "tv":
			R(-.9, -.45, 1.8, .45, "#6b4a3a");
			R(-.7, -1.3, 1.4, .85, "#0f172a");
			R(-.62, -1.22, 1.24, .69, glow);
			break;
		case "table":
			R(-.9, -.7, 1.8, .12, "#92400e");
			R(-.8, -.58, .1, .58, "#78350f");
			R(.7, -.58, .1, .58, "#78350f");
			O(.3, -.78, .1, "#f8fafc");
			break;
		case "counter":
			R(-1.4, -.9, 2.8, .9, "#6b4a3a");
			R(-1.45, -.95, 2.9, .1, "#d6c3a5");
			break;
		case "coffee":
			R(-.3, -1.5, .6, .55, "#374151");
			O(0, -1.3, .05, "#ef4444");
			break;
		case "desk":
			R(-1, -.75, 2, .1, "#d6c3a5");
			R(-.9, -.65, .1, .65, "#94a3b8");
			R(.8, -.65, .1, .65, "#94a3b8");
			R(-.35, -1.3, .7, .5, "#0f172a");
			R(-.3, -1.25, .6, .4, glow);
			break;
		case "shelf":
			R(-.8, -2, 1.6, 2, "#8b5e3c");
			for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) R(-.7 + q * .37, -1.85 + r * .62, .3, .5, BOOKS[(r + q) % 4] ?? "#888");
			break;
		case "plant":
			R(-.2, -.4, .4, .4, "#b45309");
			O(0, -.75, .4, "#16a34a");
			break;
		case "board":
			R(-1.5, -2.4, 3, 1.2, "#14532d");
			break;
		case "tree":
			R(-.15, -1.6, .3, 1.6, "#78350f");
			O(0, -2.1, .9, "#15803d");
			break;
		case "bench":
			R(-1, -.95, 2, .1, "#92400e");
			R(-1, -.5, 2, .1, "#92400e");
			R(-.9, -.4, .1, .4, "#78350f");
			R(.8, -.4, .1, .4, "#78350f");
			break;
		case "fountain":
			c.fillStyle = "#94a3b8";
			c.beginPath();
			c.ellipse(x, y - .2 * k, 1.1 * k, .3 * k, 0, 0, Math.PI * 2);
			c.fill();
			c.fillStyle = "#7dd3fc";
			c.beginPath();
			c.ellipse(x, y - .25 * k, .9 * k, .22 * k, 0, 0, Math.PI * 2);
			c.fill();
			for (let i = 0; i < 3; i++) O(Math.sin(t * 3 + i) * .1, -.6 - (t * 1.5 + i / 3) % 1 * .6, .05, "#bae6fd");
	}
}
/** Cutaway view of the room `loc` with its furniture and the characters currently inside. */
function drawRoom(c, W, H, w, loc, t, sel) {
	const hour = w.minute / 60 % 24;
	const night = hour >= 19 || hour < 6;
	const dusk = hour >= 17 && hour < 19 || hour >= 6 && hour < 8;
	const sky = w.weather === "rain" ? "#64748b" : night ? "#0b1230" : dusk ? "#f59e6b" : "#8ec9f5";
	const k = W / 10;
	const fy = H * .7;
	const out = loc.kind === "park";
	c.fillStyle = out ? sky : loc.build?.wall ?? "#e5e7eb";
	c.fillRect(0, 0, W, fy);
	c.fillStyle = FLOOR[loc.kind];
	c.fillRect(0, fy, W, H - fy);
	const [wx, wy, ww, wh] = out ? [
		0,
		0,
		W,
		fy
	] : [
		W * .72,
		H * .08,
		2.2 * k,
		1.6 * k
	];
	if (!out) {
		c.fillStyle = "#475569";
		c.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
		c.fillStyle = sky;
		c.fillRect(wx, wy, ww, wh);
	}
	if (w.weather === "rain") {
		c.strokeStyle = "rgba(200,220,255,.6)";
		c.lineWidth = 1;
		for (let i = 0; i < 30; i++) {
			const x = wx + i * 83 % ww;
			const y = wy + (i * 47 + t * 200) % wh;
			c.beginPath();
			c.moveTo(x, y);
			c.lineTo(x - 2, y + 7);
			c.stroke();
		}
	}
	const base = fy + (H - fy) * .5;
	for (const [type, fx] of SETS[loc.kind]) item(c, type, fx * W, base, k, t);
	if (night) {
		c.fillStyle = "rgba(15,23,42,.35)";
		c.fillRect(0, 0, W, H);
	}
	const here = w.agents.filter((a) => a.alive && a.locationId === loc.id && !a.travel);
	const talking = new Set(w.lines.slice(-8).filter((l) => w.minute - l.minute <= 20).map((l) => l.speakerId));
	const used = {};
	const u = Math.min(k * .8, 26);
	here.forEach((a, i) => {
		let x = (i + 1) / (here.length + 1) * W;
		let y = base + (H - fy) * .3;
		for (const type of WANT[a.activity] ?? []) {
			const it = SETS[loc.kind].find(([n]) => n === type);
			if (!it) continue;
			const n = used[type] ?? 0;
			used[type] = n + 1;
			x = it[1] * W + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * k * .9;
			y = a.activity === "sleeping" ? base : base + (H - fy) * .2;
			break;
		}
		if (a.id === sel) {
			c.strokeStyle = "#facc15";
			c.lineWidth = 2;
			c.beginPath();
			c.ellipse(x, y, u * 1.1, u * .4, 0, 0, Math.PI * 2);
			c.stroke();
		}
		drawAgent(c, a, x, y, u, {
			t,
			moving: false,
			fx: 0,
			fz: 1,
			speaking: talking.has(a.id),
			mood: dominantEmotion(a.emotions)
		});
		c.font = "11px sans-serif";
		c.textAlign = "center";
		c.fillStyle = night ? "#e2e8f0" : "#0f172a";
		c.fillText(a.given, x, Math.min(H - 3, y + 14));
	});
	c.font = "12px sans-serif";
	c.textAlign = "left";
	c.fillStyle = night ? "#e2e8f0" : "#0f172a";
	c.fillText(loc.name, 8, 16);
}
//#endregion
//#region src/sim/data.ts
var ROADS_X = [
	-24,
	-12,
	0,
	14,
	28,
	42
];
var ROADS_Z = [
	-18,
	-6,
	8,
	20
];
var MAP = {
	minX: -50,
	maxX: 58,
	minZ: -40,
	maxZ: 40
};
var LOCATIONS = [
	{
		id: "home_linh",
		name: "Nhà Linh",
		kind: "home",
		x: -24,
		z: -18,
		gather: .85,
		blurb: "Căn nhà nhỏ nhìn ra vườn, cửa sổ hay để mở.",
		build: {
			ox: -5.2,
			oz: -4.2,
			w: 4.2,
			d: 3.6,
			h: 2.8,
			wall: "#e4d2b8",
			roof: "#8a4b3c"
		}
	},
	{
		id: "home_minh",
		name: "Nhà Minh",
		kind: "home",
		x: -24,
		z: -6,
		gather: .85,
		blurb: "Studio gọn, kệ đĩa nhạc sát cửa sổ.",
		build: {
			ox: -5.2,
			oz: .2,
			w: 4.4,
			d: 3.8,
			h: 3.15,
			wall: "#d7c6ae",
			roof: "#6e5344"
		}
	},
	{
		id: "home_ha",
		name: "Nhà Hà",
		kind: "home",
		x: -24,
		z: 8,
		gather: .85,
		blurb: "Nhiều sách và một bậu cửa để mèo ngồi.",
		build: {
			ox: -5.2,
			oz: -.4,
			w: 4,
			d: 3.5,
			h: 2.7,
			wall: "#efe2cc",
			roof: "#8d5a49"
		}
	},
	{
		id: "home_khoa",
		name: "Nhà Khoa",
		kind: "home",
		x: -24,
		z: 20,
		gather: .85,
		blurb: "Nhà yên, giày chạy luôn để sẵn ở hiên.",
		build: {
			ox: -5.2,
			oz: 4,
			w: 4.5,
			d: 3.7,
			h: 3,
			wall: "#ddd4c6",
			roof: "#5e5148"
		}
	},
	{
		id: "home_mai",
		name: "Nhà Mai",
		kind: "home",
		x: -12,
		z: -18,
		gather: .85,
		blurb: "Căn hộ sáng, gương lớn và giá treo đồ.",
		build: {
			ox: -5,
			oz: -4.2,
			w: 3.8,
			d: 3.4,
			h: 2.65,
			wall: "#f0d7c8",
			roof: "#7a4038"
		}
	},
	{
		id: "home_duc",
		name: "Nhà Đức",
		kind: "home",
		x: -12,
		z: -6,
		gather: .85,
		blurb: "Bếp chiếm nửa nhà. Mùi gia vị không bao giờ tắt.",
		build: {
			ox: -5,
			oz: .4,
			w: 4.3,
			d: 3.7,
			h: 2.9,
			wall: "#e7c8a4",
			roof: "#6a3b32"
		}
	},
	{
		id: "home_an",
		name: "Nhà An",
		kind: "home",
		x: -12,
		z: 8,
		gather: .85,
		blurb: "Rèm dày, bàn đặt máy ảnh và một ghế bên cửa sổ.",
		build: {
			ox: -5,
			oz: -.2,
			w: 3.7,
			d: 3.4,
			h: 2.75,
			wall: "#d9d3c8",
			roof: "#4e5854"
		}
	},
	{
		id: "home_chi",
		name: "Nhà Chi",
		kind: "home",
		x: -12,
		z: 20,
		gather: .85,
		blurb: "Nhà sạch, một lọ hoa hay đổi theo tuần.",
		build: {
			ox: -5,
			oz: 4,
			w: 4,
			d: 3.5,
			h: 2.8,
			wall: "#f3e6d4",
			roof: "#8b5a4a"
		}
	},
	{
		id: "cafe",
		name: "Café Sương",
		kind: "cafe",
		x: 0,
		z: -6,
		gather: 1.35,
		blurb: "Quán cà phê góc phố. Cuối quầy luôn có hướng dương.",
		build: {
			ox: .2,
			oz: -6.4,
			w: 7.2,
			d: 5,
			h: 3.3,
			wall: "#c46b4a",
			roof: "#6e3b32",
			awning: true
		}
	},
	{
		id: "park",
		name: "Công viên Hướng Dương",
		kind: "park",
		x: 0,
		z: 8,
		gather: 2.5,
		blurb: "Bãi cỏ, ghế đá và một đài phun nước thấp."
	},
	{
		id: "restaurant",
		name: "Nhà hàng Đêm",
		kind: "restaurant",
		x: 14,
		z: -6,
		gather: 1.3,
		blurb: "Bếp mở, đèn ấm. Món thay đổi theo người đứng bếp.",
		build: {
			ox: .4,
			oz: -6.3,
			w: 6.6,
			d: 5.1,
			h: 3.35,
			wall: "#a65448",
			roof: "#4a2e2c",
			awning: true
		}
	},
	{
		id: "market",
		name: "Siêu thị Sen",
		kind: "market",
		x: 14,
		z: 8,
		gather: 1.4,
		blurb: "Kệ thực phẩm, hoa và đồ lặt vặt cuối ngày.",
		build: {
			ox: 6.2,
			oz: .2,
			w: 8.2,
			d: 5.4,
			h: 3.5,
			wall: "#6e8f86",
			roof: "#314842"
		}
	},
	{
		id: "school",
		name: "Trường Bình Minh",
		kind: "school",
		x: 28,
		z: -18,
		gather: 1.5,
		blurb: "Sân gạch và hành lang dài. Chiều thường vắng.",
		build: {
			ox: 6.4,
			oz: -4.2,
			w: 9.2,
			d: 6,
			h: 3.7,
			wall: "#e2c56e",
			roof: "#8a6232"
		}
	},
	{
		id: "office",
		name: "Văn phòng Ánh",
		kind: "office",
		x: 28,
		z: -6,
		gather: 1.35,
		blurb: "Khối nhà kính, đèn màn hình còn sáng khá khuya.",
		build: {
			ox: 6.3,
			oz: 0,
			w: 6.2,
			d: 6.2,
			h: 8.2,
			wall: "#8aa0ad",
			roof: "#31424c",
			floors: 3
		}
	},
	{
		id: "mall",
		name: "Trung tâm Lotus",
		kind: "mall",
		x: 28,
		z: 20,
		gather: 1.6,
		blurb: "Trung tâm thương mại nhỏ: thời trang, nhạc, quà.",
		build: {
			ox: 6.6,
			oz: 3.6,
			w: 10.4,
			d: 7,
			h: 4.4,
			wall: "#cbb7a4",
			roof: "#5c5148",
			floors: 2
		}
	},
	{
		id: "hospital",
		name: "Bệnh viện An Tâm",
		kind: "hospital",
		x: 42,
		z: 8,
		gather: 1.55,
		blurb: "Sảnh trắng, trực ngày và trực tối.",
		build: {
			ox: 6.5,
			oz: .2,
			w: 8.4,
			d: 6.2,
			h: 5.2,
			wall: "#e7efe9",
			roof: "#6d8f8a",
			floors: 2
		}
	}
];
function location(id) {
	const found = LOCATIONS.find((l) => l.id === id);
	if (!found) throw new Error(`missing location ${id}`);
	return found;
}
var T = (p) => p;
function fact(key, value, intimacy, gift) {
	return {
		key,
		value,
		intimacy,
		gift
	};
}
var SEEDS = [
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
		traits: T({
			extroversion: 58,
			warmth: 82,
			temper: 24,
			humor: 64,
			confidence: 48,
			romance: 76,
			selfishness: 18,
			kindness: 86,
			jealousy: 34,
			trustBarrier: 38
		}),
		facts: [
			fact("sunflower", "thích hoa hướng dương", 1, {
				item: "sunflower",
				label: "một bó hướng dương",
				place: "cafe",
				cost: 24
			}),
			fact("storm", "sợ giông và tiếng sấm", 2),
			fact("second-cafe", "muốn mở một quán thứ hai, nhỏ hơn, chỉ bán bánh và hoa", 3)
		],
		bio: "Mở quán vì thích nhìn người ta nán lại thêm một chút.",
		routine: "Mở Café Sương gần như cả tuần, nghỉ Chủ Nhật. Chiều thường còn nán lại dọn hoa.",
		family: "Bố mẹ ở Hội An. Gọi về mỗi Chủ Nhật, không phải lúc nào cũng kể thật.",
		dream: "Một quán nhỏ hơn, chỉ bán bánh và hoa",
		appearance: {
			skin: "#e0b08a",
			hair: "#2a211c",
			outfit: "#f2d3a2",
			pants: "#6b4a3a",
			hairStyle: "bun",
			height: 1
		}
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
		traits: T({
			extroversion: 70,
			warmth: 52,
			temper: 42,
			humor: 84,
			confidence: 76,
			romance: 48,
			selfishness: 58,
			kindness: 50,
			jealousy: 28,
			trustBarrier: 32
		}),
		facts: [
			fact("jazz", "thích jazz và đĩa than", 1, {
				item: "jazz",
				label: "một đĩa jazz",
				place: "mall",
				cost: 46
			}),
			fact("night", "hay thức khuya vì code, dù sáng hôm sau hay hối", 2),
			fact("house", "muốn mua một căn nhà không phải đi thuê", 3)
		],
		bio: "Nói nhanh khi đùa, im khi chuyện trở nên thật.",
		routine: "Văn phòng Ánh các ngày trong tuần, 9 giờ đến 18 giờ. Tối đôi khi ghé quán.",
		family: "Em gái đang học ở Đà Nẵng. Minh gửi tiền đều, ít hỏi han.",
		dream: "Mua được nhà trước năm 35 tuổi",
		appearance: {
			skin: "#c98a62",
			hair: "#1c1a1a",
			outfit: "#2f3d52",
			pants: "#24282e",
			hairStyle: "short",
			height: 1.06
		}
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
		traits: T({
			extroversion: 24,
			warmth: 88,
			temper: 14,
			humor: 42,
			confidence: 30,
			romance: 82,
			selfishness: 12,
			kindness: 92,
			jealousy: 22,
			trustBarrier: 56
		}),
		facts: [
			fact("poetry", "thích thơ và hay chép lại câu mình nhớ", 1, {
				item: "poetry",
				label: "một tập thơ",
				place: "mall",
				cost: 32
			}),
			fact("cats", "nuôi một con mèo tên Mít, dù ít khi khoe", 1, {
				item: "cat",
				label: "đồ ăn cho mèo",
				place: "market",
				cost: 18
			}),
			fact("family", "muốn một gia đình yên, không cần đông", 3)
		],
		bio: "Dạy văn ban ngày. Chiều thích ngồi chỗ ít người.",
		routine: "Dạy ở Trường Bình Minh các ngày trong tuần. Chiều thường ra công viên một mình.",
		family: "Ở với mẹ đến năm ngoái. Mẹ vẫn gọi mỗi tối.",
		dream: "Viết một tập truyện thật mỏng và in nó",
		appearance: {
			skin: "#efc2a0",
			hair: "#3a241c",
			outfit: "#d9e2d2",
			pants: "#5d6a62",
			hairStyle: "long",
			height: .96
		}
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
		traits: T({
			extroversion: 40,
			warmth: 46,
			temper: 18,
			humor: 32,
			confidence: 74,
			romance: 26,
			selfishness: 30,
			kindness: 68,
			jealousy: 14,
			trustBarrier: 48
		}),
		facts: [
			fact("running", "chạy bộ mỗi khi đầu óc quá tải", 1, {
				item: "running",
				label: "đôi giày chạy",
				place: "mall",
				cost: 70
			}),
			fact("paper", "đang viết một bài nghiên cứu và hay bị trực làm gián đoạn", 2),
			fact("quiet", "không thích nói chuyện xã giao cho có", 2)
		],
		bio: "Ít lời. Tin vào việc làm hơn là lời hứa.",
		routine: "Bệnh viện An Tâm. Một số ngày trực muộn đến tối. Chủ Nhật ở nhà.",
		family: "Bố từng là bác sĩ. Khoa không thích bị so sánh.",
		dream: "Xuất bản bài nghiên cứu đang viết dở",
		appearance: {
			skin: "#d7a57c",
			hair: "#2c2420",
			outfit: "#e8f0f2",
			pants: "#3d4c55",
			hairStyle: "short",
			height: 1.08,
			glasses: true
		}
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
		traits: T({
			extroversion: 86,
			warmth: 60,
			temper: 66,
			humor: 74,
			confidence: 82,
			romance: 72,
			selfishness: 60,
			kindness: 42,
			jealousy: 82,
			trustBarrier: 28
		}),
		facts: [
			fact("fashion", "để ý quần áo của người khác trước cả khuôn mặt", 1, {
				item: "fashion",
				label: "một chiếc khăn lụa",
				place: "mall",
				cost: 40
			}),
			fact("photo", "thích được chụp, và cũng thích đứng sau máy", 1, {
				item: "film",
				label: "một cuộn film",
				place: "mall",
				cost: 28
			}),
			fact("ordinary", "sợ mình trở thành người bình thường đến mức không ai nhớ", 3)
		],
		bio: "Nói to khi vui, nói sắc khi tổn thương.",
		routine: "Trung tâm Lotus từ 10 giờ đến 19 giờ, nghỉ Thứ Hai. Tối thích chỗ đông.",
		family: "Cha mẹ ly hôn từ khi Mai 16. Ở với dì một thời gian.",
		dream: "Có một thương hiệu nhỏ mang tên mình",
		appearance: {
			skin: "#e8b896",
			hair: "#1a120f",
			outfit: "#d85a4a",
			pants: "#2b2428",
			hairStyle: "bob",
			height: 1.02
		}
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
		traits: T({
			extroversion: 80,
			warmth: 78,
			temper: 54,
			humor: 86,
			confidence: 66,
			romance: 62,
			selfishness: 32,
			kindness: 74,
			jealousy: 44,
			trustBarrier: 24
		}),
		facts: [
			fact("cooking", "tin rằng nấu cho ai là một cách nói thương", 1, {
				item: "spice",
				label: "một hũ gia vị hiếm",
				place: "market",
				cost: 30
			}),
			fact("recipe", "giữ vài công thức của mẹ và chưa đưa cho ai", 2),
			fact("own-place", "muốn có nhà hàng mang tên mình, không còn làm thuê", 3)
		],
		bio: "Cười lớn. Dễ tha thứ, trừ khi đụng đến bếp.",
		routine: "Nhà hàng Đêm từ 11 giờ đến 21 giờ, nghỉ Thứ Ba. Hay mời người ta nếm thử.",
		family: "Mẹ ở quê. Đức gửi món ăn về mỗi khi có người đi nhờ.",
		dream: "Nhà hàng mang tên mình",
		appearance: {
			skin: "#c68658",
			hair: "#3a2718",
			outfit: "#f4f1ea",
			pants: "#4a342c",
			hairStyle: "spiky",
			height: 1.05
		}
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
		traits: T({
			extroversion: 20,
			warmth: 64,
			temper: 18,
			humor: 46,
			confidence: 26,
			romance: 58,
			selfishness: 18,
			kindness: 78,
			jealousy: 18,
			trustBarrier: 84
		}),
		facts: [
			fact("rain", "thích đi bộ lúc trời mưa", 1, {
				item: "umbrella",
				label: "một chiếc ô màu trầm",
				place: "mall",
				cost: 26
			}),
			fact("filmcam", "chỉ tin máy film, vì mỗi khung hình phải trả giá", 1, {
				item: "film",
				label: "một cuộn film",
				place: "mall",
				cost: 28
			}),
			fact("trust", "từng bị bạn thân phản bội nên rất chậm tin người mới", 3)
		],
		bio: "Nhận việc chụp để trả nhà. Phần còn lại của ngày thường im.",
		routine: "Hay ngồi làm ở Café Sương. Thứ Sáu chiều có mặt ở Lotus. Nghỉ Chủ Nhật và Thứ Năm.",
		family: "Anh trai sống xa, nhắn tin nhiều hơn nói chuyện.",
		dream: "Một triển lãm ảnh nhỏ, dù chỉ một căn phòng",
		appearance: {
			skin: "#e6c3a4",
			hair: "#4a3428",
			outfit: "#6e7c86",
			pants: "#2e3338",
			hairStyle: "bob",
			height: .98,
			glasses: true
		}
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
		traits: T({
			extroversion: 52,
			warmth: 84,
			temper: 34,
			humor: 50,
			confidence: 56,
			romance: 86,
			selfishness: 22,
			kindness: 82,
			jealousy: 70,
			trustBarrier: 44
		}),
		facts: [
			fact("sunflower", "thích hoa hướng dương từ hồi còn đi học", 1, {
				item: "sunflower",
				label: "một bó hướng dương",
				place: "cafe",
				cost: 24
			}),
			fact("notice", "để ý những thay đổi rất nhỏ ở người khác", 2),
			fact("clinic", "muốn mở một phòng khám nhỏ cho khu phố, không nói với đồng nghiệp", 3)
		],
		bio: "Chăm người khác rất tự nhiên. Chậm nhận ra mình đang cần gì.",
		routine: "Ca sáng ở Bệnh viện An Tâm, nghỉ Chủ Nhật. Chiều thích chỗ có hoa hoặc có người.",
		family: "Em trai đang học cấp ba. Chi gửi tiền sách mỗi tháng.",
		dream: "Mở phòng khám nhỏ trong khu phố",
		appearance: {
			skin: "#f0c2a6",
			hair: "#241816",
			outfit: "#7ec8c3",
			pants: "#f4f6f5",
			hairStyle: "long",
			height: .97
		}
	}
];
//#endregion
//#region src/sim/memory.ts
function addMemory(world, owner, partial) {
	const c = clock(world.minute);
	const memory = {
		id: `m${world.nextId++}`,
		day: c.day,
		minute: world.minute,
		tags: partial.tags ?? [],
		kind: partial.kind,
		text: partial.text,
		source: partial.source,
		importance: partial.importance
	};
	if (partial.subjectId) memory.subjectId = partial.subjectId;
	if (partial.factKey) memory.factKey = partial.factKey;
	if (partial.factValue) memory.factValue = partial.factValue;
	owner.memories.push(memory);
	trim(owner, "episodic", 70);
	trim(owner, "semantic", 36);
	const working = owner.memories.filter((m) => m.kind === "working");
	if (working.length > 8) {
		const drop = new Set(working.slice(0, working.length - 8).map((m) => m.id));
		owner.memories = owner.memories.filter((m) => !drop.has(m.id));
	}
	return memory;
}
function trim(owner, kind, max) {
	const list = owner.memories.filter((m) => m.kind === kind);
	if (list.length <= max) return;
	const sticky = (m) => m.tags.some((t) => t.startsWith("shared:") || t === "first" || t === "gifted" || t === "reject" || t === "breakup" || t === "romance" || t === "divorce");
	const droppable = list.filter((m) => !sticky(m));
	droppable.sort((a, b) => a.importance - b.importance || a.minute - b.minute);
	let extra = list.length - max;
	const drop = /* @__PURE__ */ new Set();
	for (const m of droppable) {
		if (extra <= 0) break;
		drop.add(m.id);
		extra -= 1;
	}
	if (extra > 0) {
		const rest = list.filter((m) => !drop.has(m.id)).sort((a, b) => a.importance - b.importance || a.minute - b.minute);
		for (const m of rest) {
			if (extra <= 0) break;
			drop.add(m.id);
			extra -= 1;
		}
	}
	owner.memories = owner.memories.filter((m) => !drop.has(m.id));
}
function knowsFact(agent, subjectId, factKey) {
	return agent.memories.some((m) => m.kind === "semantic" && m.subjectId === subjectId && m.factKey === factKey);
}
function clearWorking(agent) {
	agent.memories = agent.memories.filter((m) => m.kind !== "working");
}
function shareFact(world, speaker, listener, factKey) {
	const fact = speaker.facts.find((f) => f.key === factKey);
	if (!fact) return false;
	if (knowsFact(listener, speaker.id, fact.key)) return false;
	addMemory(world, listener, {
		kind: "semantic",
		subjectId: speaker.id,
		text: `${speaker.given} nói rằng mình ${fact.value}.`,
		source: "told",
		factKey: fact.key,
		factValue: fact.value,
		importance: 4 + fact.intimacy * 2,
		tags: ["fact", `fact:${fact.key}`]
	});
	addMemory(world, speaker, {
		kind: "episodic",
		subjectId: listener.id,
		text: `Mình đã kể cho ${listener.given}: ${fact.value}.`,
		source: "self",
		importance: 8,
		tags: [`shared:${fact.key}`, `with:${listener.id}`]
	});
	return true;
}
function witnessedCount(agent, subjectId, placeId) {
	return agent.memories.filter((m) => m.kind === "episodic" && m.source === "witnessed" && m.subjectId === subjectId && m.tags.includes(`place:${placeId}`)).length;
}
//#endregion
//#region src/sim/dialogue.ts
function voice(world, speaker, line) {
	let text = line;
	if (speaker.traits.temper > 70 && rng(world) < .7) text = text.replace(/ nhé/g, "").replace(/ nha/g, "");
	if (speaker.traits.confidence < 34 && !text.endsWith("…")) text = text.replace(/[.!]$/, "…");
	if (speaker.traits.humor > 78 && rng(world) < .28 && !text.includes("Đùa")) text = `${text.replace(/[.…!]$/, "")}. Đùa một nửa.`;
	return text;
}
function say(world, speaker, line) {
	return {
		speakerId: speaker.id,
		text: voice(world, speaker, line)
	};
}
function linesFor(world, a, b, mode, extra) {
	const place = a.locationId !== "transit" ? location(a.locationId).name : "phố";
	if (mode === "meet") return [say(world, a, pick(world, [
		`Chào ${b.given}. Mình là ${a.given}. Hình như mình chưa gặp nhau.`,
		`${b.given} phải không? Mình ${a.given}. Lần đầu thấy cậu ở ${place}.`,
		`Xin lỗi, mình ngồi đây được không? Mình là ${a.given}.`
	])), say(world, b, pick(world, [
		`Mình là ${b.given}. Chào ${a.given}.`,
		`${a.given}. Mình nhớ tên cậu. Hôm nay ${place.toLowerCase()} cũng ổn.`,
		`Chào ${a.given}. Mình ${b.given}.`
	]))];
	if (mode === "chat") {
		const opener = pick(world, [
			`Hôm nay cậu thế nào?`,
			`${place} hôm nay lạ hơn mọi khi.`,
			world.weather === "rain" ? "Mưa này làm mình muốn nán lại." : "Trời đẹp, nhưng mình vẫn thích chỗ có mái.",
			a.traits.selfishness > 60 ? "Ca của mình hôm nay dài thấy sợ." : "Cậu vừa xong việc à?",
			b.traits.humor > 70 ? "Nếu cậu đang định kể chuyện buồn thì mình sẽ đùa. Báo trước cho công bằng." : "Mình ngồi thêm một chút."
		]);
		const reply = pick(world, [
			b.traits.extroversion < 35 ? "Mình ổn. Không có nhiều chuyện để kể." : "Cũng được. Có vài chuyện vụn, nhưng đủ để kể.",
			b.needs.hunger > 65 ? "Mình đói hơn là mình tưởng. Cậu ăn chưa?" : "Mình vừa thở ra một cái. Thế là khá rồi.",
			world.weather === "rain" ? "Mưa thì mình ít muốn về ngay." : "Mình định lát nữa sẽ đi.",
			b.traits.warmth > 75 ? "Cậu trông có vẻ đang nghĩ gì đó. Không cần nói nếu chưa muốn." : "Ừ. Nghe đây."
		]);
		return [say(world, a, opener), say(world, b, reply)];
	}
	if (mode === "callback" && extra) return [say(world, a, pick(world, [
		`Mình vẫn nhớ cậu từng nói ${extra}.`,
		`Không phải mình cố nhớ đâu, nhưng ${extra} — cậu nói thật chứ?`,
		`Lần trước cậu kể ${extra}. Mình để ý từ hôm đó.`
	])), say(world, b, pick(world, [
		"Cậu nhớ thật à. Mình không ngờ.",
		"Ừ. Ít người giữ chuyện đó lại.",
		b.traits.confidence < 40 ? "Mình… nói vậy thôi mà." : "Đúng. Và mình vẫn vậy."
	]))];
	if (mode === "reveal" && extra) return [say(world, a, pick(world, [
		`Mình chưa kể cậu: ${extra}.`,
		`Có một chuyện nhỏ. ${extra[0]?.toUpperCase()}${extra.slice(1)}.`,
		`Không phải bí mật lớn, nhưng ${extra}.`
	])), say(world, b, pick(world, [
		"Cảm ơn vì đã nói.",
		"Mình sẽ nhớ.",
		b.traits.kindness > 70 ? "Cậu kể được là tốt rồi." : "Ừ. Mình nghe."
	]))];
	if (mode === "gift" && extra) return [say(world, a, pick(world, [
		`Cái này cho cậu. ${extra}. Mình nhớ cậu thích.`,
		`Đừng cười. Mình mua ${extra.toLowerCase()} vì cậu từng nhắc.`,
		`${b.given}, cầm lấy. ${extra}.`
	])), say(world, b, pick(world, [
		"Cậu nhớ thật. Mình không biết nói gì hơn là cảm ơn.",
		"Mình thích. Không chỉ vì món này.",
		b.traits.temper > 65 ? "Cậu làm mình hết biết cách cáu." : "Để mình giữ cẩn thận."
	]))];
	if (mode === "argue") return [say(world, a, pick(world, [
		"Mình không thích cách cậu im trong chuyện này.",
		"Cậu có nghe mình nói không, hay chỉ đang đợi đến lượt mình?",
		a.emotions.jealousy > 40 ? "Mình thấy cậu với người kia. Đừng bảo là mình tưởng tượng." : "Mình mệt vì phải đoán ý cậu."
	])), say(world, b, pick(world, [
		b.traits.temper > 60 ? "Cậu đang đổ hết lên mình." : "Mình không cố làm cậu tổn thương.",
		"Nếu cậu đã kết luận rồi thì mình nói thêm cũng vô ích.",
		b.traits.kindness > 75 ? "Mình đang nghe. Nhưng cậu đang đau, và cậu đang làm mình đau theo." : "Thế cậu muốn gì?"
	]))];
	if (mode === "apology") return [say(world, a, pick(world, [
		"Mình nói quá. Mình xin lỗi.",
		"Mình không muốn thắng cuộc cãi này. Mình muốn cậu còn ở đây.",
		"Lỗi phần nhiều là mình. Mình nhận."
	])), say(world, b, pick(world, [
		"Mình cũng có phần. Mình không đi nữa.",
		"Được. Mình vẫn giận một chút, nhưng mình ở lại.",
		"Xin lỗi của cậu mình nhận. Lần sau nói sớm hơn."
	]))];
	if (mode === "confess") return [say(world, a, pick(world, [
		`${b.given}, mình không muốn chỉ đi ngang qua cậu nữa.`,
		"Mình thích cậu. Không phải kiểu thích thoáng qua.",
		"Nếu cậu không muốn, mình sẽ lùi lại. Nhưng mình phải nói."
	]))];
	if (mode === "accept") return [say(world, b, pick(world, [
		"Mình cũng muốn thử. Đi cùng nhau, chậm thôi.",
		"Mình đồng ý. Đừng hứa lớn. Hãy ở lại.",
		"Được. Mình chọn cậu — hôm nay, và mình sẽ xem ngày mai."
	]))];
	if (mode === "reject") return [say(world, b, b.traits.kindness > 62 ? pick(world, [
		"Mình quý cậu. Nhưng mình không thấy cùng một hướng. Mình không muốn giả vờ.",
		"Cảm ơn vì đã nói thẳng. Mình không đáp lại được như cậu cần.",
		"Cậu xứng đáng nghe câu rõ ràng: mình không thể bước tiếp theo cách đó."
	]) : pick(world, [
		"Mình không nghĩ về cậu theo cách đó.",
		"Đừng. Mình không muốn mối quan hệ này đi xa hơn.",
		"Cậu nhầm rồi. Mình không có cảm giác ấy."
	]))];
	if (mode === "propose") return [say(world, a, pick(world, [
		"Mình muốn cưới cậu. Không phải lúc cao hứng. Mình đã nghĩ nhiều ngày.",
		`${b.given}, ở lại với mình như một người nhà. Cưới nhau nhé.`,
		"Mình không cần đám cưới lớn. Mình cần cậu gật đầu."
	]))];
	if (mode === "marry") return [say(world, b, pick(world, [
		"Mình gật. Mình chọn cậu.",
		"Được. Mình cưới cậu.",
		"Có. Và mình biết mình đang nói gì."
	]))];
	if (mode === "break") return [say(world, a, pick(world, [
		"Mình không còn muốn tiếp tục. Mình nói để cậu khỏi phải đoán.",
		"Mình đã cố. Mình dừng lại đây.",
		"Ta không còn hợp. Mình không muốn làm nhau tệ hơn."
	])), say(world, b, pick(world, [
		"Mình nghe rồi.",
		"Thế thì mình không níu.",
		b.traits.temper > 60 ? "Được. Đừng giải thích thêm." : "Mình buồn. Nhưng mình tôn trọng câu đó."
	]))];
	if (mode === "return") return [say(world, a, "Mình nhớ cậu theo cách không chịu hết. Ta thử lại, được không?"), say(world, b, "Chậm thôi. Nhưng mình đồng ý thử lại.")];
	return [say(world, a, "…"), say(world, b, "Ừ.")];
}
//#endregion
//#region src/sim/path.ts
function hash(id) {
	let h = 2166136261;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function standPoint(locationId, agentId) {
	const loc = location(locationId);
	const ang = hash(agentId) % 360 * Math.PI / 180;
	const ring = loc.gather;
	return {
		x: loc.x + Math.cos(ang) * ring,
		z: loc.z + Math.sin(ang) * ring * .82
	};
}
function pushPt(pts, x, z) {
	const last = pts[pts.length - 1];
	if (!last || Math.hypot(last.x - x, last.z - z) > .15) pts.push({
		x,
		z
	});
}
function buildTravel(world, agent, destId, activity, seekId) {
	const start = agentPosition(agent, world.minute);
	const doorA = agent.locationId !== "transit" ? location(agent.locationId) : null;
	const doorB = location(destId);
	const end = standPoint(destId, agent.id);
	const pts = [];
	pushPt(pts, start.x, start.z);
	if (doorA) pushPt(pts, doorA.x, doorA.z);
	if (doorA && (doorA.x !== doorB.x || doorA.z !== doorB.z)) pushPt(pts, doorB.x, doorA.z);
	pushPt(pts, doorB.x, doorB.z);
	pushPt(pts, end.x, end.z);
	if (pts.length < 2) pushPt(pts, end.x + .1, end.z);
	const cum = [0];
	for (let i = 1; i < pts.length; i++) {
		const prev = pts[i - 1];
		const cur = pts[i];
		cum.push(cum[i - 1] + Math.hypot(cur.x - prev.x, cur.z - prev.z));
	}
	const total = cum[cum.length - 1] || .1;
	const minutes = Math.max(10, Math.ceil(total / 2.15 / 10) * 10);
	return {
		path: pts,
		cum,
		total,
		startMinute: world.minute,
		endMinute: world.minute + minutes,
		destId,
		arriveActivity: activity,
		seekId
	};
}
function pointOnTravel(travel, minute) {
	const span = Math.max(1, travel.endMinute - travel.startMinute);
	const dist = Math.max(0, Math.min(1, (minute - travel.startMinute) / span)) * travel.total;
	const ahead = Math.min(travel.total, dist + .65);
	return {
		x: atDist(travel, dist).x,
		z: atDist(travel, dist).z,
		dx: atDist(travel, ahead).x - atDist(travel, dist).x,
		dz: atDist(travel, ahead).z - atDist(travel, dist).z
	};
}
function atDist(travel, dist) {
	const { path, cum } = travel;
	if (dist <= 0) return path[0];
	for (let i = 1; i < path.length; i++) if (dist <= cum[i]) {
		const prev = path[i - 1];
		const cur = path[i];
		const seg = cum[i] - cum[i - 1];
		const u = seg <= 1e-4 ? 0 : (dist - cum[i - 1]) / seg;
		return {
			x: prev.x + (cur.x - prev.x) * u,
			z: prev.z + (cur.z - prev.z) * u
		};
	}
	return path[path.length - 1];
}
function agentPosition(agent, minute) {
	if (agent.travel) {
		const p = pointOnTravel(agent.travel, minute);
		return {
			x: p.x,
			z: p.z
		};
	}
	if (agent.locationId === "transit") return {
		x: 0,
		z: 0
	};
	return standPoint(agent.locationId, agent.id);
}
function agentFacing(agent, minute, partner) {
	if (agent.travel) {
		const p = pointOnTravel(agent.travel, minute);
		return {
			x: p.dx,
			z: p.dz
		};
	}
	if (partner && partner.locationId === agent.locationId && !partner.travel) {
		const a = standPoint(agent.locationId, agent.id);
		const b = standPoint(partner.locationId, partner.id);
		return {
			x: b.x - a.x,
			z: b.z - a.z
		};
	}
	if (agent.locationId !== "transit") {
		const loc = location(agent.locationId);
		const here = standPoint(agent.locationId, agent.id);
		return {
			x: loc.x - here.x,
			z: loc.z - here.z
		};
	}
	return {
		x: 0,
		z: 1
	};
}
//#endregion
//#region src/sim/systems.ts
function shiftOf(a, world) {
	if (!a.alive || a.retired || a.age < 6) return null;
	const dow = clock(world.minute).dayIndex;
	if (a.age < 18) {
		if (dow >= 5) return null;
		return {
			start: 8,
			end: 15,
			place: "school"
		};
	}
	if (a.id.startsWith("child_")) {
		if (dow >= 5) return null;
		return {
			start: 9,
			end: 17,
			place: a.workplaceId || "cafe"
		};
	}
	switch (a.id) {
		case "linh":
			if (dow === 6) return null;
			return {
				start: 7,
				end: 15,
				place: "cafe"
			};
		case "minh":
			if (dow >= 5) return null;
			return {
				start: 9,
				end: 18,
				place: "office"
			};
		case "ha":
			if (dow >= 5) return null;
			return {
				start: 8,
				end: 16,
				place: "school"
			};
		case "khoa":
			if (dow === 6) return null;
			if (dow % 3 === 2) return {
				start: 13,
				end: 21,
				place: "hospital"
			};
			return {
				start: 8,
				end: 16,
				place: "hospital"
			};
		case "mai":
			if (dow === 0) return null;
			return {
				start: 10,
				end: 19,
				place: "mall"
			};
		case "duc":
			if (dow === 1) return null;
			return {
				start: 11,
				end: 21,
				place: "restaurant"
			};
		case "an":
			if (dow === 6 || dow === 3) return null;
			if (dow === 4) return {
				start: 14,
				end: 18,
				place: "mall"
			};
			return {
				start: 10,
				end: 16,
				place: "cafe"
			};
		case "chi":
			if (dow === 6) return null;
			return {
				start: 7,
				end: 15,
				place: "hospital"
			};
		default: return null;
	}
}
function hourOf(world) {
	const c = clock(world.minute);
	return c.hour + c.minute / 60;
}
function serviceJob(a) {
	return a.id === "linh" || a.id === "duc" || a.id === "mai" || a.id === "chi";
}
function compatibility(a, b) {
	const keys = [
		"warmth",
		"humor",
		"romance",
		"selfishness",
		"kindness"
	];
	let diff = 0;
	for (const k of keys) diff += Math.abs(a.traits[k] - b.traits[k]);
	let score = 100 - diff / keys.length;
	if (a.traits.romance > 60 && b.traits.romance > 60) score += 8;
	if (a.traits.selfishness > 60 && b.traits.selfishness > 60) score -= 12;
	if (a.traits.kindness > 70 && b.traits.kindness > 70) score += 6;
	return clamp(score, 8, 97);
}
function ensureRel(world, aId, bId) {
	const x = aId < bId ? aId : bId;
	const y = aId < bId ? bId : aId;
	let rel = world.relationships.find((r) => r.aId === x && r.bId === y);
	if (!rel) {
		rel = {
			aId: x,
			bId: y,
			aToB: emptyDir(),
			bToA: emptyDir(),
			compatibility: compatibility(agent(world, x), agent(world, y)),
			status: "stranger",
			sinceDay: clock(world.minute).day
		};
		world.relationships.push(rel);
	}
	return rel;
}
function partnerOf(world, id) {
	for (const rel of world.relationships) {
		if (rel.status !== "dating" && rel.status !== "married") continue;
		if (rel.aId === id) return rel.bId;
		if (rel.bId === id) return rel.aId;
	}
	return null;
}
function knowsPartner(world, viewerId, otherId) {
	const p = partnerOf(world, otherId);
	if (!p) return false;
	return agent(world, viewerId).memories.some((m) => m.tags.includes(`couple:${pairKey(otherId, p)}`) && (m.source === "witnessed" || m.source === "told" || m.source === "self"));
}
function refreshStatus(rel) {
	if (rel.status === "dating" || rel.status === "married" || rel.status === "broken" || rel.status === "divorced") return;
	const fam = (rel.aToB.familiarity + rel.bToA.familiarity) / 2;
	const aff = (rel.aToB.affection + rel.bToA.affection) / 2;
	const tru = (rel.aToB.trust + rel.bToA.trust) / 2;
	const con = (rel.aToB.conflict + rel.bToA.conflict) / 2;
	if (con > 62 && aff < 30) rel.status = "distant";
	else if (fam > 48 && aff > 56 && tru > 46 && con < 42) rel.status = "close";
	else if (fam > 24 && aff > 32 && con < 58) rel.status = "friends";
	else if (fam > 8) rel.status = "acquaintance";
	else rel.status = "stranger";
}
function logEvent(world, type, actorIds, text, importance) {
	const c = clock(world.minute);
	world.events.push({
		id: `e${world.nextId++}`,
		day: c.day,
		minute: world.minute,
		hour: c.hour,
		min: c.minute,
		type,
		actorIds,
		text,
		importance
	});
	if (world.events.length > 260) {
		const keep = (e) => e.importance >= 8 || e.type === "meet" || e.type === "dating" || e.type === "reject" || e.type === "marriage" || e.type === "breakup" || e.type === "divorce" || e.type === "gift";
		const idx = world.events.findIndex((e) => !keep(e) && e.importance < 6);
		if (idx >= 0) world.events.splice(idx, 1);
		else {
			const idx2 = world.events.findIndex((e) => !keep(e));
			if (idx2 >= 0) world.events.splice(idx2, 1);
			else world.events.shift();
		}
	}
}
function pushLines(world, placeId, partnerA, partnerB, lines) {
	for (const line of lines) {
		const other = line.speakerId === partnerA ? partnerB : partnerA;
		world.lines.push({
			id: `l${world.nextId++}`,
			speakerId: line.speakerId,
			text: line.text,
			day: clock(world.minute).day,
			minute: world.minute,
			placeId,
			partnerId: other
		});
		addMemory(world, agent(world, line.speakerId), {
			kind: "working",
			subjectId: other,
			text: line.text,
			source: "self",
			importance: 2,
			tags: ["working"]
		});
		addMemory(world, agent(world, other), {
			kind: "working",
			subjectId: line.speakerId,
			text: line.text,
			source: "witnessed",
			importance: 2,
			tags: ["working"]
		});
	}
	if (world.lines.length > 140) world.lines.splice(0, world.lines.length - 140);
}
function placeName(id) {
	if (id === "transit") return "trên đường";
	return location(id).name;
}
function tickNeeds(a, minutes) {
	const k = minutes / 10;
	if (a.activity === "sleeping") {
		a.needs.sleepiness = clamp(a.needs.sleepiness - 1.85 * k);
		a.needs.hunger = clamp(a.needs.hunger + .45 * k);
		a.needs.thirst = clamp(a.needs.thirst + .35 * k);
		a.needs.health = clamp(a.needs.health + .35 * k);
	} else {
		const atWork = a.activity === "working";
		a.needs.hunger = clamp(a.needs.hunger + 1.15 * k);
		a.needs.thirst = clamp(a.needs.thirst + (atWork ? .38 : 1.05) * k);
		a.needs.sleepiness = clamp(a.needs.sleepiness + .42 * k);
		a.needs.fun = clamp(a.needs.fun + (atWork ? 1.05 : .7) * k);
		const socialRate = .5 * (.4 + a.traits.extroversion / 100);
		a.needs.social = clamp(a.needs.social + socialRate * k);
		a.needs.affection = clamp(a.needs.affection + .32 * (.35 + a.traits.romance / 100) * k);
		if (a.needs.hunger > 82) a.needs.health = clamp(a.needs.health - .45 * k);
		if (a.needs.sleepiness > 90) a.needs.health = clamp(a.needs.health - .3 * k);
	}
	const insecure = a.money < 180 ? 78 : a.money < 450 ? 46 : 18;
	a.needs.safety = clamp(insecure * .65 + (100 - a.needs.health) * .35);
}
function tickEmotions(a) {
	const decay = (v, n) => clamp(v - n);
	a.emotions.joy = decay(a.emotions.joy, 1.6);
	a.emotions.anger = decay(a.emotions.anger, 2.1);
	a.emotions.anxiety = decay(a.emotions.anxiety, 1.4);
	a.emotions.shame = decay(a.emotions.shame, 1.5);
	a.emotions.disappointment = decay(a.emotions.disappointment, 1.3);
	a.emotions.hope = decay(a.emotions.hope, 1.1);
	a.emotions.jealousy = decay(a.emotions.jealousy, 2.4);
	a.emotions.love = decay(a.emotions.love, .45);
	a.emotions.loneliness = clamp(a.needs.social * .72 + (a.talksToday === 0 ? 12 : 0));
	a.emotions.sadness = clamp(a.emotions.sadness * .92 + a.emotions.loneliness * .08);
	if (a.needs.safety > 65) a.emotions.anxiety = clamp(a.emotions.anxiety + 1.2);
	if (a.money < 80) a.emotions.anxiety = clamp(a.emotions.anxiety + 1.4);
}
function minutesUntil(world, hour, minute) {
	let target = Math.floor(world.minute / 1440) * 1440 + hour * 60 + minute;
	if (target <= world.minute) target += 1440;
	return target;
}
function beginActivity(world, a, activity, destId, seekId) {
	a.locationId = destId;
	a.activity = activity;
	a.destinationId = void 0;
	a.travel = null;
	a.activityApplied = false;
	a.seekTargetId = seekId;
	a.partnerId = void 0;
	const hour = hourOf(world);
	if (activity === "eating") {
		const atWork = destId === shiftOf(a, world)?.place;
		const home = destId === a.homeId;
		const cost = atWork && (a.id === "duc" || a.id === "linh") ? 8 : home || a.money < 36 ? 8 : destId === "cafe" ? 26 : 34;
		a.money -= cost;
		a.needs.hunger = clamp(a.needs.hunger - (home ? 42 : 58));
		a.needs.thirst = clamp(a.needs.thirst - 18);
		a.needs.fun = clamp(a.needs.fun - 8);
		a.stats.meals += 1;
		a.busyUntil = world.minute + 30;
		a.hadLunch = hour >= 11 && hour < 15 ? true : a.hadLunch;
		a.hadBreakfast = hour < 10 ? true : a.hadBreakfast;
		a.lastThought = home ? "Ăn tạm ở nhà cho đỡ tốn." : `Ghé ${placeName(destId)} vì bụng đã kêu.`;
	} else if (activity === "drinking") {
		a.money -= a.money < 20 ? 0 : 14;
		a.needs.thirst = clamp(a.needs.thirst - 48);
		a.needs.hunger = clamp(a.needs.hunger - 6);
		a.needs.fun = clamp(a.needs.fun - 10);
		a.busyUntil = world.minute + 20;
		a.lastThought = "Cần một thứ gì đó để uống, và cũng để ngồi.";
	} else if (activity === "working") {
		const shift = shiftOf(a, world);
		const end = shift ? minutesUntil(world, Math.floor(shift.end), Math.round(shift.end % 1 * 60)) : world.minute + 60;
		const lunch = minutesUntil(world, 12, 0);
		a.busyUntil = world.minute < lunch && lunch < end ? lunch : end;
		a.lastThought = `Đến giờ làm ở ${placeName(destId)}.`;
	} else if (activity === "sleeping") {
		a.busyUntil = minutesUntil(world, 6, 30);
		a.stats.sleeps += 1;
		a.needs.fun = clamp(a.needs.fun - 6);
		a.lastThought = "Đủ rồi. Mình về ngủ.";
	} else if (activity === "relaxing") {
		const cafe = destId === "cafe";
		if (cafe) {
			a.money -= 12;
			a.needs.thirst = clamp(a.needs.thirst - 22);
		}
		a.needs.fun = clamp(a.needs.fun - (cafe ? 18 : 34));
		a.needs.social = clamp(a.needs.social - (cafe ? 8 : 4));
		a.busyUntil = world.minute + (cafe ? 30 : 40);
		a.lastThought = world.weather === "rain" && destId === "park" && a.id === "an" ? "Mưa. Công viên đẹp theo cách riêng của nó." : cafe ? "Ngồi lại quán một lát, không cần lý do lớn." : "Ra công viên cho đầu óc rộng ra.";
	} else if (activity === "shopping") {
		a.busyUntil = world.minute + 30;
		a.lastShopDay = clock(world.minute).day;
		if (a.planGift && a.planGift.place === destId && a.money >= 20) {
			const gift = a.planGift;
			a.money -= locationCost(gift);
			a.holdingGift = {
				forId: gift.forId,
				item: gift.item,
				label: gift.label,
				factKey: gift.factKey
			};
			a.planGift = void 0;
			a.lastThought = `Mua ${gift.label} cho ${agent(world, gift.forId).given}. Hy vọng họ còn nhớ đã kể.`;
		} else {
			a.money -= destId === "mall" ? 28 : 36;
			a.needs.hunger = clamp(a.needs.hunger - 12);
			a.needs.fun = clamp(a.needs.fun - 14);
			a.lastThought = destId === "mall" ? "Đi lòng vòng, xem có gì đáng giữ." : "Mua đồ ăn cho vài ngày.";
		}
	} else if (activity === "seeking") {
		a.busyUntil = world.minute + 30;
		const who = seekId ? agent(world, seekId).given : "một người";
		a.lastThought = `Mình ghé ${placeName(destId)} vì có thể gặp ${who}.`;
	} else if (activity === "treatment") {
		a.money -= 70;
		a.needs.health = clamp(a.needs.health + 38);
		a.busyUntil = world.minute + 40;
		a.emotions.anxiety = clamp(a.emotions.anxiety - 10);
		a.lastThought = "Người mệt thì phải vào viện, không thương lượng.";
		logEvent(world, "health", [a.id], `${a.given} vào ${placeName(destId)} vì sức khỏe giảm.`, 5);
	} else {
		a.busyUntil = world.minute + 40;
		a.needs.fun = clamp(a.needs.fun - (a.traits.extroversion < 40 ? 16 : 6));
		a.needs.social = clamp(a.needs.social + (a.traits.extroversion < 40 ? -4 : 2));
		a.lastThought = "Ở nhà một lúc. Không phải lúc nào cũng cần phố.";
	}
	a.activityApplied = true;
}
function locationCost(gift) {
	if (gift.item === "running") return 70;
	if (gift.item === "jazz") return 46;
	if (gift.item === "fashion") return 40;
	if (gift.item === "poetry") return 32;
	if (gift.item === "spice") return 30;
	return 24;
}
function go(world, a, destId, activity, seekId) {
	if (a.locationId === destId && !a.travel) {
		beginActivity(world, a, activity, destId, seekId);
		return;
	}
	a.travel = buildTravel(world, a, destId, activity, seekId);
	a.activity = "walking";
	a.destinationId = destId;
	a.locationId = "transit";
	a.partnerId = void 0;
	a.busyUntil = a.travel.endMinute;
	a.seekTargetId = seekId;
	a.lastThought = `Đi đến ${placeName(destId)}.`;
}
function arrive(world, a) {
	if (!a.travel) return;
	const dest = a.travel.destId;
	const activity = a.travel.arriveActivity;
	const seek = a.travel.seekId;
	a.travel = null;
	beginActivity(world, a, activity, dest, seek);
}
function lunchPlace(world, a) {
	if (a.money < 36) return a.homeId;
	if (a.traits.extroversion > 60 && rng(world) < .55) return rng(world) < .5 ? "restaurant" : "cafe";
	return shiftOf(a, world)?.place ?? a.homeId;
}
function guessWhere(world, seeker, target) {
	const seen = [...seeker.memories].filter((m) => m.kind === "episodic" && m.subjectId === target.id && m.source === "witnessed").reverse();
	for (const m of seen) {
		const tag = m.tags.find((t) => t.startsWith("place:"));
		if (!tag) continue;
		const id = tag.slice(6);
		if (id !== "transit" && id !== seeker.homeId) return id;
	}
	if (seeker.traits.extroversion > 50) return world.weather === "rain" ? "cafe" : rng(world) < .5 ? "cafe" : "park";
	return world.weather === "rain" && seeker.id !== "an" ? "cafe" : "park";
}
function considerGift(world, a) {
	if (a.holdingGift || a.planGift) return a.planGift ?? null;
	if (a.money < 90) return null;
	let best = null;
	for (const other of world.agents) {
		if (!other.alive || other.id === a.id) continue;
		const rel = ensureRel(world, a.id, other.id);
		const mine = directed(rel, a.id);
		if (mine.affection < 48 || mine.familiarity < 18) continue;
		if (rel.status === "divorced") continue;
		if (a.memories.some((m) => m.tags.includes("gifted") && m.subjectId === other.id && clock(world.minute).day - m.day < 10)) continue;
		if (a.memories.filter((m) => m.tags.includes("gifted") && m.subjectId === other.id).length >= 2) continue;
		for (const mem of a.memories) {
			if (mem.kind !== "semantic" || mem.subjectId !== other.id || !mem.factKey) continue;
			const fact = other.facts.find((f) => f.key === mem.factKey && f.gift);
			if (!fact?.gift) continue;
			const score = mine.affection + mine.attraction * .3 + a.traits.romance * .15;
			if (!best || score > best.score) best = {
				score,
				plan: {
					forId: other.id,
					item: fact.gift.item,
					label: fact.gift.label,
					factKey: fact.key,
					place: fact.gift.place
				}
			};
		}
	}
	if (!best) return null;
	const chance = (a.memories.filter((m) => m.tags.includes("gifted") && m.subjectId === best.plan.forId).length === 0 ? .2 : .07) + best.score / 480;
	if (rng(world) > chance) return null;
	return best.plan;
}
function bestSeek(world, a) {
	let best = null;
	for (const other of world.agents) {
		if (!other.alive || other.id === a.id) continue;
		const rel = ensureRel(world, a.id, other.id);
		const mine = directed(rel, a.id);
		if (mine.familiarity < 14 && mine.affection < 36) continue;
		let score = mine.affection * .55 + mine.attraction * .35 + a.needs.affection * .25 - mine.conflict * .45;
		if (partnerOf(world, a.id) === other.id) score += 28;
		if (rel.status === "broken" && mine.affection > 55) score += 10;
		if (!best || score > best.score) best = {
			id: other.id,
			score
		};
	}
	if (!best || best.score < 42) return null;
	return best;
}
function decide(world, a) {
	if (!a.alive) return;
	const hour = hourOf(world);
	const shift = shiftOf(a, world);
	if (a.needs.health < 30 && a.locationId !== "hospital" && a.activity !== "treatment") {
		a.lastThought = "Sức khỏe xuống quá thấp. Phải vào viện.";
		go(world, a, "hospital", "treatment");
		return;
	}
	if ((hour >= 22.5 || hour < 6.5 || a.needs.sleepiness > 86) && a.activity !== "sleeping") {
		go(world, a, a.homeId, "sleeping");
		return;
	}
	if (a.activity === "sleeping") {
		if (hour >= 6.5 && hour < 11 && a.needs.sleepiness < 36) {
			a.activity = "idle";
			a.busyUntil = world.minute;
		} else {
			a.busyUntil = Math.max(a.busyUntil, world.minute + 30);
			return;
		}
	}
	if (hour >= 6.6 && hour < 9.2 && !a.hadBreakfast && a.needs.hunger > 46) {
		if (!(shift && hour >= shift.start - .15 && a.needs.hunger < 68)) {
			a.hadBreakfast = true;
			go(world, a, a.homeId, "eating");
			return;
		}
	}
	if (a.needs.hunger > 74) {
		go(world, a, a.money < 32 ? a.homeId : a.traits.extroversion > 64 ? "restaurant" : rng(world) < .5 ? "cafe" : a.homeId, "eating");
		return;
	}
	if (shift && !a.hadLunch && hour >= 12 && hour < 13.3 && a.needs.hunger > 32) {
		a.hadLunch = true;
		go(world, a, lunchPlace(world, a), "eating");
		return;
	}
	if (a.needs.thirst > 80) {
		go(world, a, "cafe", "drinking");
		return;
	}
	if (shift && hour >= shift.start && hour < shift.end - .2 && !(hour >= 12 && hour < 13.2)) {
		go(world, a, shift.place, "working");
		return;
	}
	if (a.holdingGift) {
		const target = agent(world, a.holdingGift.forId);
		go(world, a, guessWhere(world, a, target), "seeking", target.id);
		return;
	}
	const gift = considerGift(world, a);
	if (gift) {
		a.planGift = gift;
		a.lastThought = `Mình muốn tặng ${agent(world, gift.forId).given} ${gift.label}, vì mình còn nhớ.`;
		go(world, a, gift.place, "shopping");
		return;
	}
	const opts = [];
	const weekend = clock(world.minute).dayIndex >= 5;
	opts.push({
		score: 24 + (100 - a.traits.extroversion) * .18,
		dest: a.homeId,
		activity: "idle",
		thought: "Về nhà cũng là một lựa chọn tử tế."
	});
	let park = a.needs.fun * .55 + (100 - a.traits.extroversion) * .12 + (weekend ? 14 : 0);
	if (world.weather === "rain" && a.id !== "an") park -= 36;
	if (a.id === "an" && world.weather === "rain") park += 22;
	if (a.id === "ha") park += 10;
	opts.push({
		score: park,
		dest: "park",
		activity: "relaxing",
		thought: "Công viên hợp với đầu mình lúc này."
	});
	let cafe = a.needs.social * (.35 + a.traits.extroversion / 280) + a.needs.thirst * .15 + (weekend ? 8 : 0);
	if (world.weather === "rain") cafe += 16;
	if (a.id === "linh") cafe += 6;
	opts.push({
		score: cafe,
		dest: "cafe",
		activity: "relaxing",
		thought: "Quán cà phê là chỗ dễ gặp người mà không phải hẹn."
	});
	opts.push({
		score: a.needs.hunger * .35 + (a.id === "duc" ? 4 : 10) + a.traits.extroversion * .05,
		dest: "restaurant",
		activity: a.needs.hunger > 40 ? "eating" : "relaxing",
		thought: "Nhà hàng có mùi khiến mình muốn vào."
	});
	const daysSinceShop = clock(world.minute).day - a.lastShopDay;
	opts.push({
		score: (daysSinceShop >= 3 ? 38 : 6) + a.needs.hunger * .12,
		dest: "market",
		activity: "shopping",
		thought: "Tủ lạnh không tự đầy."
	});
	opts.push({
		score: a.needs.fun * .34 * (.4 + a.traits.extroversion / 120) + (a.id === "mai" ? 12 : 0),
		dest: "mall",
		activity: "shopping",
		thought: "Đi dạo trung tâm thương mại cho đỡ bí."
	});
	const seek = bestSeek(world, a);
	if (seek) {
		const who = agent(world, seek.id);
		const dest = guessWhere(world, a, who);
		opts.push({
			score: seek.score,
			dest,
			activity: "seeking",
			seekId: who.id,
			thought: `Mình muốn gặp ${who.given}, không phải vì lịch, vì mình nhớ.`
		});
	}
	for (const o of opts) o.score += rng(world) * 14 - 4;
	if (a.money < 40) {
		for (const o of opts) if (o.dest !== a.homeId && o.dest !== "park") o.score -= 30;
	}
	opts.sort((x, y) => y.score - x.score);
	const choice = opts[0];
	a.lastThought = choice.thought;
	go(world, a, choice.dest, choice.activity, choice.seekId);
}
function openToTalk(world, a) {
	if (a.travel || a.locationId === "transit") return false;
	if (a.activity === "sleeping" || a.activity === "treatment" || a.activity === "walking") return false;
	if (a.activity === "socializing") return false;
	if (a.activity === "working") {
		const hour = hourOf(world);
		if (hour >= 12 && hour < 13.3) return true;
		return a.workChatty;
	}
	return true;
}
function vibeOf(rel, a, b) {
	const humorFit = 100 - Math.abs(a.traits.humor - b.traits.humor);
	const warmth = (a.traits.warmth + b.traits.warmth) / 2;
	const temperClash = Math.max(0, a.traits.temper + b.traits.temper - 108);
	return rel.compatibility * .42 + warmth * .34 + humorFit * .24 - temperClash;
}
function applyWarm(rel, from, amount) {
	const d = directed(rel, from.id);
	d.familiarity = clamp(d.familiarity + 3.2 + from.traits.extroversion * .012);
	d.trust = clamp(d.trust + 1.1 + from.traits.kindness * .012 - from.traits.selfishness * .008);
	d.affection = clamp(d.affection + amount);
	d.respect = clamp(d.respect + .7);
	d.bond = clamp(d.bond + amount * .65);
	d.conflict = clamp(d.conflict - 1.4);
	const romance = from.traits.romance / 100 * (.45 + rel.compatibility / 140);
	d.attraction = clamp(d.attraction + amount * romance);
	if (rel.status === "dating" || rel.status === "married") d.commitment = clamp(d.commitment + 1.35);
}
function witnesses(world, placeId, skip) {
	return world.agents.filter((a) => a.alive && a.locationId === placeId && !a.travel && !skip.includes(a.id));
}
function rememberCouple(world, a, b, placeId, text) {
	const tag = `couple:${pairKey(a.id, b.id)}`;
	for (const who of [
		a,
		b,
		...witnesses(world, placeId, [a.id, b.id])
	]) addMemory(world, who, {
		kind: "episodic",
		subjectId: who.id === b.id ? a.id : who.id === a.id ? b.id : a.id,
		text,
		source: who.id === a.id || who.id === b.id ? "self" : "witnessed",
		importance: 9,
		tags: [
			tag,
			`place:${placeId}`,
			"romance"
		]
	});
}
function maybeReveal(world, a, b, rel) {
	const mine = directed(rel, a.id);
	const allowed = a.facts.filter((f) => !knowsFact(b, a.id, f.key)).filter((f) => {
		if (f.intimacy === 1) return mine.familiarity > 12 && (a.traits.extroversion > 36 || mine.trust > 20);
		if (f.intimacy === 2) return mine.trust > 42 && mine.familiarity > 26;
		return mine.trust > 66 && (rel.status === "dating" || rel.status === "married" || rel.status === "close");
	});
	if (allowed.length === 0 || rng(world) > .42) return [];
	allowed.sort((x, y) => x.intimacy - y.intimacy);
	const fact = allowed[0];
	if (!shareFact(world, a, b, fact.key)) return [];
	b.emotions.joy = clamp(b.emotions.joy + 6);
	directed(rel, b.id).trust = clamp(directed(rel, b.id).trust + 2.2);
	logEvent(world, "reveal", [a.id, b.id], `${a.given} kể cho ${b.given}: ${fact.value}.`, 6);
	return linesFor(world, a, b, "reveal", fact.value);
}
function maybeCallback(world, a, b, rel) {
	const day = clock(world.minute).day;
	const known = a.memories.find((m) => {
		if (m.kind !== "semantic" || m.subjectId !== b.id || !m.factValue || !m.factKey || m.source === "self") return false;
		return !a.memories.some((r) => r.tags.includes(`recalled:${m.factKey}`) && r.subjectId === b.id && day - r.day < 6);
	});
	if (!known?.factValue || !known.factKey || rng(world) > .38) return [];
	directed(rel, b.id).trust = clamp(directed(rel, b.id).trust + 3);
	directed(rel, b.id).affection = clamp(directed(rel, b.id).affection + 2.4);
	directed(rel, a.id).affection = clamp(directed(rel, a.id).affection + 1.2);
	b.emotions.joy = clamp(b.emotions.joy + 14);
	b.emotions.love = clamp(b.emotions.love + 6);
	addMemory(world, a, {
		kind: "episodic",
		subjectId: b.id,
		text: `Mình nhắc ${b.given} về chuyện ${known.factValue}.`,
		source: "self",
		importance: 5,
		tags: [
			`recalled:${known.factKey}`,
			`with:${b.id}`,
			`place:${a.locationId}`
		]
	});
	addMemory(world, b, {
		kind: "episodic",
		subjectId: a.id,
		text: `${a.given} nhớ rằng mình ${known.factValue}.`,
		source: "witnessed",
		importance: 7,
		tags: [
			`place:${a.locationId}`,
			"remembered",
			`with:${a.id}`,
			`recalled:${known.factKey}`
		]
	});
	logEvent(world, "memory", [a.id, b.id], `${a.given} nhắc lại điều ${b.given} từng kể: ${known.factValue}.`, 6);
	return linesFor(world, a, b, "callback", known.factValue);
}
function romanceSpeech(world, a, b, rel) {
	if (!a.alive || !b.alive || a.age < 18 || b.age < 18) return false;
	if (rel.status === "divorced") return false;
	const ab = directed(rel, a.id);
	const ba = directed(rel, b.id);
	if (partnerOf(world, a.id)) return false;
	if (partnerOf(world, b.id) && knowsPartner(world, a.id, b.id)) return false;
	if ((a.confessCooldown[b.id] ?? -1) > clock(world.minute).day) return false;
	if (rel.status === "broken" && ab.affection > 64 && ba.affection > 58 && ab.conflict < 30 && ba.conflict < 30) {
		if (rng(world) < .35) {
			rel.status = "dating";
			rel.sinceDay = clock(world.minute).day;
			rel.initiatorId = a.id;
			ab.commitment = clamp(ab.commitment + 20);
			ba.commitment = clamp(ba.commitment + 16);
			const back = linesFor(world, a, b, "return");
			pushLines(world, a.locationId, a.id, b.id, back);
			logEvent(world, "reunite", [a.id, b.id], `${a.given} và ${b.given} quyết định thử lại.`, 9);
			return true;
		}
	}
	if (rel.status === "dating") {
		if (clock(world.minute).day - rel.sinceDay >= 12 && ab.commitment > 74 && ba.commitment > 66 && ab.affection > 70 && ba.affection > 64 && ab.conflict < 28) {
			const courage = a.traits.confidence * .4 + ab.commitment * .35;
			if (rng(world) * 100 < courage) {
				const ask = linesFor(world, a, b, "propose");
				pushLines(world, a.locationId, a.id, b.id, ask);
				if (ba.commitment > 70 && ba.affection > 66 && b.traits.romance > 35) {
					rel.status = "married";
					rel.sinceDay = clock(world.minute).day;
					rel.initiatorId = a.id;
					ab.commitment = 92;
					ba.commitment = 90;
					a.emotions.love = clamp(a.emotions.love + 40);
					b.emotions.love = clamp(b.emotions.love + 40);
					a.emotions.joy = clamp(a.emotions.joy + 30);
					b.emotions.joy = clamp(b.emotions.joy + 30);
					pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "marry"));
					const sharedHome = a.rent >= b.rent ? a.homeId : b.homeId;
					a.homeId = sharedHome;
					b.homeId = sharedHome;
					b.rent = 0;
					const text = `${a.given} cầu hôn và ${b.given} đồng ý. Họ kết hôn và dọn về chung một nhà.`;
					logEvent(world, "marriage", [a.id, b.id], text, 10);
					rememberCouple(world, a, b, a.locationId, text);
				} else {
					a.confessCooldown[b.id] = clock(world.minute).day + 6;
					a.emotions.disappointment = clamp(a.emotions.disappointment + 22);
					pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "reject"));
					logEvent(world, "proposal_reject", [a.id, b.id], `${b.given} chưa muốn kết hôn với ${a.given}.`, 8);
				}
				return true;
			}
		}
		return false;
	}
	if (rel.status === "married" || rel.status === "broken") return false;
	if (ab.affection < 66 || ab.attraction < 54 || ab.familiarity < 28) return false;
	const courage = a.traits.confidence * .5 + ab.affection * .22 - a.traits.trustBarrier * .22;
	if (rng(world) * 100 > courage) {
		if (rng(world) < .4) a.lastThought = `${a.given} muốn nói với ${b.given} một câu quan trọng, nhưng nuốt lại.`;
		a.emotions.hope = clamp(a.emotions.hope + 6);
		return false;
	}
	pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "confess"));
	const acceptScore = ba.affection * .48 + ba.attraction * .28 + rel.compatibility * .22 + b.traits.romance * .12 - b.traits.trustBarrier * .2 - ba.conflict * .4;
	if (!partnerOf(world, b.id) && acceptScore > 78 && ba.affection >= 50) {
		rel.status = "dating";
		rel.sinceDay = clock(world.minute).day;
		rel.initiatorId = a.id;
		ab.commitment = clamp(Math.max(ab.commitment, 28));
		ba.commitment = clamp(Math.max(ba.commitment, 24));
		a.emotions.love = clamp(a.emotions.love + 34);
		b.emotions.love = clamp(b.emotions.love + 28);
		a.emotions.joy = clamp(a.emotions.joy + 26);
		b.emotions.joy = clamp(b.emotions.joy + 22);
		a.needs.affection = clamp(a.needs.affection - 30);
		b.needs.affection = clamp(b.needs.affection - 22);
		pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "accept"));
		const text = `${a.given} tỏ tình với ${b.given} tại ${placeName(a.locationId)}. ${b.given} đồng ý.`;
		logEvent(world, "dating", [a.id, b.id], text, 9);
		rememberCouple(world, a, b, a.locationId, text);
	} else {
		a.confessCooldown[b.id] = clock(world.minute).day + 5;
		a.emotions.disappointment = clamp(a.emotions.disappointment + 30);
		a.emotions.shame = clamp(a.emotions.shame + 16);
		a.emotions.sadness = clamp(a.emotions.sadness + 18);
		a.emotions.hope = clamp(a.emotions.hope - 8);
		ab.affection = clamp(ab.affection - 4);
		b.emotions.shame = clamp(b.emotions.shame + (b.traits.kindness > 60 ? 6 : 2));
		pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "reject"));
		const why = partnerOf(world, b.id) ? `${b.given} đã có người` : `${b.given} không đáp lại`;
		const text = `${a.given} tỏ tình với ${b.given} và bị từ chối. ${why}.`;
		logEvent(world, "reject", [a.id, b.id], text, 8);
		addMemory(world, a, {
			kind: "episodic",
			subjectId: b.id,
			text: `${b.given} từ chối tình cảm của mình tại ${placeName(a.locationId)}.`,
			source: "witnessed",
			importance: 9,
			tags: [
				`with:${b.id}`,
				`place:${a.locationId}`,
				"reject"
			]
		});
		addMemory(world, b, {
			kind: "episodic",
			subjectId: a.id,
			text: `${a.given} tỏ tình. Mình từ chối.`,
			source: "witnessed",
			importance: 8,
			tags: [
				`with:${a.id}`,
				`place:${a.locationId}`,
				"reject"
			]
		});
	}
	return true;
}
function doGift(world, giver, receiver) {
	const gift = giver.holdingGift;
	if (!gift || gift.forId !== receiver.id) return;
	const rel = ensureRel(world, giver.id, receiver.id);
	const placeId = giver.locationId;
	giver.holdingGift = void 0;
	directed(rel, receiver.id).affection = clamp(directed(rel, receiver.id).affection + 14);
	directed(rel, receiver.id).trust = clamp(directed(rel, receiver.id).trust + 8);
	directed(rel, giver.id).affection = clamp(directed(rel, giver.id).affection + 6);
	directed(rel, giver.id).bond = clamp(directed(rel, giver.id).bond + 6);
	directed(rel, receiver.id).bond = clamp(directed(rel, receiver.id).bond + 8);
	receiver.emotions.joy = clamp(receiver.emotions.joy + 26);
	receiver.emotions.love = clamp(receiver.emotions.love + 12);
	giver.emotions.joy = clamp(giver.emotions.joy + 16);
	giver.stats.gifts += 1;
	const text = `${giver.given} tặng ${receiver.given} ${gift.label} tại ${placeName(placeId)}, vì nhớ một điều họ từng kể.`;
	logEvent(world, "gift", [giver.id, receiver.id], text, 8);
	addMemory(world, giver, {
		kind: "episodic",
		subjectId: receiver.id,
		text: `Mình tặng ${receiver.given} ${gift.label}.`,
		source: "self",
		importance: 8,
		tags: [
			"gifted",
			`with:${receiver.id}`,
			`place:${placeId}`,
			`fact:${gift.factKey}`
		]
	});
	addMemory(world, receiver, {
		kind: "episodic",
		subjectId: giver.id,
		text: `${giver.given} tặng mình ${gift.label} vì nhớ chuyện mình từng kể.`,
		source: "witnessed",
		importance: 8,
		tags: [
			"gifted",
			`with:${giver.id}`,
			`place:${placeId}`,
			`fact:${gift.factKey}`
		]
	});
	lockTalk(world, giver, receiver, 30);
	pushLines(world, placeId, giver.id, receiver.id, linesFor(world, giver, receiver, "gift", gift.label));
	refreshStatus(rel);
}
function doArgument(world, a, b, rel) {
	const placeId = a.locationId;
	directed(rel, a.id).conflict = clamp(directed(rel, a.id).conflict + 12);
	directed(rel, b.id).conflict = clamp(directed(rel, b.id).conflict + 11);
	directed(rel, a.id).affection = clamp(directed(rel, a.id).affection - 5);
	directed(rel, b.id).affection = clamp(directed(rel, b.id).affection - 5);
	a.emotions.anger = clamp(a.emotions.anger + 22);
	b.emotions.anger = clamp(b.emotions.anger + 20);
	a.emotions.disappointment = clamp(a.emotions.disappointment + 12);
	b.emotions.disappointment = clamp(b.emotions.disappointment + 12);
	pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "argue"));
	const soften = (a.traits.kindness + b.traits.kindness) / 2 + (directed(rel, a.id).bond + directed(rel, b.id).bond) / 2 * .35 - (a.traits.temper + b.traits.temper) * .12;
	let reconciled = false;
	if (soften > 62 && rng(world) < .72) {
		directed(rel, a.id).conflict = clamp(directed(rel, a.id).conflict - 18);
		directed(rel, b.id).conflict = clamp(directed(rel, b.id).conflict - 16);
		directed(rel, a.id).trust = clamp(directed(rel, a.id).trust + 3);
		directed(rel, b.id).trust = clamp(directed(rel, b.id).trust + 3);
		a.emotions.anger = clamp(a.emotions.anger - 10);
		b.emotions.anger = clamp(b.emotions.anger - 10);
		pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "apology"));
		logEvent(world, "reconcile", [a.id, b.id], `${a.given} và ${b.given} cãi nhau tại ${placeName(placeId)} rồi làm lành.`, 7);
		reconciled = true;
	} else logEvent(world, "argument", [a.id, b.id], `${a.given} và ${b.given} tranh cãi tại ${placeName(placeId)}. Chưa ai chịu nhường.`, 7);
	addMemory(world, a, {
		kind: "episodic",
		subjectId: b.id,
		text: reconciled ? `Cãi với ${b.given} rồi làm lành tại ${placeName(placeId)}.` : `Cãi với ${b.given} tại ${placeName(placeId)}. Mình còn ấm ức.`,
		source: "witnessed",
		importance: 7,
		tags: [
			`with:${b.id}`,
			`place:${placeId}`,
			reconciled ? "reconcile" : "argument"
		]
	});
	addMemory(world, b, {
		kind: "episodic",
		subjectId: a.id,
		text: reconciled ? `Cãi với ${a.given} rồi làm lành.` : `Cãi với ${a.given}. Mình chưa nguôi.`,
		source: "witnessed",
		importance: 7,
		tags: [
			`with:${a.id}`,
			`place:${placeId}`,
			reconciled ? "reconcile" : "argument"
		]
	});
	const commitment = (directed(rel, a.id).commitment + directed(rel, b.id).commitment) / 2;
	const conflict = (directed(rel, a.id).conflict + directed(rel, b.id).conflict) / 2;
	if (!reconciled && (rel.status === "dating" || rel.status === "married") && conflict > 74 && commitment < 52 && rng(world) < .62) breakup(world, a, b, rel);
	lockTalk(world, a, b, 30);
	refreshStatus(rel);
}
function breakup(world, a, b, rel) {
	const wasMarried = rel.status === "married";
	rel.status = wasMarried ? "divorced" : "broken";
	rel.sinceDay = clock(world.minute).day;
	directed(rel, a.id).commitment = 8;
	directed(rel, b.id).commitment = 8;
	directed(rel, a.id).bond = clamp(directed(rel, a.id).bond * .45);
	directed(rel, b.id).bond = clamp(directed(rel, b.id).bond * .45);
	a.emotions.sadness = clamp(a.emotions.sadness + 34);
	b.emotions.sadness = clamp(b.emotions.sadness + 34);
	a.emotions.love = clamp(a.emotions.love * .4);
	b.emotions.love = clamp(b.emotions.love * .4);
	const text = wasMarried ? `${a.given} và ${b.given} ly hôn sau một thời gian không còn hợp.` : `${a.given} chia tay ${b.given}. Cả hai giữ lại ký ức, không giữ lại hẹn ước.`;
	logEvent(world, wasMarried ? "divorce" : "breakup", [a.id, b.id], text, 10);
	pushLines(world, a.locationId, a.id, b.id, linesFor(world, a, b, "break"));
	for (const [one, two] of [[a, b], [b, a]]) addMemory(world, one, {
		kind: "episodic",
		subjectId: two.id,
		text,
		source: "witnessed",
		importance: 10,
		tags: [`with:${two.id}`, wasMarried ? "divorce" : "breakup"]
	});
}
function lockTalk(world, a, b, minutes) {
	a.activity = "socializing";
	b.activity = "socializing";
	a.partnerId = b.id;
	b.partnerId = a.id;
	a.busyUntil = world.minute + minutes;
	b.busyUntil = world.minute + minutes;
	a.talksToday += 1;
	b.talksToday += 1;
	a.stats.talks += 1;
	b.stats.talks += 1;
	a.needs.social = clamp(a.needs.social - 24);
	b.needs.social = clamp(b.needs.social - 22);
	a.needs.affection = clamp(a.needs.affection - 8);
	b.needs.affection = clamp(b.needs.affection - 8);
	world.pairCooldown[pairKey(a.id, b.id)] = world.minute + 55;
}
function interact(world, aId, bId) {
	const a = agent(world, aId);
	const b = agent(world, bId);
	if (a.locationId === "transit" || a.locationId !== b.locationId) return;
	const placeId = a.locationId;
	const rel = ensureRel(world, a.id, b.id);
	const ab = directed(rel, a.id);
	const ba = directed(rel, b.id);
	const first = ab.familiarity < 1 && ba.familiarity < 1;
	if (a.holdingGift?.forId === b.id) {
		doGift(world, a, b);
		return;
	}
	if (b.holdingGift?.forId === a.id) {
		doGift(world, b, a);
		return;
	}
	if (first) {
		const spark = rel.compatibility * (a.traits.romance / 100) * .2;
		const sparkB = rel.compatibility * (b.traits.romance / 100) * .2;
		ab.familiarity = 10;
		ba.familiarity = 10;
		ab.attraction = clamp(spark);
		ba.attraction = clamp(sparkB);
		ab.respect = 8;
		ba.respect = 8;
		const text = `${a.given} và ${b.given} gặp nhau lần đầu tại ${placeName(placeId)}.`;
		logEvent(world, "meet", [a.id, b.id], text, 6);
		addMemory(world, a, {
			kind: "episodic",
			subjectId: b.id,
			text: `Lần đầu gặp ${b.given} tại ${placeName(placeId)}.`,
			source: "witnessed",
			importance: 6,
			tags: [
				`with:${b.id}`,
				`place:${placeId}`,
				"first"
			]
		});
		addMemory(world, b, {
			kind: "episodic",
			subjectId: a.id,
			text: `Lần đầu gặp ${a.given} tại ${placeName(placeId)}.`,
			source: "witnessed",
			importance: 6,
			tags: [
				`with:${a.id}`,
				`place:${placeId}`,
				"first"
			]
		});
		pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "meet"));
	}
	const conflict = (ab.conflict + ba.conflict) / 2;
	const anger = Math.max(a.emotions.anger, b.emotions.anger);
	const jel = Math.max(a.emotions.jealousy, b.emotions.jealousy);
	if (!first && conflict > 50 && ab.familiarity > 16 && (anger > 36 || jel > 46 || conflict > 66)) {
		doArgument(world, a, b, rel);
		jealousyAround(world, a, b, placeId);
		return;
	}
	const vibe = vibeOf(rel, a, b);
	const amount = Math.max(.35, (vibe - 32) / 14);
	if (!first) {
		applyWarm(rel, a, amount * (.75 + b.traits.warmth / 180));
		applyWarm(rel, b, amount * (.75 + a.traits.warmth / 180));
		if (vibe < 34 && a.traits.temper + b.traits.temper > 100) {
			ab.conflict = clamp(ab.conflict + 2);
			ba.conflict = clamp(ba.conflict + 2);
		}
	} else {
		applyWarm(rel, a, amount * .55);
		applyWarm(rel, b, amount * .55);
	}
	a.emotions.joy = clamp(a.emotions.joy + Math.max(0, vibe - 40) * .15);
	b.emotions.joy = clamp(b.emotions.joy + Math.max(0, vibe - 40) * .15);
	a.emotions.loneliness = clamp(a.emotions.loneliness - 8);
	b.emotions.loneliness = clamp(b.emotions.loneliness - 8);
	const summary = `Trò chuyện với ${b.given} tại ${placeName(placeId)}.`;
	if (!first) {
		addMemory(world, a, {
			kind: "episodic",
			subjectId: b.id,
			text: summary,
			source: "witnessed",
			importance: 3,
			tags: [`with:${b.id}`, `place:${placeId}`]
		});
		addMemory(world, b, {
			kind: "episodic",
			subjectId: a.id,
			text: `Trò chuyện với ${a.given} tại ${placeName(placeId)}.`,
			source: "witnessed",
			importance: 3,
			tags: [`with:${a.id}`, `place:${placeId}`]
		});
		pushLines(world, placeId, a.id, b.id, linesFor(world, a, b, "chat"));
	}
	const recalled = maybeCallback(world, a, b, rel).concat(maybeCallback(world, b, a, rel));
	if (recalled.length) pushLines(world, placeId, a.id, b.id, recalled);
	const revealed = maybeReveal(world, a, b, rel).concat(maybeReveal(world, b, a, rel));
	if (revealed.length) pushLines(world, placeId, a.id, b.id, revealed);
	const higher = ab.affection >= ba.affection ? [a, b] : [b, a];
	romanceSpeech(world, higher[0], higher[1], rel);
	if (rel.status === "dating" || rel.status === "married") romanceSpeech(world, higher[1], higher[0], rel);
	refreshStatus(rel);
	lockTalk(world, a, b, first ? 20 : 30);
	jealousyAround(world, a, b, placeId);
	if (rng(world) < .2) logEvent(world, "talk", [a.id, b.id], `${a.given} và ${b.given} nói chuyện tại ${placeName(placeId)}.`, first ? 5 : 3);
}
function jealousyAround(world, a, b, placeId) {
	for (const o of witnesses(world, placeId, [a.id, b.id])) {
		const p = partnerOf(world, o.id);
		if (p !== a.id && p !== b.id) continue;
		const other = p === a.id ? b : a;
		const spike = 8 + o.traits.jealousy * .22;
		o.emotions.jealousy = clamp(o.emotions.jealousy + spike);
		o.emotions.anger = clamp(o.emotions.anger + o.traits.jealousy * .08);
		const rel = ensureRel(world, o.id, p);
		directed(rel, o.id).conflict = clamp(directed(rel, o.id).conflict + 4 + o.traits.jealousy * .1);
		addMemory(world, o, {
			kind: "episodic",
			subjectId: p,
			text: `Thấy ${agent(world, p).given} nói chuyện với ${other.given} tại ${placeName(placeId)}.`,
			source: "witnessed",
			importance: 6,
			tags: [
				`with:${p}`,
				`place:${placeId}`,
				"jealousy",
				`saw:${other.id}`
			]
		});
		if (o.traits.jealousy > 60) logEvent(world, "jealousy", [
			o.id,
			p,
			other.id
		], `${o.given} thấy ${agent(world, p).given} nói chuyện với ${other.given} và cảm thấy ghen.`, 6);
	}
}
function release(world, a) {
	if (a.travel) {
		if (world.minute >= a.travel.endMinute) arrive(world, a);
		return;
	}
	if (a.activity === "working" && a.needs.hunger > 88) a.busyUntil = world.minute;
	if (a.activity === "sleeping" && a.needs.health < 22) a.busyUntil = world.minute;
	if (a.busyUntil > world.minute) return;
	if (a.activity === "working") {
		const shift = shiftOf(a, world);
		const hour = hourOf(world);
		if ((!shift || hour >= shift.end - .25) && !a.paidToday) {
			a.money += a.wage;
			a.paidToday = true;
			if (rng(world) < .4) logEvent(world, "wage", [a.id], `${a.given} nhận lương ngày: ${a.wage}.`, 2);
		}
	}
	if (a.activity === "socializing") {
		clearWorking(a);
		a.partnerId = void 0;
	}
	if (a.activity !== "idle" && a.activity !== "sleeping") a.activity = "idle";
	if (a.activity === "sleeping" && a.busyUntil <= world.minute) a.activity = "idle";
}
function inferHabits(world) {
	for (const watcher of world.agents) {
		watcher.memories = watcher.memories.filter((m) => {
			if (m.kind !== "semantic" || m.source !== "inferred" || !m.factKey?.startsWith("habit:") || !m.subjectId) return true;
			const placeId = m.factKey.slice(6);
			return witnessedCount(watcher, m.subjectId, placeId) >= 3;
		});
		for (const other of world.agents) {
			if (other.id === watcher.id) continue;
			for (const placeId of [
				"park",
				"cafe",
				"mall",
				"restaurant"
			]) {
				if (witnessedCount(watcher, other.id, placeId) < 3) continue;
				if (knowsFact(watcher, other.id, `habit:${placeId}`)) continue;
				const name = placeName(placeId);
				addMemory(world, watcher, {
					kind: "semantic",
					subjectId: other.id,
					text: `${other.given} hay xuất hiện ở ${name}. Mình đoán từ những lần tự thấy.`,
					source: "inferred",
					factKey: `habit:${placeId}`,
					factValue: `hay ở ${name}`,
					importance: 4,
					tags: ["habit", `place:${placeId}`]
				});
			}
		}
	}
}
var DAYS_PER_YEAR = 28;
var BABY_NAMES = [
	"Bông",
	"Sóc",
	"Mầm",
	"Bi",
	"Nắng",
	"Mây",
	"Cốm",
	"Hạt Dẻ",
	"Minh Anh",
	"Gia Bảo"
];
function checkConception(world) {
	const day = clock(world.minute).day;
	for (const rel of world.relationships) {
		if (rel.status !== "married") continue;
		if (day - rel.sinceDay < 4) continue;
		const a = agent(world, rel.aId);
		const b = agent(world, rel.bId);
		if (!a.alive || !b.alive) continue;
		if (a.age > 45 || b.age > 48) continue;
		if (a.pregnantWithId || b.pregnantWithId) continue;
		if (a.childrenIds.length >= 3) continue;
		const avgAff = (rel.aToB.affection + rel.bToA.affection) / 2;
		const avgCon = (rel.aToB.conflict + rel.bToA.conflict) / 2;
		if (avgAff > 72 && avgCon < 25 && a.money + b.money > 500 && rng(world) < .14) {
			const femaleIds = /* @__PURE__ */ new Set([
				"linh",
				"ha",
				"mai",
				"chi"
			]);
			const carrier = femaleIds.has(a.id) ? a : femaleIds.has(b.id) ? b : a;
			const partner = carrier.id === a.id ? b : a;
			carrier.pregnantWithId = partner.id;
			carrier.pregnancyDays = 1;
			carrier.lastThought = `Mình đang mang thai con của ${partner.given}. Mọi thứ sắp thay đổi.`;
			logEvent(world, "pregnancy", [carrier.id, partner.id], `${carrier.given} và ${partner.given} sắp đón con đầu lòng!`, 9);
		}
	}
}
function giveBirth(world, mother, father) {
	const day = clock(world.minute).day;
	const given = BABY_NAMES[Math.floor(rng(world) * BABY_NAMES.length)];
	const familySurname = father.name.split(" ").pop() ?? "Nguyễn";
	const childId = `child_${world.nextId++}`;
	const mixTrait = (k) => clamp(Math.round((mother.traits[k] + father.traits[k]) / 2 + (rng(world) - .5) * 24));
	const child = {
		id: childId,
		name: `${given} ${familySurname}`,
		given,
		age: 0,
		birthDay: day,
		job: "Trẻ nhỏ",
		workplaceId: "school",
		homeId: mother.homeId,
		wage: 0,
		rent: 0,
		money: 0,
		traits: {
			extroversion: mixTrait("extroversion"),
			warmth: mixTrait("warmth"),
			temper: mixTrait("temper"),
			humor: mixTrait("humor"),
			confidence: mixTrait("confidence"),
			romance: mixTrait("romance"),
			selfishness: mixTrait("selfishness"),
			kindness: mixTrait("kindness"),
			jealousy: mixTrait("jealousy"),
			trustBarrier: mixTrait("trustBarrier")
		},
		needs: {
			hunger: 25,
			thirst: 20,
			sleepiness: 20,
			fun: 20,
			social: 20,
			affection: 10,
			safety: 10,
			health: 98
		},
		emotions: {
			joy: 40,
			sadness: 0,
			anger: 0,
			anxiety: 0,
			jealousy: 0,
			shame: 0,
			loneliness: 0,
			disappointment: 0,
			hope: 30,
			love: 35
		},
		facts: [{
			key: "born",
			value: `sinh ra tại thành phố vào ngày ${day + 1}`,
			intimacy: 1
		}],
		bio: `Con của ${father.given} và ${mother.given}.`,
		routine: "Ở nhà cùng bố mẹ cho đến khi đủ tuổi đến Trường Bình Minh.",
		family: `Bố là ${father.given}, mẹ là ${mother.given}.`,
		dream: "Lớn lên thật vui vẻ",
		appearance: {
			skin: rng(world) < .5 ? mother.appearance.skin : father.appearance.skin,
			hair: rng(world) < .5 ? mother.appearance.hair : father.appearance.hair,
			outfit: "#fde68a",
			pants: "#93c5fd",
			hairStyle: rng(world) < .5 ? "short" : "bob",
			height: .55
		},
		memories: [],
		locationId: mother.homeId,
		activity: "sleeping",
		travel: null,
		busyUntil: world.minute + 120,
		activityApplied: false,
		lastThought: "Thế giới rộng lớn quá.",
		lastShopDay: day,
		paidToday: false,
		hadLunch: false,
		hadBreakfast: false,
		talksToday: 0,
		confessCooldown: {},
		workChatty: false,
		stats: {
			sleeps: 0,
			meals: 0,
			talks: 0,
			gifts: 0
		},
		parentIds: [father.id, mother.id],
		childrenIds: [],
		pregnancyDays: 0,
		alive: true
	};
	world.agents.push(child);
	mother.childrenIds.push(child.id);
	father.childrenIds.push(child.id);
	mother.pregnantWithId = void 0;
	mother.pregnancyDays = 0;
	for (const parent of [mother, father]) {
		const rel = ensureRel(world, parent.id, child.id);
		rel.status = "close";
		directed(rel, parent.id).affection = 95;
		directed(rel, parent.id).bond = 95;
		directed(rel, child.id).affection = 95;
		directed(rel, child.id).trust = 95;
	}
	logEvent(world, "birth", [
		mother.id,
		father.id,
		child.id
	], `Bé ${child.given} chào đời! Gia đình ${mother.given} – ${father.given} thêm thành viên mới.`, 10);
}
function processAgingAndFamily(world) {
	const day = clock(world.minute).day;
	checkConception(world);
	for (const a of [...world.agents]) {
		if (!a.alive) continue;
		if (a.pregnantWithId) {
			a.pregnancyDays += 1;
			a.needs.sleepiness = clamp(a.needs.sleepiness + 10);
			if (a.pregnancyDays >= 9) giveBirth(world, a, world.agents.find((x) => x.id === a.pregnantWithId) ?? a);
		}
		const newAge = Math.floor((day - a.birthDay) / DAYS_PER_YEAR);
		if (newAge > a.age) {
			a.age = newAge;
			if (a.age <= 18) a.appearance.height = Number((.55 + a.age / 18 * .45).toFixed(2));
			if (a.age === 6) {
				a.job = "Học sinh tiểu học";
				logEvent(world, "milestone", [a.id], `${a.given} tròn 6 tuổi và bắt đầu đi học tại Trường Bình Minh.`, 7);
			} else if (a.age === 18) {
				a.job = "Nhân viên tự do";
				a.workplaceId = "cafe";
				a.wage = 160;
				logEvent(world, "milestone", [a.id], `${a.given} tròn 18 tuổi, chính thức trưởng thành và bắt đầu đi làm!`, 8);
			} else if (a.age === 60) {
				a.appearance.hair = "#cbd5e1";
				logEvent(world, "milestone", [a.id], `${a.given} bước sang tuổi 60, mái tóc đã điểm bạc.`, 7);
			} else if (a.age === 65 && !a.retired) {
				a.retired = true;
				a.job = "Nghỉ hưu";
				a.wage = 120;
				logEvent(world, "milestone", [a.id], `${a.given} nghỉ hưu ở tuổi 65, tận hưởng tuổi già bình yên.`, 8);
			} else logEvent(world, "birthday", [a.id], `Hôm nay là sinh nhật ${a.age} tuổi của ${a.given}.`, 5);
		}
		if (a.age > 65) {
			const decline = (a.age - 65) * .18;
			a.needs.health = clamp(a.needs.health - decline);
			if (a.age >= 82 && rng(world) < (a.age - 80) * .03) {
				a.alive = false;
				a.activity = "idle";
				logEvent(world, "death", [a.id], `${a.given} đã ra đi thanh thản ở tuổi ${a.age}.`, 10);
			}
		}
	}
}
function onNewDay(world) {
	const c = clock(world.minute);
	const roll = rng(world);
	const next = roll < .58 ? "clear" : roll < .82 ? "cloudy" : "rain";
	if (next !== world.weather) {
		world.weather = next;
		logEvent(world, "weather", [], next === "rain" ? "Trời mưa trên thành phố." : next === "cloudy" ? "Mây kéo dày." : "Trời quang trở lại.", 2);
	} else world.weather = next;
	for (const a of world.agents) {
		if (!a.alive) continue;
		a.hadLunch = false;
		a.hadBreakfast = false;
		a.paidToday = false;
		a.talksToday = 0;
		if (c.dayIndex === 0) {
			a.money -= a.rent;
			if (a.money < 120) {
				a.emotions.anxiety = clamp(a.emotions.anxiety + 12);
				logEvent(world, "rent", [a.id], `${a.given} trả tiền nhà và ví mỏng đi thấy rõ.`, 4);
			}
		}
	}
	for (const rel of world.relationships) {
		c.day - rel.sinceDay;
		for (const dir of [rel.aToB, rel.bToA]) {
			if (dir.familiarity > 0) dir.familiarity = clamp(dir.familiarity - .35);
			if (dir.affection > 0 && rel.status !== "married") dir.affection = clamp(dir.affection - .25);
			if (dir.conflict > 0) dir.conflict = clamp(dir.conflict - 1.1);
		}
	}
	inferHabits(world);
	processAgingAndFamily(world);
}
function step$1(world) {
	const prevDay = Math.floor(world.minute / 1440);
	world.minute += 10;
	if (Math.floor(world.minute / 1440) !== prevDay) onNewDay(world);
	for (const a of world.agents) {
		if (!a.alive) continue;
		release(world, a);
	}
	for (const a of world.agents) {
		if (!a.alive) continue;
		tickNeeds(a, 10);
		tickEmotions(a);
		a.workChatty = a.activity === "working" && serviceJob(a) && rng(world) < .2;
	}
	socialize(world);
	for (const a of world.agents) {
		if (!a.alive) continue;
		if (a.travel) continue;
		if (a.busyUntil > world.minute) continue;
		decide(world, a);
	}
}
function socialize(world) {
	const groups = /* @__PURE__ */ new Map();
	for (const a of world.agents) {
		if (!a.alive || !openToTalk(world, a)) continue;
		const list = groups.get(a.locationId) ?? [];
		list.push(a);
		groups.set(a.locationId, list);
	}
	for (const group of groups.values()) {
		if (group.length < 2) continue;
		const pairs = [];
		for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
			const a = group[i];
			const b = group[j];
			const key = pairKey(a.id, b.id);
			if ((world.pairCooldown[key] ?? 0) > world.minute) continue;
			const rel = ensureRel(world, a.id, b.id);
			const ab = directed(rel, a.id);
			const ba = directed(rel, b.id);
			const curiosity = ab.familiarity < 18 ? 16 : 0;
			const pull = (a.needs.social + b.needs.social) * .22;
			const interest = (ab.affection + ba.affection) * .28 + (ab.attraction + ba.attraction) * .12;
			const shy = (100 - a.traits.confidence) * .08 + (100 - b.traits.confidence) * .08;
			const block = (ab.conflict + ba.conflict) * .18;
			let score = pull + interest + curiosity + rel.compatibility * .08 - shy - block;
			if (a.holdingGift?.forId === b.id || b.holdingGift?.forId === a.id) score += 80;
			if (a.seekTargetId === b.id || b.seekTargetId === a.id) score += 24;
			pairs.push({
				a,
				b,
				score
			});
		}
		pairs.sort((x, y) => y.score - x.score);
		const used = /* @__PURE__ */ new Set();
		for (const p of pairs) {
			if (p.score < 30) continue;
			if (used.has(p.a.id) || used.has(p.b.id)) continue;
			used.add(p.a.id);
			used.add(p.b.id);
			interact(world, p.a.id, p.b.id);
		}
	}
}
//#endregion
//#region src/sim/engine.ts
var SAVE_KEY = "soulmate-save-v1";
function needsOf(hunger, social) {
	return {
		hunger,
		thirst: 28,
		sleepiness: 18,
		fun: 30,
		social,
		affection: 18,
		safety: 22,
		health: 93
	};
}
function emotionsOf() {
	return {
		joy: 18,
		sadness: 6,
		anger: 0,
		anxiety: 8,
		jealousy: 0,
		shame: 0,
		loneliness: 12,
		disappointment: 0,
		hope: 22,
		love: 0
	};
}
function createWorld(seed = 20261120) {
	const world = {
		version: 1,
		seed,
		rngState: seed >>> 0,
		minute: 420,
		weather: "clear",
		agents: [],
		relationships: [],
		events: [],
		lines: [],
		nextId: 1,
		pairCooldown: {}
	};
	world.agents = SEEDS.map((seedAgent) => {
		return {
			id: seedAgent.id,
			name: seedAgent.name,
			given: seedAgent.given,
			age: seedAgent.age,
			job: seedAgent.job,
			workplaceId: seedAgent.workplaceId,
			homeId: seedAgent.homeId,
			wage: seedAgent.wage,
			rent: seedAgent.rent,
			money: seedAgent.money,
			traits: { ...seedAgent.traits },
			needs: needsOf(seedAgent.hunger, seedAgent.social),
			emotions: emotionsOf(),
			facts: seedAgent.facts.map((f) => ({
				...f,
				gift: f.gift ? { ...f.gift } : void 0
			})),
			bio: seedAgent.bio,
			routine: seedAgent.routine,
			family: seedAgent.family,
			dream: seedAgent.dream,
			appearance: { ...seedAgent.appearance },
			memories: [],
			locationId: seedAgent.homeId,
			activity: "idle",
			travel: null,
			busyUntil: 0,
			activityApplied: false,
			lastThought: "Một ngày mới. Mình chưa quyết định gì ngoài việc bước ra cửa.",
			lastShopDay: -3,
			paidToday: false,
			hadLunch: false,
			hadBreakfast: false,
			talksToday: 0,
			confessCooldown: {},
			workChatty: false,
			stats: {
				sleeps: 0,
				meals: 0,
				talks: 0,
				gifts: 0
			},
			birthDay: -seedAgent.age * 28,
			childrenIds: [],
			pregnancyDays: 0,
			alive: true
		};
	});
	for (let i = 0; i < world.agents.length; i++) for (let j = i + 1; j < world.agents.length; j++) {
		const a = world.agents[i];
		const b = world.agents[j];
		const x = a.id < b.id ? a.id : b.id;
		const y = a.id < b.id ? b.id : a.id;
		world.relationships.push({
			aId: x,
			bId: y,
			aToB: {
				familiarity: 0,
				trust: 0,
				respect: 0,
				affection: 0,
				attraction: 0,
				bond: 0,
				conflict: 0,
				commitment: 0
			},
			bToA: {
				familiarity: 0,
				trust: 0,
				respect: 0,
				affection: 0,
				attraction: 0,
				bond: 0,
				conflict: 0,
				commitment: 0
			},
			compatibility: compatibility(a, b),
			status: "stranger",
			sinceDay: 0
		});
	}
	for (const a of world.agents) {
		addMemory(world, a, {
			kind: "episodic",
			text: `${a.family}`,
			source: "self",
			importance: 5,
			tags: ["family", "self"]
		});
		addMemory(world, a, {
			kind: "semantic",
			subjectId: a.id,
			text: a.dream,
			source: "self",
			factKey: "dream",
			factValue: a.dream,
			importance: 6,
			tags: ["self", "dream"]
		});
	}
	world.events.push({
		id: `e${world.nextId++}`,
		day: 0,
		minute: world.minute,
		hour: 7,
		min: 0,
		type: "dawn",
		actorIds: [],
		text: "Thành phố mở mắt. Tám người bắt đầu một ngày mà chưa ai viết sẵn kết cục.",
		importance: 4
	});
	return world;
}
function step(world) {
	step$1(world);
}
function serialize(world) {
	return JSON.stringify({
		...world,
		version: 1
	});
}
function deserialize(raw) {
	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		throw new Error("Bản lưu không đọc được.");
	}
	if (!data || typeof data !== "object") throw new Error("Bản lưu trống.");
	const world = data;
	if (world.version !== 1 || !Array.isArray(world.agents) || world.agents.length < 2) throw new Error("Bản lưu không cùng phiên bản.");
	if (typeof world.minute !== "number" || typeof world.rngState !== "number" || !world.pairCooldown) throw new Error("Bản lưu thiếu thời gian.");
	return world;
}
//#endregion
//#region src/routes/index.tsx?tsr-split=component
var WEATHER = {
	clear: "☀️ Nắng",
	cloudy: "☁️ Nhiều mây",
	rain: "🌧️ Mưa"
};
var NEEDS = [
	["hunger", "Đói"],
	["thirst", "Khát"],
	["sleepiness", "Buồn ngủ"],
	["fun", "Giải trí"],
	["social", "Giao tiếp"],
	["affection", "Tình cảm"],
	["safety", "Bất an"],
	["health", "Sức khỏe"]
];
var MAX_CATCHUP_STEPS = 288;
var slotKey = (n) => `${SAVE_KEY}-slot${n}`;
function save(w, n) {
	try {
		localStorage.setItem(slotKey(n), JSON.stringify({
			t: Date.now(),
			raw: serialize(w)
		}));
	} catch {}
}
function load(n) {
	try {
		const s = localStorage.getItem(slotKey(n));
		if (!s) return null;
		const { t, raw } = JSON.parse(s);
		const w = deserialize(raw);
		const away = Math.max(0, Math.min(MAX_CATCHUP_STEPS, Math.floor((Date.now() - t) / 1e3)));
		for (let i = 0; i < away; i++) step(w);
		return w;
	} catch {
		return null;
	}
}
function geom(W, H) {
	const sc = Math.min(W / (MAP.maxX - MAP.minX), H / (MAP.maxZ - MAP.minZ));
	return {
		sc,
		ox: (W - (MAP.maxX - MAP.minX) * sc) / 2 - MAP.minX * sc,
		oz: (H - (MAP.maxZ - MAP.minZ) * sc) / 2 - MAP.minZ * sc
	};
}
function draw(ctx, w, W, H, minute, sel, t) {
	const { sc, ox, oz } = geom(W, H);
	const X = (x) => ox + x * sc;
	const Z = (z) => oz + z * sc;
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
			ctx.fillRect(X(l.x + b.ox), Z(l.z + b.oz), b.w * sc, b.d * sc * .35);
		} else {
			ctx.fillStyle = "#5f9f5b";
			ctx.beginPath();
			ctx.arc(X(l.x), Z(l.z), l.gather * sc * 2, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = "#1e293b";
		ctx.fillText(l.name, X(l.x), Z(l.z) - 1.2 * sc);
	}
	const hour = minute / 60 % 24;
	const dark = hour >= 20 || hour < 5 ? .45 : hour >= 18 ? (hour - 18) / 2 * .45 : hour < 7 ? (7 - hour) / 2 * .45 : 0;
	if (dark > 0 || w.weather !== "clear") {
		ctx.fillStyle = w.weather === "clear" ? `rgba(10,15,45,${dark})` : `rgba(60,70,95,${Math.max(dark, .2)})`;
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
	const crowd = w.agents.filter((a) => a.alive).map((a) => ({
		a,
		p: agentPosition(a, minute)
	})).sort((m, n) => m.p.z - n.p.z);
	for (const { a, p } of crowd) {
		const f = agentFacing(a, minute);
		const moving = !!a.travel && minute >= a.travel.startMinute && minute < a.travel.endMinute;
		if (a.id === sel) {
			ctx.strokeStyle = "#facc15";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(X(p.x), Z(p.z), 1.1 * sc, .45 * sc, 0, 0, Math.PI * 2);
			ctx.stroke();
		}
		drawAgent(ctx, a, X(p.x), Z(p.z), sc, {
			t,
			moving,
			fx: f.x,
			fz: f.z,
			speaking: talking.has(a.id),
			mood: dominantEmotion(a.emotions),
			rain: w.weather === "rain" && moving
		});
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
function fit(c) {
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
	return {
		ctx,
		W,
		H
	};
}
function Bar({ label, v, good }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center gap-2 text-xs",
		children: [/* @__PURE__ */ jsx("span", {
			className: "w-20 shrink-0 text-slate-400",
			children: label
		}), /* @__PURE__ */ jsx("div", {
			className: "h-2 flex-1 rounded bg-slate-800",
			children: /* @__PURE__ */ jsx("div", {
				className: `h-2 rounded ${(good ? v < 35 : v > 70) ? "bg-rose-500" : "bg-emerald-500"}`,
				style: { width: `${Math.round(v)}%` }
			})
		})]
	});
}
function Home() {
	const worldRef = useRef(null);
	const canvasRef = useRef(null);
	const boxRef = useRef(null);
	const speedRef = useRef(1);
	const selRef = useRef(null);
	const slotRef = useRef(1);
	const animRef = useRef(0);
	const roomRef = useRef(null);
	const portraitRef = useRef(null);
	const ambientRef = useRef(null);
	const [sound, setSound] = useState(false);
	const [, setTick] = useState(0);
	const [speed, setSpeed] = useState(1);
	const [slot, setSlot] = useState(1);
	const [sel, setSel] = useState(null);
	useEffect(() => {
		worldRef.current = load(slot) ?? createWorld();
		setTick((t) => t + 1);
	}, [slot]);
	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		let acc = 0;
		let hud = 0;
		const frame = (now) => {
			const w = worldRef.current;
			const c = canvasRef.current;
			const box = boxRef.current;
			const dt = Math.min(.25, (now - last) / 1e3);
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
				const sa = selRef.current ? w.agents.find((x) => x.id === selRef.current) : void 0;
				const rc = roomRef.current ? fit(roomRef.current) : null;
				if (rc && sa) {
					if (sa.travel) {
						rc.ctx.fillStyle = "#0f172a";
						rc.ctx.fillRect(0, 0, rc.W, rc.H);
						rc.ctx.fillStyle = "#94a3b8";
						rc.ctx.font = "13px sans-serif";
						rc.ctx.textAlign = "center";
						rc.ctx.fillText("Đang trên đường…", rc.W / 2, rc.H / 2);
					} else drawRoom(rc.ctx, rc.W, rc.H, w, location(sa.locationId), animRef.current, sa.id);
				}
				const pt = portraitRef.current ? fit(portraitRef.current) : null;
				if (pt && sa) {
					pt.ctx.fillStyle = "#1e293b";
					pt.ctx.fillRect(0, 0, pt.W, pt.H);
					drawAgent(pt.ctx, sa, pt.W / 2, pt.H * 1.22, pt.H * .3, {
						t: animRef.current,
						moving: false,
						fx: 0,
						fz: 1,
						speaking: false,
						mood: dominantEmotion(sa.emotions),
						badge: false
					});
				}
				hud += dt;
				if (hud > .4) {
					hud = 0;
					ambientRef.current?.update(w.weather, w.minute / 60 % 24, !!sa && !sa.travel && location(sa.locationId).kind !== "park");
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
		const iv = setInterval(persist, 15e3);
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
	const pick = (id) => {
		selRef.current = id;
		setSel(id);
	};
	const setSpeedBoth = (s) => {
		speedRef.current = s;
		setSpeed(s);
	};
	const onPick = (e) => {
		const w = worldRef.current;
		const c = canvasRef.current;
		if (!w || !c) return;
		const r = c.getBoundingClientRect();
		const { sc, ox, oz } = geom(r.width, r.height);
		const wx = (e.clientX - r.left - ox) / sc;
		const wz = (e.clientY - r.top - oz) / sc;
		let best = null;
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
	const changeSlot = (n) => {
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
	const activeRel = a ? w?.relationships.find((r) => (r.aId === a.id || r.bId === a.id) && (r.status === "dating" || r.status === "married")) : void 0;
	const spouseOrPartnerId = activeRel ? activeRel.aId === a?.id ? activeRel.bId : activeRel.aId : a?.partnerId;
	const partner = spouseOrPartnerId ? w?.agents.find((x) => x.id === spouseOrPartnerId) : void 0;
	const isMarried = activeRel?.status === "married";
	const childrenNames = a?.childrenIds.map((cid) => w?.agents.find((x) => x.id === cid)?.given).filter(Boolean).join(", ");
	const btn = "rounded-md px-3 py-1.5 text-sm font-medium";
	return /* @__PURE__ */ jsxs("main", {
		className: "flex h-dvh flex-col bg-slate-950 text-slate-100 lg:flex-row",
		children: [/* @__PURE__ */ jsxs("section", {
			className: "flex min-h-0 flex-1 flex-col",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex flex-wrap items-center gap-2 p-2 text-sm",
				children: [
					/* @__PURE__ */ jsx("b", { children: w ? formatClock(w.minute) : "Đang tải thế giới…" }),
					/* @__PURE__ */ jsx("span", { children: w ? WEATHER[w.weather] : "" }),
					/* @__PURE__ */ jsxs("span", {
						className: "ml-auto flex flex-wrap gap-1",
						children: [
							[
								0,
								1,
								4,
								16
							].map((s) => /* @__PURE__ */ jsx("button", {
								onClick: () => setSpeedBoth(s),
								className: `${btn} ${speed === s ? "bg-sky-600" : "bg-slate-800"}`,
								children: s === 0 ? "⏸" : `${s}x`
							}, s)),
							/* @__PURE__ */ jsx("select", {
								value: slot,
								onChange: (e) => changeSlot(Number(e.target.value)),
								className: `${btn} bg-slate-800`,
								children: [
									1,
									2,
									3
								].map((n) => /* @__PURE__ */ jsxs("option", {
									value: n,
									children: ["Ô lưu ", n]
								}, n))
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: newWorld,
								className: `${btn} bg-slate-800`,
								children: "Thế giới mới"
							}),
							/* @__PURE__ */ jsx("button", {
								onClick: toggleSound,
								className: `${btn} ${sound ? "bg-sky-600" : "bg-slate-800"}`,
								"aria-label": "Âm thanh",
								children: sound ? "🔊" : "🔇"
							})
						]
					})
				]
			}), /* @__PURE__ */ jsx("div", {
				ref: boxRef,
				className: "relative min-h-0 flex-1",
				children: /* @__PURE__ */ jsx("canvas", {
					ref: canvasRef,
					onPointerDown: onPick,
					className: "absolute inset-0 size-full touch-none"
				})
			})]
		}), /* @__PURE__ */ jsxs("aside", {
			className: "max-h-[42dvh] space-y-3 overflow-y-auto border-t border-slate-800 p-3 text-sm lg:max-h-none lg:w-96 lg:border-l lg:border-t-0",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "flex flex-wrap gap-1",
					children: w?.agents.filter((x) => x.alive).map((x) => /* @__PURE__ */ jsx("button", {
						onClick: () => pick(x.id),
						className: `${btn} ${x.id === sel ? "bg-amber-500 text-slate-900" : "bg-slate-800"}`,
						children: x.given
					}, x.id))
				}),
				a ? /* @__PURE__ */ jsxs("div", {
					className: "space-y-2",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ jsx("canvas", {
								ref: portraitRef,
								className: "size-22 shrink-0 rounded-lg"
							}), /* @__PURE__ */ jsxs("h2", {
								className: "text-base font-semibold",
								children: [
									a.name,
									" · ",
									a.age,
									" tuổi · ",
									a.job
								]
							})]
						}),
						/* @__PURE__ */ jsx("canvas", {
							ref: roomRef,
							className: "h-44 w-full rounded-lg"
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "text-slate-300",
							children: [
								activityLabel(a),
								" · ",
								dominantEmotion(a.emotions).label,
								" · ",
								Math.round(a.money).toLocaleString("vi-VN"),
								"đ",
								partner ? ` · ${isMarried ? "Vợ/Chồng" : "Người yêu"}: ${partner.given}` : "",
								a.pregnantWithId ? ` · 🤰 Mang thai (${a.pregnancyDays}/9 ngày)` : "",
								childrenNames ? ` · 👶 Con: ${childrenNames}` : ""
							]
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "italic text-slate-400",
							children: [
								"“",
								a.lastThought,
								"”"
							]
						}),
						NEEDS.map(([k, label]) => /* @__PURE__ */ jsx(Bar, {
							label,
							v: a.needs[k],
							good: k === "health"
						}, k))
					]
				}) : /* @__PURE__ */ jsx("p", {
					className: "text-slate-400",
					children: "Chạm vào một nhân vật trên bản đồ để xem nhu cầu, cảm xúc và suy nghĩ của họ."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "space-y-1 border-t border-slate-800 pt-2",
					children: [/* @__PURE__ */ jsx("h3", {
						className: "font-semibold",
						children: "Nhật ký thế giới"
					}), w?.events.slice(-8).reverse().map((ev) => /* @__PURE__ */ jsxs("p", {
						className: "text-xs text-slate-300",
						children: [
							/* @__PURE__ */ jsxs("span", {
								className: "text-slate-500",
								children: [
									String(ev.hour).padStart(2, "0"),
									":",
									String(ev.min).padStart(2, "0")
								]
							}),
							" ",
							ev.text
						]
					}, ev.id))]
				})
			]
		})]
	});
}
//#endregion
export { Home as component };
