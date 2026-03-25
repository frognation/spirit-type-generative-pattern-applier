import { BaseEffect } from './BaseEffect';
import { FractalParams } from '../types';
import { makeRGBA8 } from '../utils/webgl';
import { getMaskPixels } from '../utils/textMask';

interface Node { x: number; y: number; }
interface Branch { x: number; y: number; px: number; py: number; } // SVG path segments

export class FractalEffect extends BaseEffect {
  private params: FractalParams;
  private attractors: Node[] = [];
  private nodes: Node[] = [];      // growing network nodes
  private branches: Branch[] = []; // for SVG export
  private tex!: WebGLTexture;
  private buf!: Uint8Array;
  private done = false;
  private svgData: string | null = null;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: FractalParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.build(mask);
  }

  private build(mask: Float32Array) {
    const w = this.width, h = this.height;
    const validPx = getMaskPixels(mask, 0.5);
    const n = this.params.numAttractors;

    // Attractors = random points inside letter shapes
    this.attractors = [];
    for (let i = 0; i < n; i++) {
      const idx = validPx[(Math.random() * validPx.length) | 0];
      this.attractors.push({ x: idx % w, y: (idx / w) | 0 });
    }

    // Seed nodes at attractor cluster centroids (letter center)
    this.nodes = [];
    this.branches = [];
    // Place one root node per letter region (simplified: one node near center)
    const cx = w / 2, cy = h / 2;
    const rootIdx = validPx.reduce((best, idx) => {
      const x = idx % w, y = (idx / w) | 0;
      return (x-cx)*(x-cx)+(y-cy)*(y-cy) < (best%w-cx)*(best%w-cx)+(((best/w)|0)-cy)*(((best/w)|0)-cy) ? idx : best;
    }, validPx[0]);
    this.nodes.push({ x: rootIdx % w, y: (rootIdx / w) | 0 });

    this.buf = new Uint8Array(w * h * 4);
    // Fill initial letter pixels as bright background
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0.5) {
        this.buf[i*4] = 30; this.buf[i*4+1] = 30; this.buf[i*4+2] = 30; this.buf[i*4+3] = 255;
      } else {
        this.buf[i*4+3] = 255;
      }
    }

    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = makeRGBA8(gl, w, h);
    this.uploadTex();
    this.done = false; this.step = 0; this.svgData = null;
  }

  private uploadTex() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.buf);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private dist(a: Node, b: Node): number {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx*dx + dy*dy);
  }

  tick() {
    if (this.done) return;
    const p = this.params;
    const newNodes: Node[] = [];

    // Space colonization step
    // For each attractor, find closest node
    const closestMap = new Map<Node, { dx: number; dy: number; count: number }>();
    for (const att of this.attractors) {
      let closest: Node | null = null;
      let minD = Infinity;
      for (const node of this.nodes) {
        const d = this.dist(att, node);
        if (d < minD) { minD = d; closest = node; }
      }
      if (!closest || minD > p.killDist * 20) continue;
      const cur = closestMap.get(closest) ?? { dx: 0, dy: 0, count: 0 };
      const d = Math.max(0.001, Math.sqrt((att.x-closest.x)**2+(att.y-closest.y)**2));
      cur.dx += (att.x - closest.x) / d;
      cur.dy += (att.y - closest.y) / d;
      cur.count++;
      closestMap.set(closest, cur);
    }

    // Grow new nodes
    for (const [node, { dx, dy, count }] of closestMap) {
      if (count === 0) continue;
      const len = Math.sqrt(dx*dx + dy*dy);
      const nx = node.x + (dx/len) * p.segmentLen;
      const ny = node.y + (dy/len) * p.segmentLen;
      // Must stay inside mask
      const ix = Math.round(nx), iy = Math.round(ny);
      if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) continue;
      if (this.mask[iy*this.width+ix] < 0.4) continue;
      const newNode: Node = { x: nx, y: ny };
      newNodes.push(newNode);
      this.branches.push({ x: nx, y: ny, px: node.x, py: node.y });
      // Draw branch on buffer
      this.drawLine(node.x, node.y, nx, ny);
    }

    // Kill attractors that are too close to any node
    this.attractors = this.attractors.filter(att =>
      this.nodes.every(node => this.dist(att, node) > p.killDist)
    );

    this.nodes.push(...newNodes);
    if (newNodes.length === 0 || this.attractors.length === 0) this.done = true;
    this.uploadTex();
    this.step++;
    this.svgData = null;
  }

  private drawLine(x0: number, y0: number, x1: number, y1: number) {
    const w = this.width, h = this.height;
    const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = Math.round(x0), cy = Math.round(y0);
    while (true) {
      if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
        const idx = (cy*w+cx)*4;
        this.buf[idx] = 255; this.buf[idx+1] = 255; this.buf[idx+2] = 255; this.buf[idx+3] = 255;
      }
      if (cx === Math.round(x1) && cy === Math.round(y1)) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx)  { err += dx; cy += sy; }
    }
  }

  toSVG(): string {
    if (this.svgData) return this.svgData;
    const w = this.width, h = this.height;
    let paths = '';
    for (const b of this.branches) {
      paths += `<line x1="${b.px.toFixed(1)}" y1="${b.py.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="white" stroke-width="1.2" stroke-linecap="round"/>`;
    }
    this.svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#000">${paths}</svg>`;
    return this.svgData;
  }

  getDisplayTexture() { return this.tex; }
  getSrcType() { return 4; }
  getStability() { return this.done ? 1 : Math.min(0.9, this.step / 300); }
  reset(mask: Float32Array) { this.mask = mask; this.build(mask); }
  dispose() { if (this.tex) this.gl.deleteTexture(this.tex); }
}
