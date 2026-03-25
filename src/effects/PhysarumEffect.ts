import { BaseEffect } from './BaseEffect';
import { PhysarumParams } from '../types';
import { makeRGBA32F, makeR32F, makeFBO, bindTex, drawQuad, linkProgram, u1f, u2f } from '../utils/webgl';
import { getMaskPixels } from '../utils/textMask';

const VS_QUAD = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv=a_pos*.5+.5; gl_Position=vec4(a_pos,0,1); }`;

const FS_AGENT = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_agents, u_trail, u_mask;
uniform vec2 u_res;
uniform float u_sa, u_sd, u_ta, u_sp, u_time, u_rnd;
const float PI=3.14159265, TAU=6.28318530;

float hash(vec2 p){ p=fract(p*vec2(234.34,435.34)); p+=dot(p,p+34.23); return fract(p.x*p.y); }

float sense(vec2 px, float a){
  vec2 sp=px+vec2(cos(a),sin(a))*u_sd;
  vec2 uv=sp/u_res; uv=clamp(uv,.001,.999);
  return texture(u_trail,uv).r * (texture(u_mask,uv).r>.4?1.:0.);
}
bool ok(vec2 px){
  vec2 uv=px/u_res;
  return uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.&&texture(u_mask,clamp(uv,.001,.999)).r>.4;
}
void main(){
  vec4 ag=texture(u_agents,v_uv);
  if(ag.a<.5){o=ag;return;}
  float x=ag.r*u_res.x, y=ag.g*u_res.y, a=ag.b*TAU;
  float f=sense(vec2(x,y),a), l=sense(vec2(x,y),a+u_sa), r=sense(vec2(x,y),a-u_sa);
  float rnd=hash(v_uv+vec2(u_rnd*1.73,u_time*.0013));
  if(f>=l&&f>=r) a+=(rnd-.5)*.04;
  else if(l>r) a+=u_ta;
  else if(r>l) a-=u_ta;
  else a+=(rnd-.5)*u_ta*2.;
  float nx=x+cos(a)*u_sp, ny=y+sin(a)*u_sp;
  if(!ok(vec2(nx,ny))){
    a=a+PI+(rnd-.5)*1.2; nx=x+cos(a)*u_sp*.5; ny=y+sin(a)*u_sp*.5;
    if(!ok(vec2(nx,ny))){ nx=x; ny=y; a=a+PI+rnd*TAU*.25; }
  }
  nx=clamp(nx,0.,u_res.x-.001); ny=clamp(ny,0.,u_res.y-.001);
  o=vec4(nx/u_res.x,ny/u_res.y,mod(a,TAU)/TAU,1.);
}`;

const VS_DEP = `#version 300 es
precision highp float;
uniform sampler2D u_agents; uniform vec2 u_ats;
void main(){
  int tx=gl_VertexID%int(u_ats.x), ty=gl_VertexID/int(u_ats.x);
  vec4 ag=texture(u_agents,(vec2(tx,ty)+.5)/u_ats);
  vec2 p=ag.rg*2.-1.; p.y=-p.y;
  gl_Position=vec4(p*ag.a+(1.-ag.a)*9.,0,1); gl_PointSize=1.5;
}`;
const FS_DEP = `#version 300 es
precision highp float; out vec4 o;
void main(){ o=vec4(.04,0,0,1); }`;

const FS_DIFF = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_trail; uniform vec2 u_res; uniform float u_decay;
void main(){
  vec2 px=1./u_res; float s=0.;
  for(int dy=-1;dy<=1;dy++) for(int dx=-1;dx<=1;dx++)
    s+=texture(u_trail,v_uv+vec2(dx,dy)*px).r;
  s/=9.; float cur=texture(u_trail,v_uv).r;
  o=vec4(mix(cur,s,.35)*u_decay,0,0,1);
}`;

export class PhysarumEffect extends BaseEffect {
  private params: PhysarumParams;
  private progAgent!: WebGLProgram;
  private progDep!: WebGLProgram;
  private progDiff!: WebGLProgram;
  private maskTex!: WebGLTexture;
  private agTex0!: WebGLTexture; private agTex1!: WebGLTexture;
  private trTex0!: WebGLTexture; private trTex1!: WebGLTexture;
  private agFBO0!: WebGLFramebuffer; private agFBO1!: WebGLFramebuffer;
  private trFBO0!: WebGLFramebuffer; private trFBO1!: WebGLFramebuffer;
  private agRead!: WebGLTexture; private agWrite!: WebGLTexture;
  private agFR!: WebGLFramebuffer; private agFW!: WebGLFramebuffer;
  private trRead!: WebGLTexture; private trWrite!: WebGLTexture;
  private trFR!: WebGLFramebuffer; private trFW!: WebGLFramebuffer;
  private atW = 256; private atH = 256;
  private physTime = 0;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number, params: PhysarumParams) {
    super(gl, mask, w, h);
    this.params = params;
    this.progAgent = linkProgram(gl, VS_QUAD, FS_AGENT);
    this.progDep   = linkProgram(gl, VS_DEP, FS_DEP);
    this.progDiff  = linkProgram(gl, VS_QUAD, FS_DIFF);
    this.build(mask);
    for (let i = 0; i < 150; i++) this.runStep(); // pre-warm
  }

  private build(mask: Float32Array) {
    const gl = this.gl;
    const n = Math.min(this.params.agentCount, 262144);
    const side = Math.ceil(Math.sqrt(n));
    this.atW = side; this.atH = side;
    const total = side * side;

    this.maskTex = makeR32F(gl, this.width, this.height, mask);

    const validPx = getMaskPixels(mask, 0.5);
    if (validPx.length === 0) for (let i = 0; i < mask.length; i++) validPx.push(i);

    const agData = new Float32Array(total * 4);
    for (let i = 0; i < total; i++) {
      if (i < n) {
        const idx = validPx[(Math.random() * validPx.length) | 0];
        agData[i*4]   = ((idx % this.width) + 0.5) / this.width;
        agData[i*4+1] = (((idx / this.width) | 0) + 0.5) / this.height;
        agData[i*4+2] = Math.random();
        agData[i*4+3] = 1;
      }
    }
    this.agTex0 = makeRGBA32F(gl, side, side, agData); this.agTex1 = makeRGBA32F(gl, side, side);
    this.trTex0 = makeR32F(gl, this.width, this.height); this.trTex1 = makeR32F(gl, this.width, this.height);
    this.agFBO0 = makeFBO(gl, this.agTex0); this.agFBO1 = makeFBO(gl, this.agTex1);
    this.trFBO0 = makeFBO(gl, this.trTex0); this.trFBO1 = makeFBO(gl, this.trTex1);
    this.agRead=this.agTex0; this.agWrite=this.agTex1; this.agFR=this.agFBO0; this.agFW=this.agFBO1;
    this.trRead=this.trTex0; this.trWrite=this.trTex1; this.trFR=this.trFBO0; this.trFW=this.trFBO1;
    this.step = 0; this.physTime = 0;
  }

  private runStep() {
    const gl = this.gl; this.physTime++;
    const p = this.params;
    const sa = p.sensorAngle * Math.PI / 180;
    const ta = p.turnAngle * Math.PI / 180;

    // Agent update
    gl.useProgram(this.progAgent);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.agFW);
    gl.viewport(0, 0, this.atW, this.atH);
    bindTex(gl, this.progAgent, 'u_agents', 0, this.agRead);
    bindTex(gl, this.progAgent, 'u_trail',  1, this.trRead);
    bindTex(gl, this.progAgent, 'u_mask',   2, this.maskTex);
    u2f(gl, this.progAgent, 'u_res', this.width, this.height);
    u1f(gl, this.progAgent, 'u_sa', sa); u1f(gl, this.progAgent, 'u_sd', p.sensorDist);
    u1f(gl, this.progAgent, 'u_ta', ta); u1f(gl, this.progAgent, 'u_sp', p.speed);
    u1f(gl, this.progAgent, 'u_time', this.physTime); u1f(gl, this.progAgent, 'u_rnd', Math.random());
    drawQuad(gl, this.progAgent);
    [this.agRead, this.agWrite] = [this.agWrite, this.agRead];
    [this.agFR,   this.agFW  ] = [this.agFW,    this.agFR  ];

    // Deposit
    gl.useProgram(this.progDep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trFR);
    gl.viewport(0, 0, this.width, this.height);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    bindTex(gl, this.progDep, 'u_agents', 0, this.agRead);
    const loc = gl.getUniformLocation(this.progDep, 'u_ats');
    if (loc) gl.uniform2f(loc, this.atW, this.atH);
    gl.drawArrays(gl.POINTS, 0, this.atW * this.atH);
    gl.disable(gl.BLEND);

    // Diffuse/decay
    gl.useProgram(this.progDiff);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trFW);
    gl.viewport(0, 0, this.width, this.height);
    bindTex(gl, this.progDiff, 'u_trail', 0, this.trRead);
    u2f(gl, this.progDiff, 'u_res', this.width, this.height);
    u1f(gl, this.progDiff, 'u_decay', p.decay);
    drawQuad(gl, this.progDiff);
    [this.trRead, this.trWrite] = [this.trWrite, this.trRead];
    [this.trFR,   this.trFW  ] = [this.trFW,    this.trFR  ];

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  tick() { this.runStep(); this.step++; }
  getDisplayTexture() { return this.trRead; }
  getSrcType() { return 0; } // trail

  getStability() { return Math.min(1, this.step / 4000); }

  reset(mask: Float32Array) {
    this.mask = mask;
    this.disposeBuffers();
    this.build(mask);
    for (let i = 0; i < 150; i++) this.runStep();
  }

  private disposeBuffers() {
    const gl = this.gl;
    [this.agTex0, this.agTex1, this.trTex0, this.trTex1, this.maskTex].forEach(t => t && gl.deleteTexture(t));
    [this.agFBO0, this.agFBO1, this.trFBO0, this.trFBO1].forEach(f => f && gl.deleteFramebuffer(f));
  }

  dispose() {
    this.disposeBuffers();
    [this.progAgent, this.progDep, this.progDiff].forEach(p => this.gl.deleteProgram(p));
  }
}
