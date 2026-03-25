import { ColorMode, ColorConfig } from '../types';

export interface EffectRenderOptions {
  colorMode: ColorMode;
  colors: ColorConfig;
  isDark: boolean;
}

export abstract class BaseEffect {
  protected gl: WebGL2RenderingContext;
  protected width: number;
  protected height: number;
  protected mask: Float32Array;
  protected step = 0;

  constructor(gl: WebGL2RenderingContext, mask: Float32Array, w: number, h: number) {
    this.gl = gl;
    this.mask = mask;
    this.width = w;
    this.height = h;
  }

  abstract tick(): void;
  /** Returns the WebGL texture to display */
  abstract getDisplayTexture(): WebGLTexture;
  /** 0 = physarum/trail, 1 = RD, 2 = life/binary, 3 = wave (signed), 4 = CPU rgba8 */
  abstract getSrcType(): number;
  abstract reset(mask: Float32Array): void;
  abstract dispose(): void;

  /** Returns 0–1 stability estimate */
  getStability(): number {
    return Math.min(1, this.step / 3000);
  }

  /** Returns SVG string if this effect supports vector export, null otherwise */
  toSVG(): string | null { return null; }
}
