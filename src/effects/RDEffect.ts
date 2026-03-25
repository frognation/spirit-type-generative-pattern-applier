import { BaseEffect } from './BaseEffect';
import { RDParams } from '../types';
import { makeRGBA32F, makeR32F, makeFBO, bindTex, drawQuad, linkProgram, u1f, u2f } from '../utils/webgl';

const VS = `#version 300 es
in vec2 a_pos; out vec2 v_uv;
void main(){ v_uv=a_pos*.5+.5; gl_Position=vec4(a_pos,0,1); }`;

const FS_RD = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_state, u_mask;
uniform vec2 u_res;
uniform float u_f, u_k, u_dA, u_dB, u_dt;
void main(){
  float m=texture(u_mask,v_uv).r;
  if(m<.08){ o=vec4(1,0,0,1); return; }
  vec4 cur=texture(u_state,v_uv);
  float A=cur.r, B=cur.g;
  vec2 px=1./u_res;
  vec4 L=texture(u_state,v_uv+vec2(-px.x,0)), R=texture(u_state,v_uv+vec2(px.x,0));
  vec4 U=texture(u_state,v_uv+vec2(0,-px.y)), D=texture(u_state,v_uv+vec2(0,px.y));
  float lapA=L.r+R.r+U.r+D.r-4.*A;
  float lapB=L.g+R.g+U.g+D.g-4.*B;
  float ABB=A*B*B;
  float nA=clamp(A+(u_dA*lapA-ABB+u_f*(1.-A))*u_dt,0.,1.);
  float nB=clamp(B+(u_dB*lapB+ABB-(u_k+u_f)*B)*u_dt,0.,1.);
  o=vec4(nA,nB,cur.b,1);
}`;

export class RDEffect extends BaseEffect {
  private params: RDParams;
  private prog!: WebGLProgram;
  private maskTex!: WebGLTexture;
  private tex0!: WebGLTexture; private tex1!: WebGLTexture;
  private fbo0!: WebGLFramebuffer; private fbo1!: WebGLFramebuffer;
  private read!: WebGLTexture; private write!: WebGLTexture;
  private fboR!: WebGLFramebuffer; private fboW!: WebGLFramebuffer;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: RDParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.prog = linkProgram(gl, VS, FS_RD);
    this.build(mask);
  }

  private build(mask: Float32Array) {
    const gl = this.gl;
    this.maskTex = makeR32F(gl, this.width, this.height, mask);

    const data = new Float32Array(this.width * this.height * 4);
    for (let i = 0; i < this.width * this.height; i++) {
      const inMask = mask[i] > 0.5;
      data[i*4]   = 1;
      data[i*4+1] = inMask && Math.random() < 0.45 ? 0.5 + Math.random() * 0.15 : 0;
      data[i*4+2] = inMask ? 1 : 0; // mask flag
      data[i*4+3] = 1;
    }
    gl.deleteTexture(this.tex0); gl.deleteTexture(this.tex1);
    gl.deleteFramebuffer(this.fbo0); gl.deleteFramebuffer(this.fbo1);
    this.tex0 = makeRGBA32F(gl, this.width, this.height, data);
    this.tex1 = makeRGBA32F(gl, this.width, this.height);
    this.fbo0 = makeFBO(gl, this.tex0); this.fbo1 = makeFBO(gl, this.tex1);
    this.read = this.tex0; this.write = this.tex1;
    this.fboR = this.fbo0; this.fboW = this.fbo1;
    this.step = 0;
  }

  tick() {
    const gl = this.gl; const p = this.params;
    gl.useProgram(this.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboW);
    gl.viewport(0, 0, this.width, this.height);
    bindTex(gl, this.prog, 'u_state', 0, this.read);
    bindTex(gl, this.prog, 'u_mask',  1, this.maskTex);
    u2f(gl, this.prog, 'u_res', this.width, this.height);
    u1f(gl, this.prog, 'u_f',  p.f); u1f(gl, this.prog, 'u_k',  p.k);
    u1f(gl, this.prog, 'u_dA', p.dA); u1f(gl, this.prog, 'u_dB', p.dB);
    u1f(gl, this.prog, 'u_dt', p.dt);
    drawQuad(gl, this.prog);
    [this.read, this.write] = [this.write, this.read];
    [this.fboR, this.fboW]  = [this.fboW,  this.fboR];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.step++;
  }

  getDisplayTexture() { return this.read; }
  getSrcType() { return 1; } // RD

  getStability() { return Math.min(1, this.step / 5000); }

  reset(mask: Float32Array) {
    this.mask = mask;
    gl_deleteTexture(this.gl, this.maskTex);
    this.build(mask);
  }

  dispose() {
    const gl = this.gl;
    [this.tex0, this.tex1, this.maskTex].forEach(t => t && gl.deleteTexture(t));
    [this.fbo0, this.fbo1].forEach(f => f && gl.deleteFramebuffer(f));
    gl.deleteProgram(this.prog);
  }
}

function gl_deleteTexture(gl: WebGL2RenderingContext, t: WebGLTexture) { if (t) gl.deleteTexture(t); }
