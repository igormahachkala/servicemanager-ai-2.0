// Canvas geometry for the flow graph.

export interface NodePos { x: number; y: number; w: number; }
export interface Point { x: number; y: number; }

export const CANVAS_W = 840;
export const CANVAS_H = 720;
export const NODE_H = 76;
export const PORT_DY = 38;

export const NODE_POS: Record<string, NodePos> = {
  cto:       { x: 40,  y: 300, w: 204 },
  max:       { x: 560, y: 120, w: 230 },
  architect: { x: 560, y: 24,  w: 230 },
  qa:        { x: 560, y: 216, w: 230 },
  devops:    { x: 560, y: 312, w: 230 },
  assistant: { x: 560, y: 408, w: 230 },
  ceo:       { x: 320, y: 520, w: 200 },
  cfo:       { x: 560, y: 504, w: 200 },
  coo:       { x: 560, y: 600, w: 200 },
};

export const outPort = (id: string): Point => {
  const p = NODE_POS[id];
  return { x: p.x + p.w, y: p.y + PORT_DY };
};

export const inPort = (id: string): Point => {
  const p = NODE_POS[id];
  return { x: p.x, y: p.y + PORT_DY };
};

export const bezier = (a: Point, b: Point): string =>
  `M${a.x},${a.y} C${a.x + 55},${a.y} ${b.x - 55},${b.y} ${b.x},${b.y}`;
