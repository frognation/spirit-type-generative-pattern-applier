export type EffectName =
  | 'physarum'
  | 'rd-maze'
  | 'rd-spots'
  | 'gol'
  | 'dla'
  | 'voronoi'
  | 'wave'
  | 'ca'
  | 'fractal';

export type ColorMode = 'bw' | '2tone' | '3tone';

export interface ColorConfig {
  bg: [number, number, number];
  c1: [number, number, number];
  c2: [number, number, number];
}

export interface PhysarumParams {
  agentCount: number;
  sensorAngle: number;  // degrees
  sensorDist: number;
  turnAngle: number;    // degrees
  speed: number;
  decay: number;
}

export interface RDParams {
  f: number;
  k: number;
  dA: number;
  dB: number;
  dt: number;
}

export interface GoLParams {
  density: number;
  variant: 'classic' | 'highlife' | '34life';
}

export interface DLAParams {
  walkers: number;
  stickiness: number;
  branchBias: number;
}

export interface VoronoiParams {
  numSeeds: number;
  showEdges: boolean;
  animate: boolean;
}

export interface WaveParams {
  numSources: number;
  frequency: number;
  speed: number;
}

export interface CAParams {
  rule: 'brian' | 'seeds' | 'morley';
  density: number;
}

export interface FractalParams {
  numAttractors: number;
  segmentLen: number;
  killDist: number;
}

export interface AppState {
  effect: EffectName;
  colorMode: ColorMode;
  colors: ColorConfig;
  playing: boolean;
  speedMult: number;
  canvasW: number;
  canvasH: number;
  text: string;
  font: string;
  weight: string;
  fontSize: number;
  letterSpacing: number;
  isDark: boolean;
  physarum: PhysarumParams;
  rd: RDParams;
  gol: GoLParams;
  dla: DLAParams;
  voronoi: VoronoiParams;
  wave: WaveParams;
  ca: CAParams;
  fractal: FractalParams;
}

export const DEFAULT_STATE: AppState = {
  effect: 'physarum',
  colorMode: 'bw',
  colors: {
    bg: [0, 0, 0],
    c1: [1, 1, 1],
    c2: [0.4, 0.7, 1],
  },
  playing: false,
  speedMult: 1,
  canvasW: 800,
  canvasH: 400,
  text: 'Spirit',
  font: 'Georgia, serif',
  weight: '700',
  fontSize: 200,
  letterSpacing: 0,
  isDark: true,
  physarum: {
    agentCount: 65536,
    sensorAngle: 30,
    sensorDist: 12,
    turnAngle: 25,
    speed: 1.5,
    decay: 0.97,
  },
  rd: { f: 0.029, k: 0.057, dA: 0.2097, dB: 0.105, dt: 1.0 },
  gol: { density: 0.65, variant: 'classic' },
  dla: { walkers: 2000, stickiness: 1.0, branchBias: 0.3 },
  voronoi: { numSeeds: 120, showEdges: true, animate: true },
  wave: { numSources: 8, frequency: 0.06, speed: 1.0 },
  ca: { rule: 'brian', density: 0.15 },
  fractal: { numAttractors: 200, segmentLen: 4, killDist: 8 },
};
