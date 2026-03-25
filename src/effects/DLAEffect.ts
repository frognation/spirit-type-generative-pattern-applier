import { BaseEffect } from './BaseEffect';
import { DLAParams } from '../types';
import { makeRGBA8 } from '../utils/webgl';
import { getMaskBoundary, getMaskPixels } from '../utils/textMask';

export class DLAEffect extends BaseEffect {
  private params: DLAParams;
  private grid!: Uint8Array;    // 0=empty 1=seed/aggregate
  private walkerX!: Float32Array;
  private walkerY!: Float32Array;
  private tex!: WebGLTexture;
  private stableCount = 0;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: DLAParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.build(mask);
  }

  private build(mask: Float32Array) {
    const w = this.width, h = this.height;
    this.grid = new Uint8Array(w * h);

    // Seed the aggregate with letter boundary pixels
    const bnd = getMaskBoundary(mask, w, h);
    const inner = getMaskPixels(mask, 0.5);
    // Mark inner letter pixels as seed (aggregate)
    for (const i of inner) this.grid[i] = 1;

    // Spawn walkers at random positions AROUND the letters (outside mask + some distance)
    const n = this.params.walkers;
    this.walkerX = new Float32Array(n);
    this.walkerY = new Float32Array(n);
    const outside: number[] = [];
    for (let i = 0; i < mask.length; i++) if (mask[i] < 0.1) outside.push(i);
    if (outside.length === 0) for (let i = 0; i < mask.length; i++) outside.push(i);
    for (let i = 0; i < n; i++) {
      const idx = outside[(Math.random() * outside.length) | 0];
      this.walkerX[i] = idx % w;
      this.walkerY[i] = (idx / w) | 0;
    }

    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = makeRGBA8(gl, w, h);
    this.uploadTex();
    this.step = 0; this.stableCount = 0;
    void bnd; // suppress unused warning
  }

  private isAdjacent(x: number, y: number): boolean {
    const w = this.width, h = this.height;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x+dx, ny = y+dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && this.grid[ny*w+nx] === 1) return true;
    }
    return false;
  }

  private uploadTex() {
    const gl = this.gl; const w = this.width, h = this.height;
    const buf = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = this.grid[i] === 1 ? 255 : 0;
      // DLA branches: bright, background: dark
      const isMask = this.mask[i] > 0.5;
      const rv = isMask ? 255 : v; // letter interior = white, DLA = white
      buf[i*4] = rv; buf[i*4+1] = rv; buf[i*4+2] = rv; buf[i*4+3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  tick() {
    const w = this.width, h = this.height;
    const n = this.params.walkers;
    let stuck = 0;
    for (let i = 0; i < n; i++) {
      let x = this.walkerX[i], y = this.walkerY[i];
      // Random walk
      const a = Math.random() * Math.PI * 2;
      // Slight bias toward center of nearest letter pixel (branch bias)
      x += Math.cos(a) + (Math.random() < this.params.branchBias ? (this.width/2 - x) * 0.005 : 0);
      y += Math.sin(a) + (Math.random() < this.params.branchBias ? (this.height/2 - y) * 0.005 : 0);
      // Wrap/clamp
      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(h - 1, y));
      const ix = Math.round(x), iy = Math.round(y);

      if (this.grid[iy*w+ix] === 1) {
        // Already in aggregate, respawn
        const outside = []; for (let j = 0; j < this.mask.length; j++) if (this.mask[j] < 0.1) outside.push(j);
        if (outside.length > 0) {
          const idx = outside[(Math.random() * outside.length) | 0];
          this.walkerX[i] = idx % w; this.walkerY[i] = (idx / w) | 0;
        }
        stuck++;
        continue;
      }

      if (this.isAdjacent(ix, iy) && Math.random() < this.params.stickiness) {
        this.grid[iy*w+ix] = 1;
        // Respawn walker
        const outside = []; for (let j = 0; j < this.mask.length; j++) if (this.mask[j] < 0.1) outside.push(j);
        if (outside.length > 0) {
          const idx = outside[(Math.random() * outside.length) | 0];
          this.walkerX[i] = idx % w; this.walkerY[i] = (idx / w) | 0;
        }
        stuck++;
      } else {
        this.walkerX[i] = x; this.walkerY[i] = y;
      }
    }
    this.stableCount = stuck === 0 ? this.stableCount + 1 : 0;
    this.uploadTex();
    this.step++;
  }

  getDisplayTexture() { return this.tex; }
  getSrcType() { return 4; }

  getStability() {
    if (this.stableCount > 30) return 1;
    return Math.min(0.9, this.step / 500);
  }

  reset(mask: Float32Array) { this.mask = mask; this.build(mask); }
  dispose() { if (this.tex) this.gl.deleteTexture(this.tex); }
}
