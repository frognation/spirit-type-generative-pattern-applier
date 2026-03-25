export function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? '';
    gl.deleteShader(s);
    throw new Error(`Shader compile error:\n${log}\n\nSource:\n${src}`);
  }
  return s;
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vsSrc: string,
  fsSrc: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? '';
    gl.deleteProgram(p);
    throw new Error(`Program link error: ${log}`);
  }
  return p;
}

export function makeTexture(
  gl: WebGL2RenderingContext,
  w: number, h: number,
  internalFmt: number,
  fmt: number,
  type: number,
  filter: number,
  data: ArrayBufferView | null = null
): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, fmt, type, data);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return t;
}

export function makeR32F(gl: WebGL2RenderingContext, w: number, h: number, data?: Float32Array): WebGLTexture {
  return makeTexture(gl, w, h, gl.R32F, gl.RED, gl.FLOAT, gl.LINEAR, data ?? null);
}

export function makeRGBA32F(gl: WebGL2RenderingContext, w: number, h: number, data?: Float32Array): WebGLTexture {
  return makeTexture(gl, w, h, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST, data ?? null);
}

export function makeRGBA8(gl: WebGL2RenderingContext, w: number, h: number, data?: Uint8Array): WebGLTexture {
  return makeTexture(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, data ?? null);
}

export function makeFBO(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.warn('FBO incomplete:', status);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

export function bindTex(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  name: string,
  unit: number,
  tex: WebGLTexture
): void {
  const loc = gl.getUniformLocation(prog, name);
  if (loc == null) return;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc, unit);
}

export function u1i(gl: WebGL2RenderingContext, p: WebGLProgram, n: string, v: number) {
  const loc = gl.getUniformLocation(p, n); if (loc) gl.uniform1i(loc, v);
}
export function u1f(gl: WebGL2RenderingContext, p: WebGLProgram, n: string, v: number) {
  const loc = gl.getUniformLocation(p, n); if (loc) gl.uniform1f(loc, v);
}
export function u2f(gl: WebGL2RenderingContext, p: WebGLProgram, n: string, x: number, y: number) {
  const loc = gl.getUniformLocation(p, n); if (loc) gl.uniform2f(loc, x, y);
}
export function u3f(gl: WebGL2RenderingContext, p: WebGLProgram, n: string, x: number, y: number, z: number) {
  const loc = gl.getUniformLocation(p, n); if (loc) gl.uniform3f(loc, x, y, z);
}
export function u3fv(gl: WebGL2RenderingContext, p: WebGLProgram, n: string, v: number[]) {
  const loc = gl.getUniformLocation(p, n); if (loc) gl.uniform3fv(loc, v);
}

/** Quad VAO cache */
const _quadBuf = new WeakMap<WebGL2RenderingContext, WebGLBuffer>();
const _quadVAO = new WeakMap<WebGLProgram, WebGLVertexArrayObject>();

export function getQuadBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
  if (!_quadBuf.has(gl)) {
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    _quadBuf.set(gl, buf);
  }
  return _quadBuf.get(gl)!;
}

export function drawQuad(gl: WebGL2RenderingContext, prog: WebGLProgram): void {
  if (!_quadVAO.has(prog)) {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, getQuadBuffer(gl));
    const loc = gl.getAttribLocation(prog, 'a_pos');
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    _quadVAO.set(prog, vao);
  }
  gl.bindVertexArray(_quadVAO.get(prog)!);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}
