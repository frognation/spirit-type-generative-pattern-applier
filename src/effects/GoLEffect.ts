import { BaseEffect } from './BaseEffect';
import { GoLParams } from '../types';
import { makeRGBA8 } from '../utils/webgl';
import { getMaskPixels } from '../utils/textMask';

export class GoLEffect extends BaseEffect {
  private params: GoLParams;
  private cur!: Uint8Array;
  private nxt!: Uint8Array;
  private tex!: WebGLTexture;
  private prevDiff = Infinity;
  private stableCount = 0;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: GoLParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.build(mask);
  }

  private build(mask: Float32Array) {
    const n = this.width * this.height;
    this.cur = new Uint8Array(n);
    this.nxt = new Uint8Array(n);
    const validPx = getMaskPixels(mask, 0.4);
    for (const i of validPx) if (Math.random() < this.params.density) this.cur[i] = 1;
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = makeRGBA8(gl, this.width, this.height);
    this.uploadTex();
    this.step = 0; this.prevDiff = Infinity; this.stableCount = 0;
  }

  private rule(alive: number, n: number): number {
    const v = this.params.variant;
    if (v === 'classic')  return alive ? (n===2||n===3?1:0) : (n===3?1:0);
    if (v === 'highlife') return alive ? (n===2||n===3?1:0) : (n===3||n===6?1:0);
    /* 34life */           return (n===3||n===4) ? 1 : 0;
  }

  private uploadTex() {
    const gl = this.gl;
    const buf = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < this.width * this.height; i++) {
      const v = this.cur[i] * 255;
      buf[i*4] = v; buf[i*4+1] = v; buf[i*4+2] = v; buf[i*4+3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  tick() {
    const w = this.width, h = this.height;
    let diff = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          n += this.cur[((y+dy+h)%h)*w + (x+dx+w)%w];
        }
        const alive = this.cur[y*w+x];
        const next = this.rule(alive, n);
        this.nxt[y*w+x] = next;
        if (next !== alive) diff++;
      }
    }
    [this.cur, this.nxt] = [this.nxt, this.cur];
    if (diff === this.prevDiff) this.stableCount++;
    else this.stableCount = 0;
    this.prevDiff = diff;
    this.uploadTex();
    this.step++;
  }

  getDisplayTexture() { return this.tex; }
  getSrcType() { return 4; } // CPU RGBA8

  getStability() {
    if (this.prevDiff === 0) return 1;
    if (this.stableCount > 20) return 0.95;
    return Math.min(0.9, this.step / 800);
  }

  reset(mask: Float32Array) { this.mask = mask; this.build(mask); }

  dispose() { if (this.tex) this.gl.deleteTexture(this.tex); }
}
