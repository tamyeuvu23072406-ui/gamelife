import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import * as THREE from "three";
import { LOCATIONS, MAP, ROADS_X, ROADS_Z, TREE_SPOTS } from "@/sim/data";
import { agentFacing, agentPosition } from "@/sim/path";
import type { Agent, World } from "@/sim/types";
import { CanvasMap } from "./CanvasMap";

export type Quality = "low" | "med" | "high";

type StageProps = {
  worldRef: { current: World | null };
  minuteRef: { current: number };
  animRef: { current: number };
  selectedRef: { current: string | null };
  followRef: { current: boolean };
  quality: Quality;
  revision: number;
  onSelect: (id: string | null) => void;
  onReleaseFollow: () => void;
  zoomRef: { current: number };
};

const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

function facadeTexture(wall: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 64, 96);
  for (let y = 10; y < 86; y += 22) {
    for (let x = 8; x < 56; x += 16) {
      ctx.fillStyle = "#1b2430";
      ctx.fillRect(x, y, 9, 12);
      ctx.fillStyle = "rgba(255, 214, 150, 0.72)";
      ctx.fillRect(x + 1, y + 1, 7, 5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function recentLine(world: World, id: string): string | null {
  for (let i = world.lines.length - 1; i >= 0; i--) {
    const line = world.lines[i];
    if (!line || line.speakerId !== id) continue;
    if (world.minute - line.minute <= 18) return line.text.length > 42 ? `${line.text.slice(0, 41)}…` : line.text;
  }
  return null;
}

function CameraRig({
  targetRef,
  zoomRef,
  followRef,
  pointRef,
}: {
  targetRef: RefObject<THREE.Vector3>;
  zoomRef: { current: number };
  followRef: { current: boolean };
  pointRef: { current: { x: number; z: number } | null };
}) {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera;
  const apply = () => {
    const target = targetRef.current;
    if (!target) return;
    if (followRef.current && pointRef.current) {
      target.x += (pointRef.current.x - target.x) * 0.08;
      target.z += (pointRef.current.z - target.z) * 0.08;
    }
    target.x = Math.max(MAP.minX + 6, Math.min(MAP.maxX - 6, target.x));
    target.z = Math.max(MAP.minZ + 6, Math.min(MAP.maxZ - 6, target.z));
    camera.position.set(target.x + 32, 36, target.z + 32);
    camera.lookAt(target.x, 0.4, target.z);
    camera.zoom += (zoomRef.current - camera.zoom) * 0.18;
    camera.updateProjectionMatrix();
  };
  useLayoutEffect(apply);
  useFrame(apply);
  return null;
}

function FollowPoint({
  worldRef,
  minuteRef,
  selectedRef,
  followRef,
  pointRef,
}: {
  worldRef: { current: World | null };
  minuteRef: { current: number };
  selectedRef: { current: string | null };
  followRef: { current: boolean };
  pointRef: { current: { x: number; z: number } | null };
}) {
  const scratch = useRef({ x: 0, z: 0 });
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

function MapControls({
  targetRef,
  zoomRef,
  followRef,
  onReleaseFollow,
}: {
  targetRef: RefObject<THREE.Vector3>;
  zoomRef: { current: number };
  followRef: { current: boolean };
  onReleaseFollow: () => void;
}) {
  const { camera, gl } = useThree();
  const releaseRef = useRef(onReleaseFollow);
  releaseRef.current = onReleaseFollow;
  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: number | null = null;
    let lx = 0;
    let ly = 0;
    let moved = 0;
    const down = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      lx = event.clientX;
      ly = event.clientY;
      moved = 0;
    };
    const move = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
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
      const cam = camera as THREE.OrthographicCamera;
      const wpp = 1 / Math.max(1, cam.zoom);
      camera.getWorldDirection(_dir);
      _right.crossVectors(_dir, camera.up).normalize();
      _up.crossVectors(_right, _dir).normalize();
      targetRef.current.x -= (_right.x * dx + _up.x * dy) * wpp;
      targetRef.current.z -= (_right.z * dx + _up.z * dy) * wpp;
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomRef.current = Math.max(9, Math.min(38, zoomRef.current * (event.deltaY > 0 ? 0.92 : 1.08)));
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
  }, [camera, followRef, gl, targetRef, zoomRef]);
  return null;
}

function Atmosphere({
  minuteRef,
  weatherRef,
}: {
  minuteRef: { current: number };
  weatherRef: { current: World["weather"] };
}) {
  const { scene } = useThree();
  const bg = useMemo(() => new THREE.Color("#c5d4c0"), []);
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useFrame(() => {
    const hour = (((minuteRef.current / 60) % 24) + 24) % 24;
    const night = hour >= 20 || hour < 5.5;
    const dusk = !night && (hour >= 17.2 || hour < 7);
    const rain = weatherRef.current === "rain";
    bg.set(rain ? "#8e98a4" : night ? "#1a2230" : dusk ? "#e7c2a2" : "#c9d7bf");
    scene.background = bg;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(bg);
    if (sun.current) {
      sun.current.intensity = night ? 0.08 : dusk ? 0.72 : 1.2;
      sun.current.color.set(night ? "#9eb6e8" : dusk ? "#ffb27a" : "#fff6e4");
    }
    if (amb.current) amb.current.intensity = night ? 0.22 : 0.48;
    if (hemi.current) hemi.current.intensity = night ? 0.15 : 0.38;
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.48} color="#f4ecdf" />
      <hemisphereLight ref={hemi} args={["#d5e7ff", "#6d945f", 0.35]} />
      <directionalLight
        ref={sun}
        position={[28, 46, 16]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={150}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
      />
      <fog attach="fog" args={["#c9d7bf", 55, 150]} />
    </>
  );
}

function District() {
  const cx = (MAP.minX + MAP.maxX) / 2;
  const cz = (MAP.minZ + MAP.maxZ) / 2;
  const textures = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    for (const place of LOCATIONS) {
      const wall = place.build?.wall;
      if (!wall || map.has(wall)) continue;
      const texture = facadeTexture(wall);
      if (texture) map.set(wall, texture);
    }
    return map;
  }, []);
  useEffect(
    () => () => {
      textures.forEach((texture) => texture.dispose());
    },
    [textures],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[MAP.maxX - MAP.minX + 16, MAP.maxZ - MAP.minZ + 16]} />
        <meshStandardMaterial color="#6d9464" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-22, 0.015, 1]} receiveShadow>
        <planeGeometry args={[30, 50]} />
        <meshStandardMaterial color="#7c9a67" />
      </mesh>
      {ROADS_X.map((x) => (
        <mesh key={`rx${x}`} position={[x, 0.03, cz]} receiveShadow>
          <boxGeometry args={[2.15, 0.05, MAP.maxZ - MAP.minZ]} />
          <meshStandardMaterial color="#4c525b" />
        </mesh>
      ))}
      {ROADS_Z.map((z) => (
        <mesh key={`rz${z}`} position={[cx, 0.04, z]} receiveShadow>
          <boxGeometry args={[MAP.maxX - MAP.minX, 0.05, 2.15]} />
          <meshStandardMaterial color="#5b616a" />
        </mesh>
      ))}
      {LOCATIONS.map((place) => {
        const build = place.build;
        if (!build) {
          return (
            <group key={place.id} position={[place.x, 0, place.z]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
                <circleGeometry args={[place.gather * 2.1, 22]} />
                <meshStandardMaterial color="#87b173" />
              </mesh>
              <mesh position={[0, 0.28, 0]}>
                <cylinderGeometry args={[0.55, 0.62, 0.28, 12]} />
                <meshStandardMaterial color="#b7cedc" />
              </mesh>
              <mesh position={[0, 0.7, 0]}>
                <sphereGeometry args={[0.22, 10, 8]} />
                <meshStandardMaterial color="#d5ebf5" />
              </mesh>
              <Html position={[0, 2.2, 0]} center distanceFactor={28} pointerEvents="none" style={{ pointerEvents: "none" }}>
                <div className="citizen-name">{place.name}</div>
              </Html>
            </group>
          );
        }
        const px = place.x + build.ox + build.w / 2;
        const pz = place.z + build.oz + build.d / 2;
        const height = build.h * (build.floors ? 0.72 + build.floors * 0.28 : 1);
        return (
          <group key={place.id} position={[px, 0, pz]}>
            <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[build.w, height, build.d]} />
              <meshStandardMaterial map={textures.get(build.wall) ?? null} color={textures.get(build.wall) ? "#ffffff" : build.wall} />
            </mesh>
            <mesh position={[0, height + 0.16, 0]} castShadow>
              <boxGeometry args={[build.w + 0.4, 0.32, build.d + 0.4]} />
              <meshStandardMaterial color={build.roof} />
            </mesh>
            {build.awning ? (
              <mesh position={[0, height * 0.46, build.d / 2 + 0.28]}>
                <boxGeometry args={[build.w * 0.72, 0.08, 0.55]} />
                <meshStandardMaterial color="#f2d3a2" />
              </mesh>
            ) : null}
            {place.kind !== "home" ? (
              <Html position={[0, height + 1.1, 0]} center distanceFactor={30} pointerEvents="none" style={{ pointerEvents: "none" }}>
                <div className="citizen-name">{place.name}</div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function Trees() {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    TREE_SPOTS.forEach((spot, index) => {
      dummy.position.set(spot.x, 0.4, spot.z);
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
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, TREE_SPOTS.length]}>
        <cylinderGeometry args={[0.1, 0.16, 0.8, 5]} />
        <meshStandardMaterial color="#6b4632" />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, TREE_SPOTS.length]} castShadow>
        <sphereGeometry args={[0.62, 8, 6]} />
        <meshStandardMaterial color="#3e6b44" />
      </instancedMesh>
    </group>
  );
}

function Hair({ style, color }: { style: Agent["appearance"]["hairStyle"]; color: string }) {
  if (style === "long") {
    return (
      <mesh position={[0, 1.18, -0.06]} castShadow>
        <boxGeometry args={[0.36, 0.58, 0.22]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  if (style === "bun") {
    return (
      <mesh position={[0, 1.52, -0.02]} castShadow>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  if (style === "bob") {
    return (
      <mesh position={[0, 1.28, 0.02]} castShadow>
        <sphereGeometry args={[0.23, 10, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  if (style === "spiky") {
    return (
      <mesh position={[0, 1.52, 0]} castShadow>
        <coneGeometry args={[0.16, 0.28, 5]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 1.46, 0]} castShadow>
      <sphereGeometry args={[0.18, 8, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Citizen({
  agent,
  minuteRef,
  animRef,
  selected,
  line,
  showName,
  onSelect,
}: {
  agent: Agent;
  minuteRef: { current: number };
  animRef: { current: number };
  selected: boolean;
  line: string | null;
  showName: boolean;
  onSelect: (id: string) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
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
    const sit =
      agent.activity === "eating" ||
      agent.activity === "drinking" ||
      agent.activity === "relaxing" ||
      agent.activity === "socializing";
    group.position.set(p.x, asleep ? 0.32 : sit ? -0.12 : moving ? Math.abs(Math.sin(t * 8)) * 0.05 : 0, p.z);
    pose.rotation.set(asleep ? Math.PI / 2.15 : 0, Math.atan2(facing.x, facing.z), 0);
    pose.scale.setScalar(Math.max(0.45, agent.appearance.height));
    const swing = moving ? Math.sin(t * 8) * 0.65 : 0;
    if (left.current) left.current.rotation.x = swing;
    if (right.current) right.current.rotation.x = -swing;
  });
  const look = agent.appearance;
  return (
    <group ref={root}>
      <group ref={body} onClick={(event) => { event.stopPropagation(); onSelect(agent.id); }}>
        <mesh position={[0, 0.86, 0]} castShadow>
          <boxGeometry args={[0.38, 0.58, 0.22]} />
          <meshStandardMaterial color={look.outfit} />
        </mesh>
        <mesh ref={left} position={[-0.12, 0.34, 0]} castShadow>
          <boxGeometry args={[0.1, 0.42, 0.1]} />
          <meshStandardMaterial color={look.pants} />
        </mesh>
        <mesh ref={right} position={[0.12, 0.34, 0]} castShadow>
          <boxGeometry args={[0.1, 0.42, 0.1]} />
          <meshStandardMaterial color={look.pants} />
        </mesh>
        <mesh position={[0, 1.32, 0]} castShadow>
          <sphereGeometry args={[0.18, 12, 10]} />
          <meshStandardMaterial color={look.skin} />
        </mesh>
        <Hair style={look.hairStyle} color={look.hair} />
        {look.glasses ? (
          <mesh position={[0, 1.32, 0.14]}>
            <boxGeometry args={[0.26, 0.05, 0.03]} />
            <meshStandardMaterial color="#243044" />
          </mesh>
        ) : null}
      </group>
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.46, 0.6, 24]} />
          <meshBasicMaterial color="#e6c27a" />
        </mesh>
      ) : null}
      {showName || line ? (
        <Html position={[0, 2.15, 0]} center distanceFactor={18} pointerEvents="none" style={{ pointerEvents: "none" }}>
          <div className="citizen-stack">
            {line ? <div className="citizen-line">{line}</div> : null}
            {showName ? <div className="citizen-name">{agent.given}</div> : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function Rain({
  weatherRef,
  targetRef,
}: {
  weatherRef: { current: World["weather"] };
  targetRef: RefObject<THREE.Vector3>;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 36;
      arr[i * 3 + 1] = Math.random() * 18;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 36;
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
    const attr = points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 160; i++) {
      let y = attr.getY(i) - dt * 16;
      if (y < 0.2) y = 16;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#e4eeff" size={0.12} transparent opacity={0.75} />
    </points>
  );
}

function Scene(props: StageProps) {
  const targetRef = useRef(new THREE.Vector3(4, 0, 0));
  const pointRef = useRef<{ x: number; z: number } | null>(null);
  const weatherRef = useRef<World["weather"]>("clear");
  const world = props.worldRef.current;
  if (world) weatherRef.current = world.weather;
  return (
    <>
      <FollowPoint
        worldRef={props.worldRef}
        minuteRef={props.minuteRef}
        selectedRef={props.selectedRef}
        followRef={props.followRef}
        pointRef={pointRef}
      />
      <CameraRig targetRef={targetRef} zoomRef={props.zoomRef} followRef={props.followRef} pointRef={pointRef} />
      <MapControls
        targetRef={targetRef}
        zoomRef={props.zoomRef}
        followRef={props.followRef}
        onReleaseFollow={props.onReleaseFollow}
      />
      <Atmosphere minuteRef={props.minuteRef} weatherRef={weatherRef} />
      <District />
      <Trees />
      {props.quality === "high" ? <Rain weatherRef={weatherRef} targetRef={targetRef} /> : null}
      {world
        ? world.agents
            .filter((person) => person.alive)
            .map((person) => (
              <Citizen
                key={person.id}
                agent={person}
                minuteRef={props.minuteRef}
                animRef={props.animRef}
                selected={props.selectedRef.current === person.id}
                line={recentLine(world, person.id)}
                showName={props.quality !== "low" || props.selectedRef.current === person.id}
                onSelect={props.onSelect}
              />
            ))
        : null}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[4, 0.011, 0]}
        onClick={() => props.onSelect(null)}
      >
        <planeGeometry args={[140, 100]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

class WebGLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function IsoCanvas(props: StageProps) {
  return (
    <Canvas
      className="touch-none"
      orthographic
      shadows={props.quality !== "low"}
      dpr={props.quality === "high" ? [1, 1.6] : props.quality === "med" ? [1, 1.25] : 1}
      camera={{ position: [36, 40, 36], zoom: props.zoomRef.current, near: 0.1, far: 420 }}
      gl={{ antialias: props.quality !== "low", powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}

export function IsoStage(props: StageProps) {
  return (
    <WebGLBoundary fallback={<CanvasMap {...props} />}>
      <IsoCanvas {...props} />
    </WebGLBoundary>
  );
}
