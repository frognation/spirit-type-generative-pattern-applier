import { BaseEffect } from './BaseEffect';
import { VoronoiParams } from '../types';
import { makeRGBA8 } from '../utils/webgl';
import { getMaskPixels } from '../utils/textMask';

interface Seed { x: number; y: number; vx: number; vy: number; }

export class VoronoiEffect extends BaseEffect {
  private params: VoronoiParams;
  private seeds: Seed[] = [];
  private tex!: WebGLTexture;
  private svgData: string | null = null;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: VoronoiParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.build(mask);
  }

  private build(mask: Float32Array) {
    const validPx = getMaskPixels(mask, 0.5);
    const n = this.params.numSeeds;
    this.seeds = [];
    for (let i = 0; i < n; i++) {
      const idx = validPx[(Math.random() * validPx.length) | 0];
      const x = (idx % this.width) + 0.5;
      const y = ((idx / this.width) | 0) + 0.5;
      const speed = 0.3;
      const a = Math.random() * Math.PI * 2;
      this.seeds.push({ x, y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed });
    }
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = makeRGBA8(gl, this.width, this.height);
    this.render();
    this.step = 0;
  }

  private render() {
    const w = this.width, h = this.height;
    const buf = new Uint8Array(w * h * 4);
    const seeds = this.seeds;
    const n = seeds.length;

    // For each pixel, find closest seed and 2nd closest (for edge detection)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let d1 = Infinity, d2 = Infinity;
        for (let i = 0; i < n; i++) {
          const dx = x - seeds[i].x, dy = y - seeds[i].y;
          const d = dx*dx + dy*dy;
          if (d < d1) { d2 = d1; d1 = d; }
          else if (d < d2) { d2 = d; }
        }

        const idx = (y * w + x) * 4;
        const inMask = this.mask[y * w + x] > 0.5;

        if (!inMask) {
          buf[idx] = buf[idx+1] = buf[idx+2] = 0; buf[idx+3] = 255;
          continue;
        }

        if (this.params.showEdges) {
          // Voronoi edge = where d1 ≈ d2
          const edge = Math.sqrt(d2) - Math.sqrt(d1);
          const v = edge < 2.5 ? 255 : 0;
          buf[idx] = v; buf[idx+1] = v; buf[idx+2] = v; buf[idx+3] = 255;
        } else {
          // Shade by distance to nearest seed
          const v = Math.min(255, Math.sqrt(d1) * 4) | 0;
          buf[idx] = v; buf[idx+1] = v; buf[idx+2] = v; buf[idx+3] = 255;
        }
      }
    }

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.svgData = null; // invalidate SVG cache
  }

  tick() {
    if (this.params.animate) {
      const w = this.width, h = this.height;
      for (const s of this.seeds) {
        s.x += s.vx; s.y += s.vy;
        // Bounce at mask boundary
        const ix = Math.round(s.x), iy = Math.round(s.y);
        const inMask = ix >= 0 && ix < w && iy >= 0 && iy < h && this.mask[iy*w+ix] > 0.5;
        if (!inMask || ix <= 0 || ix >= w-1 || iy <= 0 || iy >= h-1) {
          s.vx *= -1 + (Math.random()-0.5)*0.3;
          s.vy *= -1 + (Math.random()-0.5)*0.3;
          s.x = Math.max(1, Math.min(w-2, s.x));
          s.y = Math.max(1, Math.min(h-2, s.y));
        }
      }
    }
    this.render();
    this.step++;
  }

  getDisplayTexture() { return this.tex; }
  getSrcType() { return 4; }
  getStability() { return this.params.animate ? 0 : 1; }

  toSVG(): string {
    if (this.svgData) return this.svgData;
    const w = this.width, h = this.height;
    // Generate SVG with dot seeds and Voronoi edge approximation
    let paths = '';
    for (const s of this.seeds) {
      paths += `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="2" fill="white" opacity="0.7"/>`;
    }
    this.svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="background:#000">${paths}</svg>`;
    return this.svgData;
  }

  reset(mask: Float32Array) { this.mask = mask; this.build(mask); }
  dispose() { if (this.tex) this.gl.deleteTexture(this.tex); }
}
