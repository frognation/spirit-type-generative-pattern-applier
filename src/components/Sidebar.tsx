import { useState, useCallback } from 'react';
import { AppState, EffectName, ColorMode } from '../types';

interface SidebarProps {
  state: AppState & { physarumOuter?: boolean };
  setState: (updater: Partial<AppState & { physarumOuter?: boolean }> | ((prev: AppState & { physarumOuter?: boolean }) => AppState & { physarumOuter?: boolean })) => void;
  setParamLive: (updater: Partial<AppState>) => void;
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button className={`section-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {title}<span className="chev">▾</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function Field({ label, val, children }: { label: string; val?: string | number; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="label">
        <span>{label}</span>
        {val !== undefined && <span className="label-val">{val}</span>}
      </div>
      {children}
    </div>
  );
}

function Slider({ value, min, max, step = 0.01, onChange }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))} />
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} />;
}

const EFFECTS: { id: EffectName | 'physarum-outer'; label: string }[] = [
  { id: 'physarum',       label: 'Physarum' },
  { id: 'physarum-outer', label: 'Hate' },
  { id: 'rd-maze',        label: 'RD Maze' },
  { id: 'rd-spots',       label: 'RD Spots' },
  { id: 'gol',            label: 'Life' },
  { id: 'dla',            label: 'DLA' },
  { id: 'voronoi',        label: 'Voronoi' },
  { id: 'wave',           label: 'Wave' },
  { id: 'ca',             label: 'CA' },
  { id: 'fractal',        label: 'Fractal' },
];

const FONTS = [
  { label: 'Georgia',   value: 'Georgia, serif' },
  { label: 'Helvetica', value: 'Helvetica Neue, Arial, sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
  { label: 'Garamond',  value: 'Garamond, serif' },
  { label: 'Futura',    value: 'Futura, Century Gothic, sans-serif' },
];

function hexFromRgb(rgb: [number, number, number]) {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}
function rgbFromHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export function Sidebar({ state, setState, setParamLive }: SidebarProps) {
  const activeEffect = (state as any).physarumOuter && state.effect === 'physarum'
    ? 'physarum-outer' : state.effect;

  const selectEffect = useCallback((id: string) => {
    if (id === 'physarum-outer') {
      setState({ effect: 'physarum', physarumOuter: true });
    } else {
      setState({ effect: id as EffectName, physarumOuter: false });
    }
  }, [setState]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Spirit Type</div>
        <div className="sidebar-sub">Generative Pattern Applier</div>
      </div>

      {/* ── Text ── */}
      <Section title="Text" defaultOpen>
        <Field label="Content">
          <textarea rows={2} value={state.text}
            onChange={e => setState({ text: e.target.value })} />
        </Field>
        <Field label="Font">
          <select value={state.font} onChange={e => setState({ font: e.target.value })}>
            {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Weight">
          <select value={state.weight} onChange={e => setState({ weight: e.target.value })}>
            {['300','400','500','600','700','800','900'].map(w =>
              <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Size" val={state.fontSize}>
          <Slider value={state.fontSize} min={40} max={400} step={1}
            onChange={v => setState({ fontSize: v })} />
        </Field>
        <Field label="Spacing" val={state.letterSpacing}>
          <Slider value={state.letterSpacing} min={-20} max={80} step={1}
            onChange={v => setState({ letterSpacing: v })} />
        </Field>
      </Section>

      {/* ── Effect ── */}
      <Section title="Effect" defaultOpen>
        <div className="pills">
          {EFFECTS.map(e => (
            <button key={e.id}
              className={`pill${activeEffect === e.id ? ' pill-active' : ''}`}
              onClick={() => selectEffect(e.id)}>
              {e.label}
            </button>
          ))}
        </div>

        {/* Per-effect params */}
        {state.effect === 'physarum' && (
          <>
            <Field label="Agents" val={state.physarum.agentCount}>
              <Slider value={state.physarum.agentCount} min={4096} max={262144} step={4096}
                onChange={v => setState(p => ({ ...p, physarum: { ...p.physarum, agentCount: v } }))} />
            </Field>
            <Field label="Sensor Angle" val={`${state.physarum.sensorAngle}°`}>
              <Slider value={state.physarum.sensorAngle} min={5} max={90} step={1}
                onChange={v => setParamLive({ physarum: { ...state.physarum, sensorAngle: v } })} />
            </Field>
            <Field label="Sensor Dist" val={state.physarum.sensorDist}>
              <Slider value={state.physarum.sensorDist} min={2} max={40} step={0.5}
                onChange={v => setParamLive({ physarum: { ...state.physarum, sensorDist: v } })} />
            </Field>
            <Field label="Turn Angle" val={`${state.physarum.turnAngle}°`}>
              <Slider value={state.physarum.turnAngle} min={1} max={90} step={1}
                onChange={v => setParamLive({ physarum: { ...state.physarum, turnAngle: v } })} />
            </Field>
            <Field label="Speed" val={state.physarum.speed}>
              <Slider value={state.physarum.speed} min={0.2} max={4} step={0.1}
                onChange={v => setParamLive({ physarum: { ...state.physarum, speed: v } })} />
            </Field>
            <Field label="Decay" val={state.physarum.decay}>
              <Slider value={state.physarum.decay} min={0.8} max={0.999} step={0.001}
                onChange={v => setParamLive({ physarum: { ...state.physarum, decay: v } })} />
            </Field>
          </>
        )}

        {(state.effect === 'rd-maze' || state.effect === 'rd-spots') && (
          <>
            <Field label="Feed (f)" val={state.rd.f.toFixed(4)}>
              <Slider value={state.rd.f} min={0.01} max={0.08} step={0.0001}
                onChange={v => setState(p => ({ ...p, rd: { ...p.rd, f: v } }))} />
            </Field>
            <Field label="Kill (k)" val={state.rd.k.toFixed(4)}>
              <Slider value={state.rd.k} min={0.04} max={0.075} step={0.0001}
                onChange={v => setState(p => ({ ...p, rd: { ...p.rd, k: v } }))} />
            </Field>
            <Field label="dA" val={state.rd.dA.toFixed(3)}>
              <Slider value={state.rd.dA} min={0.05} max={0.5} step={0.001}
                onChange={v => setParamLive({ rd: { ...state.rd, dA: v } })} />
            </Field>
            <Field label="dB" val={state.rd.dB.toFixed(3)}>
              <Slider value={state.rd.dB} min={0.02} max={0.3} step={0.001}
                onChange={v => setParamLive({ rd: { ...state.rd, dB: v } })} />
            </Field>
          </>
        )}

        {state.effect === 'gol' && (
          <>
            <Field label="Density" val={state.gol.density.toFixed(2)}>
              <Slider value={state.gol.density} min={0.1} max={0.9} step={0.01}
                onChange={v => setState(p => ({ ...p, gol: { ...p.gol, density: v } }))} />
            </Field>
            <Field label="Variant">
              <div className="pills">
                {(['classic','highlife','34life'] as const).map(v => (
                  <button key={v} className={`pill${state.gol.variant === v ? ' pill-active' : ''}`}
                    onClick={() => setState(p => ({ ...p, gol: { ...p.gol, variant: v } }))}>
                    {v}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {state.effect === 'dla' && (
          <>
            <Field label="Walkers" val={state.dla.walkers}>
              <Slider value={state.dla.walkers} min={200} max={10000} step={100}
                onChange={v => setState(p => ({ ...p, dla: { ...p.dla, walkers: v } }))} />
            </Field>
            <Field label="Stickiness" val={state.dla.stickiness.toFixed(2)}>
              <Slider value={state.dla.stickiness} min={0.1} max={1.0} step={0.01}
                onChange={v => setParamLive({ dla: { ...state.dla, stickiness: v } })} />
            </Field>
            <Field label="Branch Bias" val={state.dla.branchBias.toFixed(2)}>
              <Slider value={state.dla.branchBias} min={0} max={1} step={0.01}
                onChange={v => setParamLive({ dla: { ...state.dla, branchBias: v } })} />
            </Field>
          </>
        )}

        {state.effect === 'voronoi' && (
          <>
            <Field label="Seeds" val={state.voronoi.numSeeds}>
              <Slider value={state.voronoi.numSeeds} min={10} max={500} step={10}
                onChange={v => setState(p => ({ ...p, voronoi: { ...p.voronoi, numSeeds: v } }))} />
            </Field>
            <div className="toggle-row">
              <span className="toggle-label">Show Edges</span>
              <Toggle on={state.voronoi.showEdges}
                onChange={v => setParamLive({ voronoi: { ...state.voronoi, showEdges: v } })} />
            </div>
            <div className="toggle-row">
              <span className="toggle-label">Animate</span>
              <Toggle on={state.voronoi.animate}
                onChange={v => setParamLive({ voronoi: { ...state.voronoi, animate: v } })} />
            </div>
          </>
        )}

        {state.effect === 'wave' && (
          <>
            <Field label="Sources" val={state.wave.numSources}>
              <Slider value={state.wave.numSources} min={1} max={32} step={1}
                onChange={v => setState(p => ({ ...p, wave: { ...p.wave, numSources: v } }))} />
            </Field>
            <Field label="Frequency" val={state.wave.frequency.toFixed(3)}>
              <Slider value={state.wave.frequency} min={0.01} max={0.2} step={0.001}
                onChange={v => setParamLive({ wave: { ...state.wave, frequency: v } })} />
            </Field>
            <Field label="Speed" val={state.wave.speed.toFixed(2)}>
              <Slider value={state.wave.speed} min={0.1} max={5} step={0.1}
                onChange={v => setParamLive({ wave: { ...state.wave, speed: v } })} />
            </Field>
          </>
        )}

        {state.effect === 'ca' && (
          <>
            <Field label="Density" val={state.ca.density.toFixed(2)}>
              <Slider value={state.ca.density} min={0.05} max={0.5} step={0.01}
                onChange={v => setState(p => ({ ...p, ca: { ...p.ca, density: v } }))} />
            </Field>
            <Field label="Rule">
              <div className="pills">
                {(['brian','seeds','morley'] as const).map(r => (
                  <button key={r} className={`pill${state.ca.rule === r ? ' pill-active' : ''}`}
                    onClick={() => setState(p => ({ ...p, ca: { ...p.ca, rule: r } }))}>
                    {r}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {state.effect === 'fractal' && (
          <>
            <Field label="Attractors" val={state.fractal.numAttractors}>
              <Slider value={state.fractal.numAttractors} min={20} max={800} step={10}
                onChange={v => setState(p => ({ ...p, fractal: { ...p.fractal, numAttractors: v } }))} />
            </Field>
            <Field label="Segment Len" val={state.fractal.segmentLen}>
              <Slider value={state.fractal.segmentLen} min={1} max={12} step={0.5}
                onChange={v => setParamLive({ fractal: { ...state.fractal, segmentLen: v } })} />
            </Field>
            <Field label="Kill Dist" val={state.fractal.killDist}>
              <Slider value={state.fractal.killDist} min={2} max={30} step={1}
                onChange={v => setParamLive({ fractal: { ...state.fractal, killDist: v } })} />
            </Field>
          </>
        )}
      </Section>

      {/* ── Color ── */}
      <Section title="Color">
        <Field label="Mode">
          <div className="pills">
            {(['bw','2tone','3tone'] as ColorMode[]).map(m => (
              <button key={m} className={`pill${state.colorMode === m ? ' pill-active' : ''}`}
                onClick={() => setParamLive({ colorMode: m })}>
                {m}
              </button>
            ))}
          </div>
        </Field>
        {state.colorMode !== 'bw' && (
          <div className="color-row">
            <div className="color-item">
              <div className="color-lbl">Background</div>
              <div className="color-swatch">
                <div className="color-preview" style={{ background: hexFromRgb(state.colors.bg) }} />
                <input type="color" value={hexFromRgb(state.colors.bg)}
                  onChange={e => setParamLive({ colors: { ...state.colors, bg: rgbFromHex(e.target.value) } })} />
              </div>
            </div>
            <div className="color-item">
              <div className="color-lbl">Color 1</div>
              <div className="color-swatch">
                <div className="color-preview" style={{ background: hexFromRgb(state.colors.c1) }} />
                <input type="color" value={hexFromRgb(state.colors.c1)}
                  onChange={e => setParamLive({ colors: { ...state.colors, c1: rgbFromHex(e.target.value) } })} />
              </div>
            </div>
            {state.colorMode === '3tone' && (
              <div className="color-item">
                <div className="color-lbl">Color 2</div>
                <div className="color-swatch">
                  <div className="color-preview" style={{ background: hexFromRgb(state.colors.c2) }} />
                  <input type="color" value={hexFromRgb(state.colors.c2)}
                    onChange={e => setParamLive({ colors: { ...state.colors, c2: rgbFromHex(e.target.value) } })} />
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Canvas ── */}
      <Section title="Canvas">
        <div className="canvas-row">
          <div className="field">
            <div className="label"><span>W</span></div>
            <input type="number" value={state.canvasW} min={200} max={3840} step={10}
              onChange={e => setState({ canvasW: Number(e.target.value) })} />
          </div>
          <div className="field">
            <div className="label"><span>H</span></div>
            <input type="number" value={state.canvasH} min={100} max={2160} step={10}
              onChange={e => setState({ canvasH: Number(e.target.value) })} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <div className="pills">
            {[
              { label: '800×400', w: 800, h: 400 },
              { label: '1200×600', w: 1200, h: 600 },
              { label: '1920×1080', w: 1920, h: 1080 },
              { label: 'Square', w: 800, h: 800 },
            ].map(p => (
              <button key={p.label} className="pill"
                onClick={() => setState({ canvasW: p.w, canvasH: p.h })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
