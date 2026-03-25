import { AppState } from '../types';

interface ToolbarProps {
  state: AppState;
  step: number;
  stability: number;
  recording: boolean;
  onPlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onRecord: () => void;
  setParamLive: (u: Partial<AppState>) => void;
}

export function Toolbar({
  state, step, stability, recording,
  onPlay, onStep, onReset,
  onExportPNG, onExportSVG, onRecord,
  setParamLive,
}: ToolbarProps) {
  const stabPct = Math.round(Math.min(stability * 100, 100));

  return (
    <div className="toolbar">
      {/* Play / Pause */}
      <button
        className={`tb-btn ${state.playing ? 'pause' : 'play'}`}
        onClick={onPlay}
        title={state.playing ? 'Pause' : 'Play'}
      >
        {state.playing ? '⏸' : '▶'}
      </button>

      {/* Step */}
      <button className="tb-btn" onClick={onStep} title="Step">⏭</button>

      {/* Reset */}
      <button className="tb-btn" onClick={onReset} title="Reset">↺</button>

      <div className="tb-sep" />

      {/* Speed */}
      <div className="tb-group">
        <span className="tb-tiny">Speed ×{state.speedMult}</span>
        <input
          type="range" className="tb-speed"
          min={1} max={8} step={1} value={state.speedMult}
          onChange={e => setParamLive({ speedMult: Number(e.target.value) })}
        />
      </div>

      <div className="tb-sep" />

      {/* Step counter + stability */}
      <div className="stab-wrap">
        <span className="tb-tiny">Step {step}</span>
        <div className="stab-bg">
          <div className="stab-fill" style={{ width: `${stabPct}%` }} />
        </div>
        <span className="tb-tiny">{stabPct}% stable</span>
      </div>

      <div className="tb-sep" />

      {/* Export */}
      <button className="export-btn" onClick={onExportPNG} title="Export PNG">PNG</button>
      <button className="export-btn" onClick={onExportSVG} title="Export SVG">SVG</button>
      <button
        className={`export-btn${recording ? ' rec' : ''}`}
        onClick={onRecord}
        title={recording ? 'Stop recording' : 'Record WebM'}
      >
        {recording ? '⏹ REC' : '⏺ REC'}
      </button>
    </div>
  );
}
