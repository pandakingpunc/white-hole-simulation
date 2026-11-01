import { useEffect, useRef, useState } from "react";
import { BinarySim, type BinaryEvent, type BinaryMode, type BinaryParams, type BinaryStats } from "./sim/BinarySim";
import { eardleyLifetime } from "./sim/eardley";
import { STRINGS } from "./i18n";
import { BINARY_STRINGS, PAPER_URL } from "./i18nBinary";
import { LangButton, Slider, Toggle, type ViewProps } from "./ui";

const DEFAULTS: Omit<BinaryParams, "mode"> = {
  a0: 20,
  q: 1,
  logDM: -45, // about the CMB load on a 10 solar-mass hole, see Table 1 of the paper
  tExplode: Infinity,
  instability: true,
  bloom: 0,
  speed: 1,
  autoRotate: true,
};

interface Toast {
  id: number;
  event: BinaryEvent;
}

const fmtM = (v: number) => (Number.isFinite(v) ? `${v < 100 ? v.toFixed(1) : Math.round(v)} M` : "∞");

export default function BinaryView({ mode, lang, setLang, modeTabs }: ViewProps & { mode: BinaryMode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<BinarySim | null>(null);
  const [params, setParams] = useState<BinaryParams>({ ...DEFAULTS, mode });
  const [logTExplode, setLogTExplode] = useState(2);
  const [stats, setStats] = useState<BinaryStats | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 640);
  const [infoOpen, setInfoOpen] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const toastId = useRef(0);
  const t = STRINGS[lang];
  const tb = BINARY_STRINGS[lang];

  useEffect(() => {
    if (!mountRef.current) return;
    let sim: BinarySim;
    try {
      sim = new BinarySim(mountRef.current, params, setStats, (event) => {
        const id = ++toastId.current;
        setToasts((ts) => [...ts.slice(-3), { id, event }]);
        setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4500);
      });
    } catch (e) {
      setWebglFailed(true);
      console.error(e);
      return;
    }
    simRef.current = sim;
    return () => {
      sim.dispose();
      simRef.current = null;
    };
    // the scene is built once; later param changes go through setParams/reset below
  }, []);

  // physics settings restart the run, display settings apply live
  const physicsKey = `${params.a0}|${params.q}|${params.logDM}|${params.tExplode}|${params.instability}`;
  const lastPhysics = useRef(physicsKey);
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (physicsKey !== lastPhysics.current) {
      lastPhysics.current = physicsKey;
      sim.reset(params);
    } else sim.setParams(params);
  }, [params, physicsKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "KeyR") simRef.current?.reset(params);
      else if (e.code === "KeyH") setPanelOpen((v) => !v);
      else if (e.code === "Escape") setInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [params]);

  const set = <K extends keyof BinaryParams>(k: K, v: BinaryParams[K]) => setParams((p) => ({ ...p, [k]: v }));
  const selfExplode = Number.isFinite(params.tExplode);

  // separation from which the first white hole could still reach merger (paper, Eq. 10)
  const m1 = 1 / (1 + params.q);
  const eta = params.q / (1 + params.q) ** 2;
  const tau1 = eardleyLifetime(m1, m1 * 10 ** params.logDM);
  const aCrit = ((256 / 5) * eta * tau1) ** 0.25;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none font-sans">
      <div ref={mountRef} className="absolute inset-0" />

      {webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-8 text-slate-300">{t.webglError}</div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 pointer-events-none flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] uppercase text-sky-300/80">{tb.kicker}</div>
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight mt-1">
            {tb.title[mode][0]}{" "}
            <span className="font-semibold bg-gradient-to-r from-white via-sky-100 to-orange-300 bg-clip-text text-transparent">
              {tb.title[mode][1]}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md">{tb.subtitle[mode]}</p>
          {modeTabs}
        </div>
        <div className="flex items-start gap-3 pointer-events-auto">
          {stats && (
            <div className="hidden sm:block text-[11px] font-mono text-slate-400 bg-black/30 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 min-w-[230px]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span>FPS</span>
                <span className="text-right text-slate-100">{stats.fps}</span>
                <span>{tb.statTime}</span>
                <span className="text-right text-slate-100">{fmtM(stats.t)}</span>
                <span>{tb.statSep}</span>
                <span className="text-right text-slate-100">{stats.phase === "inspiral" ? fmtM(stats.a) : "–"}</span>
              </div>
              <div className="border-t border-white/10 mt-2 pt-2 space-y-1">
                {stats.bodies.map((bd, i) => (
                  <div key={i}>
                    <div className="flex justify-between">
                      <span>{tb.body(i)} · {bd.m.toFixed(2)} M</span>
                      <span className={bd.kind === "white" ? "text-sky-200" : bd.kind === "black" ? "text-orange-300" : "text-slate-500"}>
                        {tb.kind[bd.kind]}
                      </span>
                    </div>
                    {bd.kind === "white" && (
                      <div className="flex justify-between text-slate-500">
                        <span>{tb.deadline}</span>
                        <span>{fmtM(Math.min(bd.sealAt, bd.explodeAt))}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 mt-2 pt-2 text-slate-200">
                {tb.phase[stats.phase]}
                {stats.finalMass !== null && <span className="text-slate-400"> · {tb.finalMass} {stats.finalMass.toFixed(3)} M</span>}
              </div>
            </div>
          )}
          <LangButton lang={lang} setLang={setLang} />
        </div>
      </div>

      {/* Toasts */}
      <div className="absolute top-44 sm:top-40 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none w-[90%] max-w-lg">
        {toasts.map((ts) => (
          <div
            key={ts.id}
            className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-sm text-slate-100 shadow-lg animate-[fadein_0.3s_ease] text-center"
          >
            {tb.events[ts.event]}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 px-2 w-max max-w-full">
        <button
          onClick={() => simRef.current?.reset(params)}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-sm transition"
        >
          🔄 {tb.restart} <kbd className="ml-1 text-[10px] text-slate-400">R</kbd>
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-sm transition"
        >
          ℹ️ {tb.info}
        </button>
        <a
          href={PAPER_URL}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2.5 rounded-xl bg-sky-300/20 hover:bg-sky-300/30 border border-sky-200/30 backdrop-blur-md text-sm transition"
        >
          📄 {tb.paper}
        </a>
      </div>

      {/* Control panel */}
      <div
        className={`absolute right-3 sm:right-6 top-48 sm:top-[17rem] w-[260px] transition-all duration-300 ${
          panelOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[calc(100dvh-20rem)] sm:max-h-[calc(100dvh-23rem)] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide">{t.controls}</h2>
            <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">
              ×
            </button>
          </div>
          <Slider keepCase label={tb.a0} value={params.a0} min={12} max={60} step={1} onChange={(v) => set("a0", v)} fmt={(v) => v.toFixed(0)} />
          <Slider keepCase label={tb.q} value={params.q} min={0.1} max={1} step={0.05} onChange={(v) => set("q", v)} />
          <Slider keepCase label={tb.logDM} value={params.logDM} min={-90} max={-2} step={1} onChange={(v) => set("logDM", v)} fmt={(v) => v.toFixed(0)} />
          <div className="text-[11px] font-mono text-slate-400 bg-white/5 rounded-lg px-2.5 py-2 leading-relaxed">
            τ_E(m₁) = {tau1.toFixed(0)} M
            <br />
            {tb.aCrit} {aCrit.toFixed(1)} M
          </div>
          <div className="border-t border-white/10 pt-2">
            <Toggle label={tb.instability} value={params.instability} onChange={(v) => set("instability", v)} />
            <Toggle
              label={tb.selfExplode}
              value={selfExplode}
              onChange={(v) => set("tExplode", v ? 10 ** logTExplode : Infinity)}
            />
          </div>
          {selfExplode && (
            <Slider
              label={tb.tExplode}
              value={logTExplode}
              min={1}
              max={3.5}
              step={0.05}
              onChange={(v) => {
                setLogTExplode(v);
                set("tExplode", 10 ** v);
              }}
              fmt={(v) => Math.round(10 ** v).toString()}
            />
          )}
          <div className="border-t border-white/10 pt-2 space-y-3">
            <Slider label={tb.speed} value={params.speed} min={0.1} max={4} step={0.1} onChange={(v) => set("speed", v)} fmt={(v) => `${v.toFixed(1)}×`} />
            <Slider label={t.bloom} value={params.bloom} min={0} max={3} step={0.05} onChange={(v) => set("bloom", v)} />
            <Toggle label={t.autoRotate} value={params.autoRotate} onChange={(v) => set("autoRotate", v)} />
          </div>
          <button
            onClick={() => {
              setParams({ ...DEFAULTS, mode });
              simRef.current?.resetCamera();
            }}
            className="w-full text-xs py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            {t.resetDefaults}
          </button>
        </div>
      </div>
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute right-3 sm:right-6 top-48 sm:top-[17rem] px-3 py-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-sm hover:bg-white/10"
        >
          ⚙️ {t.controls}
        </button>
      )}

      {/* Info modal */}
      {infoOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-20" onClick={() => setInfoOpen(false)}>
          <div
            className="max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-slate-950/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl select-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-semibold">{tb.infoTitle}</h2>
              <button onClick={() => setInfoOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-300 leading-relaxed">{tb.infoBody}</div>
            <a href={PAPER_URL} target="_blank" rel="noreferrer" className="inline-block mt-5 text-sm text-sky-300 hover:text-sky-200 underline">
              📄 {tb.paper}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
