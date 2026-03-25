import { BaseEffect } from './BaseEffect';
import { CAParams } from '../types';
import { makeRGBA8 } from '../utils/webgl';
import { getMaskPixels } from '../utils/textMask';

export class CAEffect extends BaseEffect {
  private params: CAParams;
  private state!: Uint8Array; // 0=off 1=dying 2=on (Brian's Brain)
  private next!: Uint8Array;
  private tex!: WebGLTexture;
  private stableCount = 0;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: CAParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.build(mask);
  }

  private build(mask: Float32Array) {
    const n = this.width * this.height;
    this.state = new Uint8Array(n);
    this.next  = new Uint8Array(n);
    const validPx = getMaskPixels(mask, 0.4);
    const d = this.params.density;

    if (this.params.rule === 'brian') {
      // Brian's Brain: 0=off, 1=dying, 2=on
      for (const i of validPx) {
        const r = Math.random();
        if (r < d) this.state[i] = 2;
        else if (r < d * 2) this.state[i] = 1;
      }
    } else if (this.params.rule === 'seeds') {
      for (const i of validPx) if (Math.random() < d) this.state[i] = 1;
    } else { // morley
      for (const i of validPx) if (Math.random() < d) this.state[i] = 1;
    }

    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = makeRGBA8(gl, this.width, this.height);
    this.uploadTex();
    this.step = 0; this.stableCount = 0;
  }

  private countNeighbors(x: number, y: number, val: number): number {
    const w = this.width, h = this.height; let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = (x+dx+w)%w, ny = (y+dy+h)%h;
      if (this.state[ny*w+nx] === val) n++;
    }
    return n;
  }

  private uploadTex() {
    const gl = this.gl; const w = this.width, h = this.height;
    const buf = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const s = this.state[i];
      let v = 0;
      if (s === 2) v = 255;        // ON = white
      else if (s === 1) v = 128;   // DYING = gray
      buf[i*4] = v; buf[i*4+1] = v; buf[i*4+2] = v; buf[i*4+3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  tick() {
    const w = this.width, h = this.height;
    let diff = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y*w+x;
        const s = this.state[i];
        let ns = 0;

        if (this.params.rule === 'brian') {
          if (s === 2) { ns = 1; }     // ON → dying
          else if (s === 1) { ns = 0; } // dying → off
          else {
            // off → on if exactly 2 ON neighbors
            ns = this.countNeighbors(x, y, 2) === 2 ? 2 : 0;
          }
        } else if (this.params.rule === 'seeds') {
          // Seeds: dead becomes alive if 2 live neighbors; live always dies
          if (s === 1) { ns = 0; }
          else { ns = this.countNeighbors(x, y, 1) === 2 ? 1 : 0; }
        } else { // morley
          // Morley (Move): B368/S245
          const on = this.countNeighbors(x, y, 1);
          if (s === 1) ns = (on===2||on===4||on===5) ? 1 : 0;
          else         ns = (on===3||on===6||on===8) ? 1 : 0;
        }

        // Constrain to mask
        if (this.mask[i] < 0.4) ns = 0;
        this.next[i] = ns;
        if (ns !== s) diff++;
      }
    }
    [this.state, this.next] = [this.next, this.state];
    this.stableCount = diff === 0 ? this.stableCount + 1 : 0;
    this.uploadTex();
    this.step++;
  }

  getDisplayTexture() { return this.tex; }
  getSrcType() { return 4; }
  getStability() {
    if (this.stableCount > 10) return 1;
    return Math.min(0.9, this.step / 600);
  }
  reset(mask: Float32Array) { this.mask = mask; this.build(mask); }
  dispose() { if (this.tex) this.gl.deleteTexture(this.tex); }
}
