import type { Budget, CanvasLayout, NodeSize } from "./model.mjs";
export type CanvasScene =
  | "all"
  | "overview"
  | "budget"
  | "committed"
  | "paid"
  | "notes";
export type CanvasNode = {
  id: string;
  kind: "budget" | "cluster" | "balance" | "category" | "expense" | "notes";
  shape: "standard" | "compact" | "signal" | "circle" | "pill" | "wide";
  group: "budget" | "committed" | "paid" | "notes";
  title: string;
  recordId: string;
  categoryId?: string;
  status?: string;
  size: NodeSize;
  x: number;
  y: number;
  width: number;
  height: number;
  minimumWidth?: number;
  minimumHeight?: number;
};
export type CanvasAction = (
  | { type: "position"; id: string; x: number; y: number }
  | { type: "size"; id: string; size: NodeSize }
  | { type: "resize"; id: string; width: number; height: number }
  | { type: "viewport"; x: number; y: number; zoom: number }
  | { type: "auto" }
) & {
  scene?: CanvasScene;
  phone?: boolean;
  frameWidth?: number;
  context?: string | null;
};
export function settleCanvasNodes(
  nodes: CanvasNode[],
  anchorId?: string,
): CanvasNode[];
export function fitCanvasViewport(
  nodes: CanvasNode[],
  frame: { width: number; height: number },
): {
  viewport: CanvasLayout["viewport"];
  complete: boolean;
};
export function canvasLayout(budget: Budget): CanvasLayout;
export function canvasNodeInfo(
  budget: Budget,
  node: CanvasNode,
): { value: string; full: string; caption: string; negative?: boolean };
export function canvasHitBounds(
  node: CanvasNode,
  zoom: number,
): {
  left: number;
  top: number;
  width: number;
  height: number;
};
export function minimumCanvasSize(node: CanvasNode): {
  width: number;
  height: number;
};
export function recoverCanvasViewport(
  nodes: CanvasNode[],
  viewport: CanvasLayout["viewport"],
  frame: { width: number; height: number },
  previousFrame?: { width: number; height: number },
): CanvasLayout["viewport"];
export function canvasGraph(
  budget: Budget,
  layout?: CanvasLayout,
  condensed?: boolean,
  phone?: boolean,
  scene?: CanvasScene,
  frameWidth?: number,
  context?: string | null,
): {
  nodes: CanvasNode[];
  edges: {
    from: string;
    to: string;
    type: "allocation" | "entry" | "note" | "summary" | "membership";
    label: string;
  }[];
  width: number;
  height: number;
};
export function changeCanvas(budget: Budget, action: CanvasAction): Budget;
