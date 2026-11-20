import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import type { World } from "@/sim/types";
import { drawFlat, pickAgent } from "./canvas2d";

type Props = {
  worldRef: { current: World | null };
  minuteRef: { current: number };
  animRef: { current: number };
  selectedRef: { current: string | null };
  onSelect: (id: string | null) => void;
};

export function CanvasMap({ worldRef, minuteRef, animRef, selectedRef, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      const box = boxRef.current;
      const world = worldRef.current;
      if (canvas && box && world) {
        const dpr = window.devicePixelRatio || 1;
        const width = box.clientWidth;
        const height = box.clientHeight;
        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (ctx && width > 0 && height > 0) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawFlat(ctx, world, width, height, minuteRef.current, selectedRef.current, animRef.current);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [animRef, minuteRef, selectedRef, worldRef]);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const world = worldRef.current;
    const canvas = canvasRef.current;
    if (!world || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    onSelect(pickAgent(world, rect.width, rect.height, event.clientX - rect.left, event.clientY - rect.top, minuteRef.current));
  };

  return (
    <div ref={boxRef} className="absolute inset-0">
      <canvas ref={canvasRef} onPointerDown={onPointerDown} className="size-full touch-none" />
    </div>
  );
}
