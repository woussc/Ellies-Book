"use client";

import { useEffect, useRef, useState } from "react";
import { settleCanvasNodes, type CanvasNode } from "./canvas-model.mjs";

type Point = { x: number; y: number };

export default function useWidgetPositions(
  nodes: CanvasNode[],
  scene: string,
  dragged: string | null,
) {
  const targets = useRef(nodes);
  const positions = useRef(
    new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }])),
  );
  const velocities = useRef(new Map<string, Point>());
  const previousScene = useRef(scene);
  const [paint, setPaint] = useState(() => ({
    scene,
    positions: new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }])),
  }));
  const signature = nodes
    .map((n) => `${n.id}:${n.x}:${n.y}:${n.width}:${n.height}`)
    .join("|");
  useEffect(() => {
    targets.current = nodes;
  });
  useEffect(() => {
    let frame = 0,
      last = performance.now(),
      quiet = 0;
    const started = last;
    const reset = previousScene.current !== scene;
    previousScene.current = scene;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const immediate = () => {
      positions.current = new Map(
        targets.current.map((n) => [n.id, { x: n.x, y: n.y }]),
      );
      velocities.current.clear();
      setPaint({ scene, positions: positions.current });
    };
    function tick(now: number) {
      if (reset || media.matches || document.hidden) {
        immediate();
        return;
      }
      const dt = Math.min(1 / 30, Math.max(0.001, (now - last) / 1000));
      last = now;
      let speed = 0;
      const next = targets.current.map((node) => {
        const p = positions.current.get(node.id) ?? node;
        const v = velocities.current.get(node.id) ?? { x: 0, y: 0 };
        if (node.id === dragged) {
          velocities.current.set(node.id, { x: 0, y: 0 });
          return node;
        }
        const damping = Math.exp(-24 * dt);
        const velocity = {
          x: (v.x + 180 * (node.x - p.x) * dt) * damping,
          y: (v.y + 180 * (node.y - p.y) * dt) * damping,
        };
        velocities.current.set(node.id, velocity);
        speed = Math.max(speed, Math.hypot(velocity.x, velocity.y));
        return { ...node, x: p.x + velocity.x * dt, y: p.y + velocity.y * dt };
      });
      const separated = settleCanvasNodes(next, dragged ?? undefined);
      const error = Math.max(
        0,
        ...separated.map((n, i) =>
          Math.hypot(n.x - targets.current[i].x, n.y - targets.current[i].y),
        ),
      );
      if (speed < 8 && error < 0.5) {
        if (!quiet) quiet = now;
      } else quiet = 0;
      if (now - started >= 600 || (quiet && now - quiet >= 120)) {
        immediate();
        return;
      }
      positions.current = new Map(
        separated.map((n) => [n.id, { x: n.x, y: n.y }]),
      );
      setPaint({ scene, positions: positions.current });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    const settle = () => {
      cancelAnimationFrame(frame);
      immediate();
    };
    const visibility = () => {
      if (document.hidden) settle();
    };
    media.addEventListener("change", settle);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", settle);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [signature, scene, dragged]);
  return paint.scene === scene
    ? nodes.map((n) => ({ ...n, ...paint.positions.get(n.id) }))
    : nodes;
}
