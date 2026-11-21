"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import type { CanvasAction, CanvasNode } from "./canvas-model.mjs";
import { minimumCanvasSize } from "./canvas-model.mjs";
import type { CanvasLayout } from "./model.mjs";

type Point = { x: number; y: number };
type Viewport = CanvasLayout["viewport"];
type Gesture = {
  kind: "pan" | "node" | "resize" | "pinch";
  pointerId: number;
  start: Point;
  latest: Point;
  time: number;
  velocity: Point;
  viewport: Viewport;
  layout: CanvasLayout;
  node?: CanvasNode;
  distance?: number;
  moved: boolean;
  started: number;
  touch: boolean;
  reduced: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const center = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export default function useCanvasMotion(options: {
  windowRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  arranging: boolean;
  layout: CanvasLayout;
  getViewport: () => Viewport;
  onViewport: (next: Viewport, save?: boolean, animate?: boolean) => void;
  onLayout: (action: CanvasAction, base?: CanvasLayout) => void;
  onSelect: (id: string) => void;
  onBeginArrange: () => void;
}) {
  const input = useRef(options);
  useEffect(() => {
    input.current = options;
  });
  const gesture = useRef<Gesture | null>(null);
  const points = useRef(new Map<number, Point>());
  const frame = useRef(0);
  const suppressClick = useRef(0);
  const multiple = useRef(false);
  const captures = useRef(new Map<number, HTMLElement>());
  const [dropPreview, setDropPreview] = useState<CanvasNode | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function applyFrame(commit = false) {
    frame.current = 0;
    const active = gesture.current,
      config = input.current;
    if (!active) return;
    if (active.kind === "pinch") {
      const [a, b] = [...points.current.values()];
      const rect = config.windowRef.current?.getBoundingClientRect();
      if (!a || !b || !rect) return;
      const mid = center(a, b),
        zoom = clamp(
          (active.viewport.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
            active.distance!,
          0.5,
          1.8,
        );
      config.onViewport({
        zoom,
        x:
          mid.x -
          rect.left -
          ((active.start.x - rect.left - active.viewport.x) * zoom) /
            active.viewport.zoom,
        y:
          mid.y -
          rect.top -
          ((active.start.y - rect.top - active.viewport.y) * zoom) /
            active.viewport.zoom,
      });
      active.moved = true;
      return;
    }
    const point = points.current.get(active.pointerId);
    if (!point) return;
    const dx = point.x - active.start.x,
      dy = point.y - active.start.y;
    if (!active.moved && Math.hypot(dx, dy) < (active.touch ? 8 : 4)) return;
    if (!active.moved && active.kind === "node") {
      if (active.touch && active.time - active.started < 180) {
        active.kind = "pan";
        active.node = undefined;
      } else if (active.node) {
        if (!config.arranging) config.onBeginArrange();
        config.onSelect(active.node.id);
        setDraggingId(active.node.id);
      }
    }
    active.moved = true;
    if (active.kind === "pan") {
      config.onViewport({
        ...active.viewport,
        x: active.viewport.x + dx,
        y: active.viewport.y + dy,
      });
    } else if (active.node) {
      const node = active.node,
        zoom = active.viewport.zoom;
      const min = minimumCanvasSize(node);
      const action: CanvasAction =
        active.kind === "resize"
          ? {
              type: "resize",
              id: node.id,
              width: clamp(node.width + dx / zoom, min.width, 560),
              height: clamp(node.height + dy / zoom, min.height, 560),
            }
          : {
              type: "position",
              id: node.id,
              x: Math.max(0, node.x + dx / zoom),
              y: Math.max(0, node.y + dy / zoom),
            };
      if (active.reduced && !commit) {
        setDropPreview({ ...node, ...action });
        return;
      }
      config.onLayout(action, active.layout);
    }
  }

  function capture(event: PointerEvent, node?: CanvasNode, resize = false) {
    if (event.button !== 0) return;
    const config = input.current;
    if (gesture.current?.kind === "pinch") return;
    event.preventDefault();
    event.stopPropagation();
    const world = config.windowRef.current?.querySelector(".canvas-world");
    if (world) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(world).transform);
      config.onViewport({ x: matrix.e, y: matrix.f, zoom: matrix.a });
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    captures.current.set(event.pointerId, event.currentTarget as HTMLElement);
    if (node && event.pointerType === "mouse")
      (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    const point = { x: event.clientX, y: event.clientY };
    points.current.set(event.pointerId, point);
    gesture.current = {
      kind: node ? (resize ? "resize" : "node") : "pan",
      pointerId: event.pointerId,
      start: point,
      latest: point,
      time: event.timeStamp,
      velocity: { x: 0, y: 0 },
      viewport: config.getViewport(),
      layout: config.layout,
      node,
      moved: false,
      started: event.timeStamp,
      touch: event.pointerType === "touch",
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    if (node) {
      if (resize) {
        config.onSelect(node.id);
        setDraggingId(node.id);
      }
    }
    setInteracting(true);
  }

  function onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.current.size !== 2) return;
    multiple.current = true;
    setDropPreview(null);
    const [a, b] = [...points.current.values()],
      config = input.current;
    gesture.current = {
      kind: "pinch",
      pointerId: event.pointerId,
      start: center(a, b),
      latest: center(a, b),
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      time: event.timeStamp,
      velocity: { x: 0, y: 0 },
      viewport: config.getViewport(),
      layout: config.layout,
      moved: false,
      started: event.timeStamp,
      touch: true,
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    captures.current.set(event.pointerId, event.currentTarget);
    setDraggingId(null);
    setInteracting(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!points.current.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    points.current.set(event.pointerId, point);
    const active = gesture.current;
    if (!active) return;
    const elapsed = event.timeStamp - active.time;
    if (active.pointerId === event.pointerId && elapsed > 0) {
      active.velocity = {
        x: clamp((point.x - active.latest.x) / elapsed, -2, 2),
        y: clamp((point.y - active.latest.y) / elapsed, -2, 2),
      };
      active.latest = point;
      active.time = event.timeStamp;
    }
    if (!frame.current)
      frame.current = requestAnimationFrame(() => applyFrame());
  }

  function stop(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const active = gesture.current;
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    if (
      active &&
      (active.pointerId === event.pointerId || active.kind === "pinch")
    ) {
      if (!cancelled) applyFrame(true);
      const config = input.current;
      if (active.kind === "pan" || active.kind === "pinch") {
        const view = config.getViewport();
        const coast =
          active.kind === "pan" &&
          !cancelled &&
          active.moved &&
          event.timeStamp - active.time < 70 &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches;
        config.onViewport(
          coast
            ? {
                ...view,
                x: view.x + active.velocity.x * 140,
                y: view.y + active.velocity.y * 140,
              }
            : view,
          true,
          !!coast,
        );
      }
      if (active.moved) suppressClick.current = performance.now() + 350;
      gesture.current = null;
      setInteracting(false);
      setDraggingId(null);
      setDropPreview(null);
    }
    points.current.delete(event.pointerId);
    if (multiple.current) suppressClick.current = performance.now() + 350;
    if (!points.current.size) multiple.current = false;
    const captured = captures.current.get(event.pointerId);
    if (captured?.hasPointerCapture(event.pointerId))
      captured.releasePointerCapture(event.pointerId);
    captures.current.delete(event.pointerId);
  }

  useEffect(() => {
    const element = options.windowRef.current;
    if (!element || !options.enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const config = input.current,
        view = config.getViewport(),
        rect = element!.getBoundingClientRect();
      const zoom = clamp(
        view.zoom * Math.exp(-clamp(event.deltaY, -120, 120) * 0.002),
        0.5,
        1.8,
      );
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      config.onViewport({
        zoom,
        x: x - ((x - view.x) * zoom) / view.zoom,
        y: y - ((y - view.y) * zoom) / view.zoom,
      });
      clearTimeout(timer);
      timer = setTimeout(
        () => config.onViewport(config.getViewport(), true),
        160,
      );
    }
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      clearTimeout(timer);
      element.removeEventListener("wheel", wheel);
    };
  }, [options.enabled, options.windowRef]);
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  useEffect(() => {
    function abort() {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      points.current.clear();
      for (const [id, element] of captures.current)
        if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      captures.current.clear();
      gesture.current = null;
      setInteracting(false);
      setDraggingId(null);
      setDropPreview(null);
      suppressClick.current = performance.now() + 350;
    }
    const visibility = () => {
      if (document.hidden) abort();
    };
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return {
    interacting,
    draggingId,
    dropPreview,
    canClick: () => performance.now() > suppressClick.current,
    isBackgroundTap: () =>
      gesture.current?.kind === "pan" && !gesture.current.moved,
    beginNode: (event: PointerEvent, node: CanvasNode) => capture(event, node),
    beginResize: (event: PointerEvent, node: CanvasNode) =>
      capture(event, node, true),
    onPointerDownCapture,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!(event.target as HTMLElement).closest("button")) capture(event);
    },
    onPointerMove,
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => stop(event),
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => stop(event, true),
  };
}
