import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { AppState, DEFAULT_STATE, EffectName } from './types';
import { Simulation } from './Simulation';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import './App.css';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef    = useRef<Simulation | null>(null);
  const recRef    = useRef<MediaRecorder | null>(null);

  const [state, setStateRaw] = useState<AppState & { physarumOuter?: boolean }>({ ...DEFAULT_STATE });
  const [step, setStep]          = useState(0);
  const [stability, setStability] = useState(0);
  const [recording, setRecording] = useState(false);

  // Initialise simulation once canvas is mounted
  useEffect(() => {
    if (!canvasRef.current) return;
    const sim = new Simulation(canvasRef.current, state);
    simRef.current = sim;
    sim.onStepUpdate = (s, stab) => {
      setStep(s);
      setStability(stab);
    };
    return () => { sim.dispose(); simRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced state-to-sim sync
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setState = useCallback((updater: Partial<AppState & { physarumOuter?: boolean }> | ((prev: AppState & { physarumOuter?: boolean }) => AppState & { physarumOuter?: boolean })) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        simRef.current?.reset(next);
        simRef.current?.updateState(next);
      }, 300);
      return next;
    });
  }, []);

  // Immediate param update (no rebuild)
  const setParamLive = useCallback((updater: Partial<AppState>) => {
    setStateRaw(prev => {
      const next = { ...prev, ...updater };
      simRef.current?.updateState(next);
      return next;
    });
  }, []);

  const togglePlay = useCallback(() => {
    setStateRaw(prev => {
      const playing = !prev.playing;
      if (playing) simRef.current?.play();
      else simRef.current?.pause();
      return { ...prev, playing };
    });
  }, []);

  const doStep = useCallback(() => {
    simRef.current?.step(state);
  }, [state]);

  const doReset = useCallback(() => {
    setStep(0); setStability(0);
    simRef.current?.reset(state);
  }, [state]);

  const exportPNG = useCallback(() => {
    const data = simRef.current?.exportPNG();
    if (!data) return;
    const a = document.createElement('a'); a.href = data; a.download = 'spirit-type.png'; a.click();
  }, []);

  const exportSVG = useCallback(() => {
    const svg = simRef.current?.exportSVG();
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'spirit-type.svg'; a.click();
  }, []);

  const toggleRecord = useCallback(() => {
    if (recording) {
      recRef.current?.stop(); recRef.current = null; setRecording(false);
    } else {
      const rec = simRef.current?.startRecording();
      if (rec) { recRef.current = rec; setRecording(true);
        if (!state.playing) { simRef.current?.play(); setStateRaw(p => ({ ...p, playing: true })); }
      }
    }
  }, [recording, state.playing]);

  // Theme on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
  }, [state.isDark]);

  return (
    <div className="app-root">
      <div className="canvas-wrap" style={{ background: state.isDark ? '#000' : '#fff' }}>
        <canvas ref={canvasRef} />
      </div>

      <Sidebar state={state} setState={setState} setParamLive={setParamLive} />

      <Toolbar
        state={state}
        step={step}
        stability={stability}
        recording={recording}
        onPlay={togglePlay}
        onStep={doStep}
        onReset={doReset}
        onExportPNG={exportPNG}
        onExportSVG={exportSVG}
        onRecord={toggleRecord}
        setParamLive={setParamLive}
      />

      <button
        className="theme-toggle"
        onClick={() => setParamLive({ isDark: !state.isDark })}
        title="Toggle theme"
      >
        {state.isDark ? '◑' : '◐'}
      </button>
    </div>
  );
}
