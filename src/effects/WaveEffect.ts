import { BaseEffect } from './BaseEffect';
import { WaveParams } from '../types';
import { makeFBO, makeRGBA32F, bindTex, drawQuad, linkProgram, u1f, u2f } from '../utils/webgl';
import { getMaskPixels } from '../utils/textMask';

const VS = `#version 300 es
in vec2 a_pos; out vec2 v_uv;
void main(){ v_uv=a_pos*.5+.5; gl_Position=vec4(a_pos,0,1); }`;

const FS_WAVE = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform vec2 u_res;
uniform float u_time, u_freq, u_sources[64]; // [x0,y0, x1,y1, ...]
uniform int u_nSrc;

void main(){
  vec2 pos = v_uv * u_res;
  float val = 0.;
  for(int i=0;i<u_nSrc;i++){
    vec2 src = vec2(u_sources[i*2], u_sources[i*2+1]);
    float d = distance(pos, src);
    val += sin(d * u_freq - u_time) / float(u_nSrc);
  }
  // val in [-1,1], store as [0,1] in r channel
  o = vec4(val * .5 + .5, 0, 1, 1);
}`;

export class WaveEffect extends BaseEffect {
  private params: WaveParams;
  private prog!: WebGLProgram;
  private tex!: WebGLTexture;
  private fbo!: WebGLFramebuffer;
  private sources: number[] = [];
  private time = 0;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: WaveParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.prog = linkProgram(gl, VS, FS_WAVE);
    this.buildSources(mask);
    this.tex = makeRGBA32F(gl, w, h);
    this.fbo = makeFBO(gl, this.tex);
  }

  private buildSources(mask: Float32Array) {
    const validPx = getMaskPixels(mask, 0.5);
    const n = Math.min(this.params.numSources, 32);
    this.sources = [];
    for (let i = 0; i < n; i++) {
      const idx = validPx[(Math.random() * validPx.length) | 0];
      this.sources.push((idx % this.width) + 0.5, ((idx / this.width) | 0) + 0.5);
    }
  }

  tick() {
    const gl = this.gl; const p = this.params;
    this.time += p.speed * 0.05;

    gl.useProgram(this.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    u2f(gl, this.prog, 'u_res', this.width, this.height);
    u1f(gl, this.prog, 'u_time', this.time);
    u1f(gl, this.prog, 'u_freq', p.frequency);

    const srcLoc = gl.getUniformLocation(this.prog, 'u_sources');
    if (srcLoc) {
      const arr = new Float32Array(64);
      for (let i = 0; i < Math.min(this.sources.length, 64); i++) arr[i] = this.sources[i];
      gl.uniform1fv(srcLoc, arr);
    }
    const nLoc = gl.getUniformLocation(this.prog, 'u_nSrc');
    if (nLoc) gl.uniform1i(nLoc, Math.min(this.sources.length / 2, 32));

    drawQuad(gl, this.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.step++;
  }

  getDisplayTexture() { return this.tex; }
  getSrcType() { return 3; } // wave (treat as 0→1 trail-like)

  getStability() { return 0; } // always animating

  reset(mask: Float32Array) {
    this.mask = mask;
    this.time = 0;
    this.buildSources(mask);
    this.step = 0;
  }

  dispose() {
    this.gl.deleteTexture(this.tex);
    this.gl.deleteFramebuffer(this.fbo);
    this.gl.deleteProgram(this.prog);
  }
}
