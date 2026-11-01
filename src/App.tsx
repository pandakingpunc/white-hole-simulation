import { useEffect, useRef, useState } from "react";
import { WhiteHoleSim, type SimParams, type SimStats } from "./sim/WhiteHoleSim";

const DEFAULTS: SimParams = {
  white: true,
  flowSpeed: 1,
  spin: 1,
  bloom: 1.25,
  lensing: 1,
  particleCount: 90000,
  jets: true,
  shockwaves: true,
  autoRotate: true,
  timeScale: 1,
};

interface Toast {
  id: number;
  msg: string;
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
  const [stats, setStats] = useState<SimStats>({ fps: 0, projectiles: 0, ejected: 0, absorbed: 0, distance: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    if (!mountRef.current) return;
    let sim: WhiteHoleSim;
    try {
      sim = new WhiteHoleSim(
        mountRef.current,
        DEFAULTS,
        (s) => setStats(s),
        (msg) => {
          const id = ++toastId.current;
          setToasts((t) => [...t.slice(-3), { id, msg }]);
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
        }
      );
    } catch (e) {
      setError("WebGL başlatılamadı. Lütfen WebGL destekleyen bir tarayıcı kullanın.");
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
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        simRef.current?.throwMatter();
      } else if (e.key === "b" || e.key === "B") simRef.current?.triggerBurst();
      else if (e.key === "t" || e.key === "T") setParams((p) => ({ ...p, white: !p.white }));
      else if (e.key === "h" || e.key === "H") setPanelOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof SimParams>(k: K, v: SimParams[K]) => setParams((p) => ({ ...p, [k]: v }));
  const white = params.white;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none font-sans">
      <div ref={mountRef} className="absolute inset-0" />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-8 text-slate-300">{error}</div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 pointer-events-none flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] uppercase text-sky-300/80">3D Uzay-Zaman Simülasyonu</div>
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight mt-1">
            {white ? (
              <>
                Beyaz <span className="font-semibold bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">Delik</span>
              </>
            ) : (
              <>
                Kara <span className="font-semibold bg-gradient-to-r from-orange-300 to-red-500 bg-clip-text text-transparent">Delik</span>
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md">
            {white
              ? "Hiçbir şeyin giremediği, yalnızca madde ve ışık fışkırtan uzay-zaman bölgesi."
              : "Hiçbir şeyin kaçamadığı, maddeyi yutan uzay-zaman bölgesi — beyaz deliğin zaman-tersi."}
          </p>
        </div>
        <div className="hidden sm:grid grid-cols-2 gap-x-5 gap-y-1 text-[11px] font-mono text-slate-400 bg-black/30 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 pointer-events-auto">
          <span>FPS</span>
          <span className="text-right text-slate-100">{stats.fps}</span>
          <span>Kamera uzaklığı</span>
          <span className="text-right text-slate-100">{stats.distance.toFixed(1)} Rₛ</span>
          <span>Aktif asteroit</span>
          <span className="text-right text-slate-100">{stats.projectiles}</span>
          <span>Geri fırlatılan</span>
          <span className="text-right text-sky-200">{stats.ejected}</span>
          <span>Yutulan</span>
          <span className="text-right text-orange-300">{stats.absorbed}</span>
        </div>
      </div>

      {/* Toasts */}
      <div className="absolute top-36 sm:top-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none w-[90%] max-w-md">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-sm text-slate-100 shadow-lg animate-[fadein_0.3s_ease]"
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 px-2">
        <button
          onClick={() => simRef.current?.throwMatter()}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-sm transition"
        >
          ☄️ Asteroit Fırlat <kbd className="ml-1 text-[10px] text-slate-400">Boşluk</kbd>
        </button>
        <button
          onClick={() => simRef.current?.triggerBurst()}
          disabled={!white}
          className="px-4 py-2.5 rounded-xl bg-sky-300/20 hover:bg-sky-300/30 disabled:opacity-40 border border-sky-200/30 backdrop-blur-md text-sm transition"
        >
          💥 Patlama <kbd className="ml-1 text-[10px] text-slate-400">B</kbd>
        </button>
        <button
          onClick={() => set("white", !white)}
          className={`px-4 py-2.5 rounded-xl border backdrop-blur-md text-sm transition ${
            white
              ? "bg-orange-500/20 hover:bg-orange-500/30 border-orange-300/30"
              : "bg-white/20 hover:bg-white/30 border-white/30"
          }`}
        >
          {white ? "⏩ Zamanı İleri Al (Kara Delik)" : "⏪ Zamanı Geri Çevir (Beyaz Delik)"}
          <kbd className="ml-1 text-[10px] text-slate-400">T</kbd>
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-sm transition"
        >
          ℹ️ Beyaz Delik Nedir?
        </button>
      </div>

      {/* Control panel */}
      <div
        className={`absolute right-3 sm:right-6 top-40 sm:top-44 w-[260px] transition-all duration-300 ${
          panelOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-3 shadow-2xl max-h-[calc(100vh-17rem)] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide">Kontroller</h2>
            <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-white text-lg leading-none">
              ×
            </button>
          </div>
          <Slider label="Fışkırma hızı" value={params.flowSpeed} min={0} max={3} step={0.05} onChange={(v) => set("flowSpeed", v)} />
          <Slider label="Dönüş (spin)" value={params.spin} min={0} max={3} step={0.05} onChange={(v) => set("spin", v)} />
          <Slider label="Zaman akışı" value={params.timeScale} min={0} max={2} step={0.05} onChange={(v) => set("timeScale", v)} fmt={(v) => `${v.toFixed(2)}×`} />
          <Slider label="Parlaklık (bloom)" value={params.bloom} min={0} max={3} step={0.05} onChange={(v) => set("bloom", v)} />
          <Slider label="Kütleçekimsel mercek" value={params.lensing} min={0} max={2.5} step={0.05} onChange={(v) => set("lensing", v)} />
          <Slider
            label="Parçacık sayısı"
            value={params.particleCount}
            min={10000}
            max={160000}
            step={5000}
            onChange={(v) => set("particleCount", v)}
            fmt={(v) => `${Math.round(v / 1000)}K`}
          />
          <div className="border-t border-white/10 pt-2">
            <Toggle label="Kutup jetleri" value={params.jets} onChange={(v) => set("jets", v)} />
            <Toggle label="Şok dalgaları" value={params.shockwaves} onChange={(v) => set("shockwaves", v)} />
            <Toggle label="Otomatik dönüş" value={params.autoRotate} onChange={(v) => set("autoRotate", v)} />
          </div>
          <div className="border-t border-white/10 pt-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Kamera</div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button onClick={() => simRef.current?.setCameraPreset("top")} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">Üstten</button>
              <button onClick={() => simRef.current?.setCameraPreset("side")} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">Yandan</button>
              <button onClick={() => simRef.current?.setCameraPreset("close")} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">Yakın</button>
              <button onClick={() => simRef.current?.resetCamera()} className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10">Sıfırla</button>
            </div>
          </div>
          <button
            onClick={() => setParams({ ...DEFAULTS, white: params.white })}
            className="w-full text-xs py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            Varsayılanlara dön
          </button>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Fare: sürükle = döndür · tekerlek = yakınlaş · sağ tık = kaydır. <br />H tuşu paneli gizler.
          </p>
        </div>
      </div>
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute right-3 sm:right-6 top-40 sm:top-44 px-3 py-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-sm hover:bg-white/10"
        >
          ⚙️ Kontroller
        </button>
      )}

      {/* Info modal */}
      {infoOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-20" onClick={() => setInfoOpen(false)}>
          <div
            className="max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-slate-950/90 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-semibold">Beyaz Delik Nedir?</h2>
              <button onClick={() => setInfoOpen(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="mt-4 space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                <b className="text-white">Beyaz delik</b>, Einstein'ın genel görelilik denklemlerinin matematiksel olarak izin verdiği varsayımsal bir
                uzay-zaman bölgesidir. Bir <b className="text-orange-300">kara deliğin zamanda tersine çevrilmiş</b> hâlidir: kara deliğe hiçbir şey kaçamazken,
                beyaz deliğe <b className="text-white">hiçbir şey giremez</b>; yalnızca madde ve ışık dışarı fışkırır.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-white font-medium mb-1">⚪ Beyaz Delik</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Geçmiş olay ufku</li>
                    <li>Madde dışarı akar</li>
                    <li>Dışarıdan girilemez</li>
                    <li>Aşırı parlak, mavi-beyaz</li>
                  </ul>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-orange-300 font-medium mb-1">⚫ Kara Delik</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Gelecek olay ufku</li>
                    <li>Madde içeri düşer</li>
                    <li>İçeriden çıkılamaz</li>
                    <li>Karanlık gölge + foton halkası</li>
                  </ul>
                </div>
              </div>
              <p>
                <b className="text-white">İlginç bir detay:</b> Beyaz deliğin dışındaki kütleçekimi bir kara deliğinkiyle aynıdır — yani çekicidir!
                Bir asteroit ona doğru hızlanarak düşer, ancak olay ufkuna asla ulaşamaz. Dışarı akan madde ve aşırı maviye kaymış ışınım onu ısıtır
                ve geri iter. Simülasyonda "Asteroit Fırlat" ile bunu deneyebilirsiniz.
              </p>
              <p>
                <b className="text-white">Simülasyonda gördükleriniz:</b> parlayan merkez (geçmiş olay ufku), dışarı doğru sarmal çizerek soğuyan ve
                renk değiştiren madde diski (mavi-beyaz → sarı → kırmızı), kutuplardan fışkıran jetler, periyodik şok dalgaları ve arka plandaki
                yıldızları büken <b className="text-white">kütleçekimsel merceklenme</b>.
              </p>
              <p className="text-slate-500 text-xs">
                Not: Beyaz deliklerin varlığı hiçbir zaman gözlemlenmemiştir. Bazı teoriler, Büyük Patlama'nın ya da kara deliklerin "son hâlinin"
                beyaz delik olabileceğini öne sürer. Bu simülasyon bilimsel fikirlerden ilham alan görsel bir yorumdur.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
