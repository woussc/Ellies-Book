import type { Budget, CanvasLayout, NodeSize } from "./model.mjs";
export type CanvasNode = {
  id: string;
  kind: "budget" | "category" | "expense" | "notes";
  title: string;
  recordId: string;
  categoryId?: string;
  status?: string;
  size: NodeSize;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type CanvasAction =
  | { type: "position"; id: string; x: number; y: number }
  | { type: "size"; id: string; size: NodeSize }
  | { type: "viewport"; x: number; y: number; zoom: number }
  | { type: "auto" };
export function canvasLayout(budget: Budget): CanvasLayout;
export function recoverCanvasViewport(
  nodes: CanvasNode[],
  viewport: CanvasLayout["viewport"],
  frame: { width: number; height: number },
): CanvasLayout["viewport"];
export function canvasGraph(
  budget: Budget,
  layout?: CanvasLayout,
  condensed?: boolean,
  phone?: boolean,
): {
  nodes: CanvasNode[];
  edges: {
    from: string;
    to: string;
    type: "allocation" | "entry" | "note";
    label: string;
  }[];
  width: number;
  height: number;
};
export function changeCanvas(budget: Budget, action: CanvasAction): Budget;
