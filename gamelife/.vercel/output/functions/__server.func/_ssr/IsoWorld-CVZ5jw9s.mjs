import { i as __toESM } from "../_runtime.mjs";
import { c as Fog, d as SRGBColorSpace, f as Vector3, h as require_react, i as useThree, l as NearestFilter, m as require_jsx_runtime, n as Canvas, o as CanvasTexture, r as useFrame, s as Color, t as Html, u as Object3D } from "../_libs/@react-three/drei+[...].mjs";
import { a as LOCATIONS, c as ROADS_Z, i as agentPosition, l as TREE_SPOTS, n as CanvasMap, o as MAP, r as agentFacing, s as ROADS_X } from "./routes-Drads-HU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/IsoWorld-CVZ5jw9s.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var _dir = new Vector3();
var _right = new Vector3();
var _up = new Vector3();
function facadeTexture(wall) {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 96;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.fillStyle = wall;
	ctx.fillRect(0, 0, 64, 96);
	for (let y = 10; y < 86; y += 22) for (let x = 8; x < 56; x += 16) {
		ctx.fillStyle = "#1b2430";
		ctx.fillRect(x, y, 9, 12);
		ctx.fillStyle = "rgba(255, 214, 150, 0.72)";
		ctx.fillRect(x + 1, y + 1, 7, 5);
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.magFilter = NearestFilter;
	texture.minFilter = NearestFilter;
	return texture;
}
function recentLine(world, id) {
	for (let i = world.lines.length - 1; i >= 0; i--) {
		const line = world.lines[i];
		if (!line || line.speakerId !== id) continue;
		if (world.minute - line.minute <= 18) return line.text.length > 42 ? `${line.text.slice(0, 41)}…` : line.text;
	}
	return null;
}
function CameraRig({ targetRef, zoomRef, followRef, pointRef }) {
	const camera = useThree((state) => state.camera);
	const apply = () => {
		const target = targetRef.current;
		if (!target) return;
		if (followRef.current && pointRef.current) {
			target.x += (pointRef.current.x - target.x) * .08;
			target.z += (pointRef.current.z - target.z) * .08;
		}
		target.x = Math.max(MAP.minX + 6, Math.min(MAP.maxX - 6, target.x));
		target.z = Math.max(MAP.minZ + 6, Math.min(MAP.maxZ - 6, target.z));
		camera.position.set(target.x + 32, 36, target.z + 32);
		camera.lookAt(target.x, .4, target.z);
		camera.zoom += (zoomRef.current - camera.zoom) * .18;
		camera.updateProjectionMatrix();
	};
	(0, import_react.useLayoutEffect)(apply);
	useFrame(apply);
	return null;
}
function FollowPoint({ worldRef, minuteRef, selectedRef, followRef, pointRef }) {
	const scratch = (0, import_react.useRef)({
		x: 0,
		z: 0
	});
	useFrame(() => {
		const world = worldRef.current;
		const id = selectedRef.current;
		if (!world || !id || !followRef.current) {
			pointRef.current = null;
			return;
		}
		const person = world.agents.find((agent) => agent.id === id && agent.alive);
		if (!person) {
			pointRef.current = null;
			return;
		}
		const p = agentPosition(person, minuteRef.current);
		scratch.current.x = p.x;
		scratch.current.z = p.z;
		pointRef.current = scratch.current;
	});
	return null;
}
function MapControls({ targetRef, zoomRef, followRef, onReleaseFollow }) {
	const { camera, gl } = useThree();
	const releaseRef = (0, import_react.useRef)(onReleaseFollow);
	releaseRef.current = onReleaseFollow;
	(0, import_react.useEffect)(() => {
		const el = gl.domElement;
		const pointers = /* @__PURE__ */ new Map();
		let pinch = null;
		let lx = 0;
		let ly = 0;
		let moved = 0;
		const down = (event) => {
			pointers.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY
			});
			lx = event.clientX;
			ly = event.clientY;
			moved = 0;
		};
		const move = (event) => {
			if (!pointers.has(event.pointerId)) return;
			pointers.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY
			});
			if (pointers.size >= 2) {
				const pts = [...pointers.values()];
				const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
				if (pinch) zoomRef.current = Math.max(9, Math.min(38, zoomRef.current * (dist / pinch)));
				pinch = dist;
				return;
			}
			const dx = event.clientX - lx;
			const dy = event.clientY - ly;
			lx = event.clientX;
			ly = event.clientY;
			moved += Math.abs(dx) + Math.abs(dy);
			if (moved < 6 || !targetRef.current) return;
			if (followRef.current) {
				followRef.current = false;
				releaseRef.current();
			}
			const wpp = 1 / Math.max(1, camera.zoom);
			camera.getWorldDirection(_dir);
			_right.crossVectors(_dir, camera.up).normalize();
			_up.crossVectors(_right, _dir).normalize();
			targetRef.current.x -= (_right.x * dx + _up.x * dy) * wpp;
			targetRef.current.z -= (_right.z * dx + _up.z * dy) * wpp;
		};
		const up = (event) => {
			pointers.delete(event.pointerId);
			if (pointers.size < 2) pinch = null;
		};
		const wheel = (event) => {
			event.preventDefault();
			zoomRef.current = Math.max(9, Math.min(38, zoomRef.current * (event.deltaY > 0 ? .92 : 1.08)));
		};
		el.addEventListener("pointerdown", down);
		el.addEventListener("pointermove", move);
		el.addEventListener("pointerup", up);
		el.addEventListener("pointercancel", up);
		el.addEventListener("wheel", wheel, { passive: false });
		return () => {
			el.removeEventListener("pointerdown", down);
			el.removeEventListener("pointermove", move);
			el.removeEventListener("pointerup", up);
			el.removeEventListener("pointercancel", up);
			el.removeEventListener("wheel", wheel);
		};
	}, [
		camera,
		followRef,
		gl,
		targetRef,
		zoomRef
	]);
	return null;
}
function Atmosphere({ minuteRef, weatherRef }) {
	const { scene } = useThree();
	const bg = (0, import_react.useMemo)(() => new Color("#c5d4c0"), []);
	const sun = (0, import_react.useRef)(null);
	const amb = (0, import_react.useRef)(null);
	const hemi = (0, import_react.useRef)(null);
	useFrame(() => {
		const hour = (minuteRef.current / 60 % 24 + 24) % 24;
		const night = hour >= 20 || hour < 5.5;
		const dusk = !night && (hour >= 17.2 || hour < 7);
		const rain = weatherRef.current === "rain";
		bg.set(rain ? "#8e98a4" : night ? "#1a2230" : dusk ? "#e7c2a2" : "#c9d7bf");
		scene.background = bg;
		if (scene.fog instanceof Fog) scene.fog.color.copy(bg);
		if (sun.current) {
			sun.current.intensity = night ? .08 : dusk ? .72 : 1.2;
			sun.current.color.set(night ? "#9eb6e8" : dusk ? "#ffb27a" : "#fff6e4");
		}
		if (amb.current) amb.current.intensity = night ? .22 : .48;
		if (hemi.current) hemi.current.intensity = night ? .15 : .38;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ambientLight", {
			ref: amb,
			intensity: .48,
			color: "#f4ecdf"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("hemisphereLight", {
			ref: hemi,
			args: [
				"#d5e7ff",
				"#6d945f",
				.35
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("directionalLight", {
			ref: sun,
			position: [
				28,
				46,
				16
			],
			intensity: 1.15,
			castShadow: true,
			"shadow-mapSize-width": 1024,
			"shadow-mapSize-height": 1024,
			"shadow-camera-near": 2,
			"shadow-camera-far": 150,
			"shadow-camera-left": -55,
			"shadow-camera-right": 55,
			"shadow-camera-top": 55,
			"shadow-camera-bottom": -55
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("fog", {
			attach: "fog",
			args: [
				"#c9d7bf",
				55,
				150
			]
		})
	] });
}
function District() {
	const cx = (MAP.minX + MAP.maxX) / 2;
	const cz = (MAP.minZ + MAP.maxZ) / 2;
	const textures = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const place of LOCATIONS) {
			const wall = place.build?.wall;
			if (!wall || map.has(wall)) continue;
			const texture = facadeTexture(wall);
			if (texture) map.set(wall, texture);
		}
		return map;
	}, []);
	(0, import_react.useEffect)(() => () => {
		textures.forEach((texture) => texture.dispose());
	}, [textures]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				cx,
				0,
				cz
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [MAP.maxX - MAP.minX + 16, MAP.maxZ - MAP.minZ + 16] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#6d9464" })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				-22,
				.015,
				1
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [30, 50] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#7c9a67" })]
		}),
		ROADS_X.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				x,
				.03,
				cz
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				2.15,
				.05,
				MAP.maxZ - MAP.minZ
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#4c525b" })]
		}, `rx${x}`)),
		ROADS_Z.map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			position: [
				cx,
				.04,
				z
			],
			receiveShadow: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
				MAP.maxX - MAP.minX,
				.05,
				2.15
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#5b616a" })]
		}, `rz${z}`)),
		LOCATIONS.map((place) => {
			const build = place.build;
			if (!build) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
				position: [
					place.x,
					0,
					place.z
				],
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						rotation: [
							-Math.PI / 2,
							0,
							0
						],
						position: [
							0,
							.02,
							0
						],
						receiveShadow: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circleGeometry", { args: [place.gather * 2.1, 22] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#87b173" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							.28,
							0
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
							.55,
							.62,
							.28,
							12
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#b7cedc" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							.7,
							0
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
							.22,
							10,
							8
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#d5ebf5" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Html, {
						position: [
							0,
							2.2,
							0
						],
						center: true,
						distanceFactor: 28,
						pointerEvents: "none",
						style: { pointerEvents: "none" },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "citizen-name",
							children: place.name
						})
					})
				]
			}, place.id);
			const px = place.x + build.ox + build.w / 2;
			const pz = place.z + build.oz + build.d / 2;
			const height = build.h * (build.floors ? .72 + build.floors * .28 : 1);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
				position: [
					px,
					0,
					pz
				],
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							height / 2,
							0
						],
						castShadow: true,
						receiveShadow: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
							build.w,
							height,
							build.d
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", {
							map: textures.get(build.wall) ?? null,
							color: textures.get(build.wall) ? "#ffffff" : build.wall
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							height + .16,
							0
						],
						castShadow: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
							build.w + .4,
							.32,
							build.d + .4
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: build.roof })]
					}),
					build.awning ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							height * .46,
							build.d / 2 + .28
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
							build.w * .72,
							.08,
							.55
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#f2d3a2" })]
					}) : null,
					place.kind !== "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Html, {
						position: [
							0,
							height + 1.1,
							0
						],
						center: true,
						distanceFactor: 30,
						pointerEvents: "none",
						style: { pointerEvents: "none" },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "citizen-name",
							children: place.name
						})
					}) : null
				]
			}, place.id);
		})
	] });
}
function Trees() {
	const trunk = (0, import_react.useRef)(null);
	const crown = (0, import_react.useRef)(null);
	(0, import_react.useLayoutEffect)(() => {
		const dummy = new Object3D();
		TREE_SPOTS.forEach((spot, index) => {
			dummy.position.set(spot.x, .4, spot.z);
			dummy.scale.set(1, spot.s, 1);
			dummy.rotation.set(0, 0, 0);
			dummy.updateMatrix();
			trunk.current?.setMatrixAt(index, dummy.matrix);
			dummy.position.set(spot.x, 1.15 * spot.s, spot.z);
			dummy.scale.set(spot.s, spot.s, spot.s);
			dummy.updateMatrix();
			crown.current?.setMatrixAt(index, dummy.matrix);
		});
		if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true;
		if (crown.current) crown.current.instanceMatrix.needsUpdate = true;
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("instancedMesh", {
		ref: trunk,
		args: [
			void 0,
			void 0,
			TREE_SPOTS.length
		],
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("cylinderGeometry", { args: [
			.1,
			.16,
			.8,
			5
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#6b4632" })]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("instancedMesh", {
		ref: crown,
		args: [
			void 0,
			void 0,
			TREE_SPOTS.length
		],
		castShadow: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			.62,
			8,
			6
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#3e6b44" })]
	})] });
}
function Hair({ style, color }) {
	if (style === "long") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		position: [
			0,
			1.18,
			-.06
		],
		castShadow: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
			.36,
			.58,
			.22
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color })]
	});
	if (style === "bun") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		position: [
			0,
			1.52,
			-.02
		],
		castShadow: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			.11,
			8,
			8
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color })]
	});
	if (style === "bob") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		position: [
			0,
			1.28,
			.02
		],
		castShadow: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			.23,
			10,
			8
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color })]
	});
	if (style === "spiky") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		position: [
			0,
			1.52,
			0
		],
		castShadow: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("coneGeometry", { args: [
			.16,
			.28,
			5
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color })]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
		position: [
			0,
			1.46,
			0
		],
		castShadow: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
			.18,
			8,
			8
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color })]
	});
}
function Citizen({ agent, minuteRef, animRef, selected, line, showName, onSelect }) {
	const root = (0, import_react.useRef)(null);
	const body = (0, import_react.useRef)(null);
	const left = (0, import_react.useRef)(null);
	const right = (0, import_react.useRef)(null);
	useFrame(() => {
		const group = root.current;
		const pose = body.current;
		if (!group || !pose) return;
		const minute = minuteRef.current;
		const t = animRef.current;
		const p = agentPosition(agent, minute);
		const facing = agentFacing(agent, minute);
		const moving = !!agent.travel && minute >= agent.travel.startMinute && minute < agent.travel.endMinute;
		const asleep = agent.activity === "sleeping";
		const sit = agent.activity === "eating" || agent.activity === "drinking" || agent.activity === "relaxing" || agent.activity === "socializing";
		group.position.set(p.x, asleep ? .32 : sit ? -.12 : moving ? Math.abs(Math.sin(t * 8)) * .05 : 0, p.z);
		pose.rotation.set(asleep ? Math.PI / 2.15 : 0, Math.atan2(facing.x, facing.z), 0);
		pose.scale.setScalar(Math.max(.45, agent.appearance.height));
		const swing = moving ? Math.sin(t * 8) * .65 : 0;
		if (left.current) left.current.rotation.x = swing;
		if (right.current) right.current.rotation.x = -swing;
	});
	const look = agent.appearance;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
		ref: root,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("group", {
				ref: body,
				onClick: (event) => {
					event.stopPropagation();
					onSelect(agent.id);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							.86,
							0
						],
						castShadow: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
							.38,
							.58,
							.22
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: look.outfit })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						ref: left,
						position: [
							-.12,
							.34,
							0
						],
						castShadow: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
							.1,
							.42,
							.1
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: look.pants })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						ref: right,
						position: [
							.12,
							.34,
							0
						],
						castShadow: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
							.1,
							.42,
							.1
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: look.pants })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							1.32,
							0
						],
						castShadow: true,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("sphereGeometry", { args: [
							.18,
							12,
							10
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: look.skin })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hair, {
						style: look.hairStyle,
						color: look.hair
					}),
					look.glasses ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
						position: [
							0,
							1.32,
							.14
						],
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("boxGeometry", { args: [
							.26,
							.05,
							.03
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshStandardMaterial", { color: "#243044" })]
					}) : null
				]
			}),
			selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
				rotation: [
					-Math.PI / 2,
					0,
					0
				],
				position: [
					0,
					.05,
					0
				],
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ringGeometry", { args: [
					.46,
					.6,
					24
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", { color: "#e6c27a" })]
			}) : null,
			showName || line ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Html, {
				position: [
					0,
					2.15,
					0
				],
				center: true,
				distanceFactor: 18,
				pointerEvents: "none",
				style: { pointerEvents: "none" },
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "citizen-stack",
					children: [line ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "citizen-line",
						children: line
					}) : null, showName ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "citizen-name",
						children: agent.given
					}) : null]
				})
			}) : null
		]
	});
}
function Rain({ weatherRef, targetRef }) {
	const ref = (0, import_react.useRef)(null);
	const positions = (0, import_react.useMemo)(() => {
		const arr = /* @__PURE__ */ new Float32Array(480);
		for (let i = 0; i < 160; i++) {
			arr[i * 3] = (Math.random() - .5) * 36;
			arr[i * 3 + 1] = Math.random() * 18;
			arr[i * 3 + 2] = (Math.random() - .5) * 36;
		}
		return arr;
	}, []);
	useFrame((_, dt) => {
		const points = ref.current;
		const target = targetRef.current;
		if (!points || !target) return;
		points.visible = weatherRef.current === "rain";
		points.position.set(target.x, 0, target.z);
		if (!points.visible) return;
		const attr = points.geometry.attributes.position;
		for (let i = 0; i < 160; i++) {
			let y = attr.getY(i) - dt * 16;
			if (y < .2) y = 16;
			attr.setY(i, y);
		}
		attr.needsUpdate = true;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("points", {
		ref,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("bufferGeometry", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("bufferAttribute", {
			attach: "attributes-position",
			args: [positions, 3]
		}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pointsMaterial", {
			color: "#e4eeff",
			size: .12,
			transparent: true,
			opacity: .75
		})]
	});
}
function Scene(props) {
	const targetRef = (0, import_react.useRef)(new Vector3(4, 0, 0));
	const pointRef = (0, import_react.useRef)(null);
	const weatherRef = (0, import_react.useRef)("clear");
	const world = props.worldRef.current;
	if (world) weatherRef.current = world.weather;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FollowPoint, {
			worldRef: props.worldRef,
			minuteRef: props.minuteRef,
			selectedRef: props.selectedRef,
			followRef: props.followRef,
			pointRef
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraRig, {
			targetRef,
			zoomRef: props.zoomRef,
			followRef: props.followRef,
			pointRef
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapControls, {
			targetRef,
			zoomRef: props.zoomRef,
			followRef: props.followRef,
			onReleaseFollow: props.onReleaseFollow
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Atmosphere, {
			minuteRef: props.minuteRef,
			weatherRef
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(District, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trees, {}),
		props.quality === "high" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rain, {
			weatherRef,
			targetRef
		}) : null,
		world ? world.agents.filter((person) => person.alive).map((person) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Citizen, {
			agent: person,
			minuteRef: props.minuteRef,
			animRef: props.animRef,
			selected: props.selectedRef.current === person.id,
			line: recentLine(world, person.id),
			showName: props.quality !== "low" || props.selectedRef.current === person.id,
			onSelect: props.onSelect
		}, person.id)) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("mesh", {
			rotation: [
				-Math.PI / 2,
				0,
				0
			],
			position: [
				4,
				.011,
				0
			],
			onClick: () => props.onSelect(null),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("planeGeometry", { args: [140, 100] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meshBasicMaterial", {
				transparent: true,
				opacity: 0,
				depthWrite: false
			})]
		})
	] });
}
var WebGLBoundary = class extends import_react.Component {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		if (this.state.failed) return this.props.fallback;
		return this.props.children;
	}
};
function IsoCanvas(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Canvas, {
		className: "touch-none",
		orthographic: true,
		shadows: props.quality !== "low",
		dpr: props.quality === "high" ? [1, 1.6] : props.quality === "med" ? [1, 1.25] : 1,
		camera: {
			position: [
				36,
				40,
				36
			],
			zoom: props.zoomRef.current,
			near: .1,
			far: 420
		},
		gl: {
			antialias: props.quality !== "low",
			powerPreference: "high-performance"
		},
		onCreated: ({ gl }) => {
			gl.toneMapping = 4;
			gl.outputColorSpace = SRGBColorSpace;
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scene, { ...props })
	});
}
function IsoStage(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WebGLBoundary, {
		fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CanvasMap, { ...props }),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IsoCanvas, { ...props })
	});
}
//#endregion
export { IsoStage };
