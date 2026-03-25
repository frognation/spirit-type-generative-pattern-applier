import { AppState, EffectName, ColorMode } from './types';
import { makeTextMask } from './utils/textMask';
import { linkProgram, drawQuad, bindTex, u1f, u1i, u3fv, makeRGBA32F, makeR32F, makeRGBA8, makeFBO } from './utils/webgl';
import { BaseEffect } from './effects/BaseEffect';
import { PhysarumEffect } from './effects/PhysarumEffect';
import { RDEffect } from './effects/RDEffect';
import { GoLEffect } from './effects/GoLEffect';
import { DLAEffect } from './effects/DLAEffect';
import { VoronoiEffect } from './effects/VoronoiEffect';
import { WaveEffect } from './effects/WaveEffect';
import { CAEffect } from './effects/CAEffect';
import { FractalEffect } from './effects/FractalEffect';

// ── Display shader ────────────────────────────────────────────────────────────
const VS_DISP = `#version 300 es
in vec2 a_pos; out vec2 v_uv;
void main(){ v_uv=a_pos*.5+.5; gl_Position=vec4(a_pos,0,1); }`;

const FS_DISP = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_tex;
uniform sampler2D u_mask;   // letter mask (R32F)
uniform int u_srcType;      // 0=physarum trail, 1=RD, 2=GoL, 3=wave, 4=cpu-rgba8
uniform int u_outerMode;    // 1 = "Hate" style (physarum outside letters)
uniform int u_colorMode;    // 0=bw, 1=2tone, 2=3tone
uniform vec3 u_bg, u_c1, u_c2;

vec3 colorAt(float t){
  if(u_colorMode==0||u_colorMode==1) return mix(u_bg, u_c1, t);
  return t<.5 ? mix(u_bg, u_c1, t*2.) : mix(u_c1, u_c2, (t-.5)*2.);
}

void main(){
  vec4 s   = texture(u_tex,  v_uv);
  float mk = texture(u_mask, v_uv).r;
  float t  = 0.;

  if(u_srcType==0){
    // Physarum trail
    t = smoothstep(.08, .55, s.r);
    if(u_outerMode==1){
      // "Hate" style: trail in outer space + overlay solid letter
      float letterBright = smoothstep(.3,.7,mk);
      t = max(t, letterBright);
    }
  } else if(u_srcType==1){
    // RD: A in r, B in g, maskflag in b
    float mf = s.b;
    t = mf * (1.0 - clamp(s.g * 3.5, 0., 1.));
  } else if(u_srcType==2){
    // GoL binary
    t = s.r > .5 ? 1. : 0.;
  } else if(u_srcType==3){
    // Wave interference — s.r is [0,1] mapped from [-1,1]
    float wave = s.r * 2. - 1.;          // back to [-1,1]
    float mf = mk;                         // constrain to letter
    t = mf * (wave * .5 + .5);
  } else {
    // CPU RGBA8 — already grayscale in r channel
    t = s.r;
  }

  o = vec4(colorAt(clamp(t,0.,1.)), 1.);
}`;

export class Simulation {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private dispProg!: WebGLProgram;
  private maskTex!: WebGLTexture;
  private mask!: Float32Array;
  private effect: BaseEffect | null = null;
  private rafId: number | null = null;
  private _playing = false;
  private _stepsPerFrame = 1;
  private _step = 0;
  private _state!: AppState;

  onStepUpdate?: (step: number, stability: number) => void;

  constructor(canvas: HTMLCanvasElement, initialState: AppState) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this._state = initialState;
    this.dispProg = linkProgram(gl, VS_DISP, FS_DISP);
    this.applyCanvasSize(initialState.canvasW, initialState.canvasH);
    this.setEffect(initialState);
    this.startLoop();
  }

  private applyCanvasSize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    // Fit visually in the viewport (right side = sidebar width 272px)
    const vw = (window.innerWidth - 272 - 20) * window.devicePixelRatio;
    const vh = (window.innerHeight - 20) * window.devicePixelRatio;
    const scale = Math.min(vw / w, vh / h, 1);
    this.canvas.style.width  = Math.round(w * scale / window.devicePixelRatio) + 'px';
    this.canvas.style.height = Math.round(h * scale / window.devicePixelRatio) + 'px';
  }

  setEffect(state: AppState) {
    this._state = state;
    const { text, font, weight, fontSize, letterSpacing, canvasW, canvasH } = state;
    this.applyCanvasSize(canvasW, canvasH);

    // Generate mask
    this.mask = makeTextMask(text, font, weight, fontSize, letterSpacing, canvasW, canvasH);
    if (this.maskTex) this.gl.deleteTexture(this.maskTex);
    this.maskTex = makeR32F(this.gl, canvasW, canvasH, this.mask);

    // For "Hate" outer mode, invert mask for agents
    const agentMask = this.getAgentMask(state);

    this.effect?.dispose();
    this.effect = this.createEffect(state, agentMask, canvasW, canvasH);
    this._step = 0;

    // Steps-per-frame tuning
    this._stepsPerFrame = state.effect === 'physarum' ? 1
      : state.effect === 'gol' || state.effect === 'ca' ? 2
      : state.effect === 'dla' || state.effect === 'fractal' ? 3
      : state.effect === 'wave' ? 1
      : 6; // RD
  }

  private getAgentMask(state: AppState): Float32Array {
    // "physarum-outer" or Hate mode: invert mask so agents live OUTSIDE letters
    if (state.effect === 'physarum' && (state as any).physarumOuter) {
      const inv = new Float32Array(this.mask.length);
      for (let i = 0; i < this.mask.length; i++) inv[i] = this.mask[i] > 0.5 ? 0 : 1;
      // expand slightly so agents have room near boundary
      return inv;
    }
    return this.mask;
  }

  private createEffect(state: AppState, agentMask: Float32Array, w: number, h: number): BaseEffect {
    const gl = this.gl;
    switch (state.effect as EffectName) {
      case 'physarum':    return new PhysarumEffect(gl, agentMask, w, h, state.physarum);
      case 'rd-maze':     return new RDEffect(gl, this.mask, w, h, { ...state.rd, f: 0.029, k: 0.057 });
      case 'rd-spots':    return new RDEffect(gl, this.mask, w, h, { ...state.rd, f: 0.034, k: 0.0618 });
      case 'gol':         return new GoLEffect(gl, this.mask, w, h, state.gol);
      case 'dla':         return new DLAEffect(gl, this.mask, w, h, state.dla);
      case 'voronoi':     return new VoronoiEffect(gl, this.mask, w, h, state.voronoi);
      case 'wave':        return new WaveEffect(gl, this.mask, w, h, state.wave);
      case 'ca':          return new CAEffect(gl, this.mask, w, h, state.ca);
      case 'fractal':     return new FractalEffect(gl, this.mask, w, h, state.fractal);
      default:            return new PhysarumEffect(gl, agentMask, w, h, state.physarum);
    }
  }

  private render(state: AppState) {
    if (!this.effect) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const { colorMode, colors, isDark } = state;
    const isOuter = (state as any).physarumOuter && state.effect === 'physarum';

    let bg = colors.bg, c1 = colors.c1, c2 = colors.c2;
    if (colorMode === 'bw') {
      bg = isDark ? [0,0,0] : [1,1,1];
      c1 = isDark ? [1,1,1] : [0,0,0];
      c2 = c1;
    }

    gl.useProgram(this.dispProg);
    bindTex(gl, this.dispProg, 'u_tex',  0, this.effect.getDisplayTexture());
    bindTex(gl, this.dispProg, 'u_mask', 1, this.maskTex);
    u1i(gl, this.dispProg, 'u_srcType',   this.effect.getSrcType());
    u1i(gl, this.dispProg, 'u_outerMode', isOuter ? 1 : 0);
    u1i(gl, this.dispProg, 'u_colorMode',
      colorMode === 'bw' ? 0 : colorMode === '2tone' ? 1 : 2);
    u3fv(gl, this.dispProg, 'u_bg', bg as number[]);
    u3fv(gl, this.dispProg, 'u_c1', c1 as number[]);
    u3fv(gl, this.dispProg, 'u_c2', c2 as number[]);
    drawQuad(gl, this.dispProg);
  }

  private startLoop() {
    const loop = () => {
      const st = this._state;
      if (this._playing && this.effect) {
        const base = this._stepsPerFrame;
        const mult = Math.max(1, st.speedMult);
        for (let i = 0; i < base * mult; i++) {
          this.effect.tick();
          this._step++;
        }
        this.onStepUpdate?.(this._step, this.effect.getStability());
      }
      this.render(this._state);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  play()  { this._playing = true; }
  pause() { this._playing = false; }
  get isPlaying() { return this._playing; }

  step(state: AppState) {
    if (!this.effect) return;
    this.effect.tick();
    this._step++;
    this.render(state);
    this.onStepUpdate?.(this._step, this.effect.getStability());
  }

  reset(state: AppState) {
    this._state = state;
    this._step = 0;
    this.setEffect(state);
    this.onStepUpdate?.(0, 0);
  }

  updateState(state: AppState) {
    this._state = state;
  }

  // Resize only (no effect rebuild)
  resize(state: AppState) {
    this.applyCanvasSize(state.canvasW, state.canvasH);
    this.reset(state);
  }

  exportPNG(): string {
    this.render(this._state);
    return this.canvas.toDataURL('image/png');
  }

  exportSVG(): string {
    if (this.effect?.toSVG) {
      const svg = this.effect.toSVG();
      if (svg) return svg;
    }
    // Fallback: embed PNG in SVG
    const data = this.exportPNG();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}"><image href="${data}" width="${this.canvas.width}" height="${this.canvas.height}"/></svg>`;
  }

  startRecording(): MediaRecorder {
    const stream = this.canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'spirit-type.webm';
      a.click();
    };
    rec.start(200);
    return rec;
  }

  dispose() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.effect?.dispose();
    this.gl.deleteProgram(this.dispProg);
    if (this.maskTex) this.gl.deleteTexture(this.maskTex);
  }
}

// Re-export makeR32F etc. that Simulation uses internally
export { makeR32F, makeRGBA32F, makeRGBA8, makeFBO };
