import { useEffect, useRef, useState } from "react";
import { WhiteHoleSim, type SimEvent, type SimParams, type SimStats } from "./sim/WhiteHoleSim";
import { STRINGS, detectLang, saveLang, type Lang } from "./i18n";

const DEFAULTS: SimParams = {
  flowSpeed: 1,
  spin: 1,
  bloom: 0,
  lensing: 1,
  particleCount: 90000,
  jets: true,
  shockwaves: true,
  autoRotate: true,
  timeScale: 1,
};

interface Toast {
  id: number;
  event: SimEvent;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-[11px] uppercase tracking-wider text-slate-400 mb-1">
        <span>{label}</span>
        <span className="text-slate-200 font-mono">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sky-300 h-1 cursor-pointer"
      />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full text-sm text-slate-300 py-1 group"
    >
      <span>{label}</span>
      <span
        className={`w-9 h-5 rounded-full relative transition-colors ${value ? "bg-sky-400/80" : "bg-slate-700"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<WhiteHoleSim | null>(null);
  const [params, setParams] = useState<SimParams>(DEFAULTS);
  const [stats, setStats] = useState<SimStats>({ fps: 0, projectiles: 0, ejected: 0, distance: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  // on phones the panel would cover most of the scene, so start with it closed
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 640);
  const [infoOpen, setInfoOpen] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [lang, setLang] = useState<Lang>(detectLang);
  const toastId = useRef(0);
  const t = STRINGS[lang];

  useEffect(() => {
    saveLang(lang);
    document.documentElement.lang = lang;
    document.title = t.pageTitle;
  }, [lang, t]);

  useEffect(() => {
    if (!mountRef.current) return;
    let sim: WhiteHoleSim;
    try {
      sim = new WhiteHoleSim(
        mountRef.current,
        DEFAULTS,
        (s) => setStats(s),
        (event) => {
          const id = ++toastId.current;
          setToasts((ts) => [...ts.slice(-3), { id, event }]);
          setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3800);
        }
      );
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
  }, []);

  useEffect(() => {
    simRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        // also stops a focused button from being "clicked" by the same key press
        e.preventDefault();
        if (!e.repeat) simRef.current?.throwMatter();
      } else if (e.code === "KeyB") simRef.current?.triggerBurst();
      else if (e.code === "KeyH") setPanelOpen((v) => !v);
      else if (e.code === "Escape") setInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof SimParams>(k: K, v: SimParams[K]) => setParams((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none font-sans">
      <div ref={mountRef} className="absolute inset-0" />

      {webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-8 text-slate-300">{t.webglError}</div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 pointer-events-none flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] uppercase text-sky-300/80">{t.kicker}</div>
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight mt-1">
            {t.titleA}{" "}
            <span className="font-semibold bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">
              {t.titleB}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md">{t.subtitle}</p>
        </div>
        <div className="flex items-start gap-3 pointer-events-auto">
          <div className="hidden sm:grid grid-cols-2 gap-x-5 gap-y-1 text-[11px] font-mono text-slate-400 bg-black/30 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3">
            <span>FPS</span>
            <span className="text-right text-slate-100">{stats.fps}</span>
            <span>{t.statDistance}</span>
            <span className="text-right text-slate-100">{stats.distance.toFixed(1)} Rₛ</span>
            <span>{t.statActive}</span>
            <span className="text-right text-slate-100">{stats.projectiles}</span>
            <span>{t.statEjected}</span>
            <span className="text-right text-sky-200">{stats.ejected}</span>
          </div>
          <button
            onClick={() => setLang(lang === "tr" ? "en" : "tr")}
            title={t.langSwitchTitle}
            className="px-2.5 py-1.5 rounded-lg bg-black/30 hover:bg-white/10 backdrop-blur-md border border-white/10 text-xs font-mono tracking-wider whitespace-nowrap"
          >
            <span className={lang === "tr" ? "text-white" : "text-slate-500"}>TR</span>
            <span className="text-slate-600"> / </span>
            <span className={lang === "en" ? "text-white" : "text-slate-500"}>EN</span>
          </button>
        </div>
      </div>

      {/* Toasts */}
      <div className="absolute top-36 sm:top-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none w-[90%] max-w-md">
        {toasts.map((ts) => (
          <div
            key={ts.id}
            className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-sm text-slate-100 shadow-lg animate-[fadein_0.3s_ease]"
          >
            {t.events[ts.event]}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 px-2 w-max max-w-full">
        <button
          onClick={() => simRef.current?.throwMatter()}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-sm transition"
        >
          ☄️ {t.throwBtn} <kbd className="ml-1 text-[10px] text-slate-400">{t.spaceKey}</kbd>
        </button>
        <button
          onClick={() => simRef.current?.triggerBurst()}
          className="px-4 py-2.5 rounded-xl bg-sky-300/20 hover:bg-sky-300/30 border border-sky-200/30 backdrop-blur-md text-sm transition"
        >
          💥 {t.burstBtn} <kbd className="ml-1 text-[10px] text-slate-400">B</kbd>
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-sm transition"
        >
          ℹ️ {t.infoBtn}
        </button>
      </div>

      {/* Control panel */}
      <div
        className={`absolute right-3 sm:right-6 top-40 sm:top-44 w-[260px] transition-all duration-300 ${
          panelOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[calc(100dvh-19rem)] sm:max-h-[calc(100dvh-17rem)] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide">{t.controls}</h2>
            <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">
              ×
            </button>
          </div>
          <Slider label={t.flowSpeed} value={params.flowSpeed} min={0} max={3} step={0.05} onChange={(v) => set("flowSpeed", v)} />
          <Slider label={t.spin} value={params.spin} min={0} max={3} step={0.05} onChange={(v) => set("spin", v)} />
          <Slider label={t.timeScale} value={params.timeScale} min={0} max={2} step={0.05} onChange={(v) => set("timeScale", v)} fmt={(v) => `${v.toFixed(2)}×`} />
          <Slider label={t.bloom} value={params.bloom} min={0} max={3} step={0.05} onChange={(v) => set("bloom", v)} />
          <Slider label={t.lensing} value={params.lensing} min={0} max={2.5} step={0.05} onChange={(v) => set("lensing", v)} />
          <Slider
            label={t.particles}
            value={params.particleCount}
            min={10000}
            max={160000}
            step={5000}
            onChange={(v) => set("particleCount", v)}
            fmt={(v) => `${Math.round(v / 1000)}K`}
          />
          <div className="border-t border-white/10 pt-2">
            <Toggle label={t.jets} value={params.jets} onChange={(v) => set("jets", v)} />
            <Toggle label={t.shockwaves} value={params.shockwaves} onChange={(v) => set("shockwaves", v)} />
            <Toggle label={t.autoRotate} value={params.autoRotate} onChange={(v) => set("autoRotate", v)} />
          </div>
          <div className="border-t border-white/10 pt-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">{t.camera}</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button onClick={() => simRef.current?.setCameraPreset("top")} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">{t.camTop}</button>
              <button onClick={() => simRef.current?.setCameraPreset("side")} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">{t.camSide}</button>
              <button onClick={() => simRef.current?.setCameraPreset("close")} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">{t.camClose}</button>
              <button onClick={() => simRef.current?.resetCamera()} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">{t.camReset}</button>
            </div>
          </div>
          <button
            onClick={() => setParams(DEFAULTS)}
            className="w-full text-xs py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            {t.resetDefaults}
          </button>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {t.mouseHelp} <br />
            {t.keyHelp}
          </p>
        </div>
      </div>
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute right-3 sm:right-6 top-40 sm:top-44 px-3 py-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-sm hover:bg-white/10"
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
              <h2 className="text-2xl font-semibold">{t.infoBtn}</h2>
              <button onClick={() => setInfoOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>{t.info.intro}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-white font-medium mb-1">⚪ {t.info.whiteTitle}</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    {t.info.whiteItems.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-orange-300 font-medium mb-1">⚫ {t.info.blackTitle}</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    {t.info.blackItems.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p>{t.info.gravity}</p>
              <p>{t.info.whatYouSee}</p>
              <p className="text-slate-500 text-xs">{t.info.note}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
