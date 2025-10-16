"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SliderControl } from "@/components/visualizations/SliderControl";
import { computeTriadSurface, ratioToNoteName, spectrumFromHarmonics } from "@/lib/dissonance/math";
import { useReferenceTonePlayer } from "@/lib/dissonance/useReferenceTonePlayer";

type SurfaceData = ReturnType<typeof computeTriadSurface>;

type TriadMinimum = {
  ratioX: number;
  ratioY: number;
  value: number;
};

type TriadSelection = {
  id: string;
  title: string;
  subtitle: string;
  ratios: readonly [number, number];
  roughness: number;
  badge?: string;
};

type PlotlyModule = {
  react: (
    element: HTMLElement | null,
    data: unknown[],
    layout?: unknown,
    config?: unknown
  ) => Promise<unknown> | unknown;
  purge: (element: HTMLElement | null) => void;
  restyle: (
    element: HTMLElement | null,
    update: unknown,
    traces?: number[]
  ) => Promise<unknown> | unknown;
};

type PlotlyHTMLElement = HTMLElement & {
  on: (event: string, handler: (event: unknown) => void) => void;
  removeAllListeners?: (event?: string) => void;
};

const TRIAD_TONE_COLORS = ["#38bdf8", "#fb923c", "#c084fc"] as const;

function ratioMatches(target: readonly [number, number], current: readonly [number, number], epsilon = 1e-3) {
  return Math.abs(target[0] - current[0]) < epsilon && Math.abs(target[1] - current[1]) < epsilon;
}

function findNearestIndex(values: number[], target: number) {
  let idx = 0;
  let minDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < values.length; i++) {
    const diff = Math.abs(values[i] - target);
    if (diff < minDiff) {
      minDiff = diff;
      idx = i;
    }
  }
  return idx;
}

function sampleSurface(surface: SurfaceData, ratioA: number, ratioB: number) {
  const ri = findNearestIndex(surface.ratios, ratioA);
  const rj = findNearestIndex(surface.ratios, ratioB);
  return surface.values[ri]?.[rj] ?? 0;
}

function extractConsonantMinima(surface: SurfaceData, threshold: number, limit: number): TriadMinimum[] {
  const minima: TriadMinimum[] = [];
  const rows = surface.values.length;
  const cols = surface.values[0]?.length ?? 0;

  for (let i = 1; i < rows - 1; i++) {
    for (let j = 1; j < cols - 1; j++) {
      const current = surface.values[i][j];
      if (current > threshold) continue;

      let isMinimum = true;
      for (let di = -1; di <= 1 && isMinimum; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;
          if (surface.values[i + di][j + dj] < current) {
            isMinimum = false;
            break;
          }
        }
      }

      if (isMinimum) {
        minima.push({
          ratioX: surface.ratios[i],
          ratioY: surface.ratios[j],
          value: current,
        });
      }
    }
  }

  return minima
    .sort((a, b) => a.value - b.value)
    .slice(0, limit);
}

export default function TriadExplorerPage() {
  const CHANNEL = "dissonance-audio";
  const SOURCE = "triad-explorer";
  const UI_REVISION = "triad-explorer-surface";

  const [f0, setF0] = useState(220);
  const [partials, setPartials] = useState(4);
  const [rolloff, setRolloff] = useState(1.0);
  const [ratioA, setRatioA] = useState(5 / 4);
  const [ratioB, setRatioB] = useState(3 / 2);
  const [gridStep, setGridStep] = useState(0.02);
  const [minimaThreshold, setMinimaThreshold] = useState(0.45);
  const [showExampleGuides, setShowExampleGuides] = useState(false);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const plotlyInstanceRef = useRef<PlotlyModule | null>(null);
  const latestRatiosRef = useRef({ ratioA, ratioB });
  type CameraState = {
    eye: { x: number; y: number; z: number };
    center?: { x: number; y: number; z: number };
    up?: { x: number; y: number; z: number };
  };

  const cameraStateRef = useRef<CameraState | null>(null);
  const playTriadRef = useRef<((r: number, s: number) => void) | null>(null);
  const { playChord, stopAll } = useReferenceTonePlayer();

  const partialMultipliers = useMemo(
    () => Array.from({ length: partials }, (_, i) => i + 1),
    [partials]
  );

  const partialAmplitudes = useMemo(
    () => partialMultipliers.map((k) => Math.pow(k, -rolloff)),
    [partialMultipliers, rolloff]
  );

  const exampleTriads = useMemo(
    () => [
      { id: "a-major", label: "A major (just)", ratios: [5 / 4, 3 / 2] as const },
      { id: "a-minor", label: "A minor (just)", ratios: [6 / 5, 3 / 2] as const },
      { id: "a-sus4", label: "A sus4", ratios: [4 / 3, 3 / 2] as const },
    ],
    []
  );

  const spectrum = useMemo(
    () => spectrumFromHarmonics(f0, partials, rolloff),
    [f0, partials, rolloff]
  );

  const surface = useMemo(
    () =>
      computeTriadSurface({
        baseFreq: f0,
        spectrum,
        step: gridStep,
      }),
    [f0, gridStep, spectrum]
  );

  const minima = useMemo(
    () => extractConsonantMinima(surface, minimaThreshold, 8),
    [surface, minimaThreshold]
  );

  const lastPlayedRef = useRef<{r: number, s: number, time: number} | null>(null);
  
  const playTriad = useCallback(
    (r: number, s: number) => {
      if (!partialMultipliers.length) return;
      
      // Check if we just played this exact same triad to prevent duplicates
      const now = Date.now();
      if (lastPlayedRef.current && 
          Math.abs(lastPlayedRef.current.r - r) < 0.001 && 
          Math.abs(lastPlayedRef.current.s - s) < 0.001 && 
          now - lastPlayedRef.current.time < 200) { // 200ms window to prevent duplicates
        return;
      }
      
      // Record this play action
      lastPlayedRef.current = { r, s, time: now };
      
      void playChord({
        baseFrequency: f0,
        partialMultipliers,
        partialAmplitudes,
        tuning: [1, r, s],
        channel: CHANNEL,
        source: SOURCE,
      });
    },
    [partialAmplitudes, partialMultipliers, playChord, f0]
  );

  // Keep the playTriad function ref updated
  useEffect(() => {
    playTriadRef.current = playTriad;
  }, [playTriad]);

  const exampleTriadSummaries = useMemo(
    () =>
      exampleTriads.map((triad) => {
        const [r, s] = triad.ratios;
        return {
          ...triad,
          notes: [ratioToNoteName(1, f0), ratioToNoteName(r, f0), ratioToNoteName(s, f0)],
          roughness: sampleSurface(surface, r, s),
        };
      }),
    [exampleTriads, f0, surface]
  );

  const minimaSummaries = useMemo<TriadSelection[]>(
    () =>
      minima.map((minimum, index) => {
        const ratios: readonly [number, number] = [minimum.ratioX, minimum.ratioY];
        const notes = [
          ratioToNoteName(1, f0),
          ratioToNoteName(minimum.ratioX, f0),
          ratioToNoteName(minimum.ratioY, f0),
        ].join(" – ");
        return {
          id: `min-${index}-${minimum.ratioX.toFixed(4)}-${minimum.ratioY.toFixed(4)}`,
          title: notes,
          subtitle: "Local minimum (lower = smoother)",
          ratios,
          roughness: minimum.value,
          badge: "Minima",
        };
      }),
    [f0, minima]
  );

  const selectedValue = useMemo(
    () => sampleSurface(surface, ratioA, ratioB),
    [surface, ratioA, ratioB]
  );

  const selectedNotes = useMemo(
    () => [ratioToNoteName(1, f0), ratioToNoteName(ratioA, f0), ratioToNoteName(ratioB, f0)],
    [f0, ratioA, ratioB]
  );

  useEffect(() => {
    latestRatiosRef.current = { ratioA, ratioB };
  }, [ratioA, ratioB]);

  useEffect(() => {
    let isMounted = true;
    let plotlyModule: PlotlyModule | null = null;
    const container = surfaceRef.current;

    const drawSurface = async () => {
      const plotlyImport = await import("plotly.js-dist-min");
      const Plotly = (plotlyImport.default || plotlyImport) as PlotlyModule;
      if (!container || !isMounted) return;

      const surfaceTrace = {
        type: "surface" as const,
        x: surface.ratios,
        y: surface.ratios,
        z: surface.values,
        colorscale: "Viridis",
        showscale: true,
        opacity: 0.96,
      };

      const markerTrace = {
        type: "scatter3d" as const,
        mode: "markers",
        x: [ratioA],
        y: [ratioB],
        z: [selectedValue],
        marker: {
          color: "#f97316",
          size: 6,
          symbol: "circle",
        },
        name: "Selected chord",
      };

      const minimaTrace = {
        type: "scatter3d" as const,
        mode: "markers",
        x: minima.map((m) => m.ratioX),
        y: minima.map((m) => m.ratioY),
        z: minima.map((m) => m.value),
        marker: {
          color: "#22c55e",
          size: 4,
          symbol: "diamond",
        },
        name: "Consonant minima",
      };

      const guideTrace = showExampleGuides
        ? {
            type: "scatter3d" as const,
            mode: "markers+text",
            x: exampleTriadSummaries.map((triad) => triad.ratios[0]),
            y: exampleTriadSummaries.map((triad) => triad.ratios[1]),
            z: exampleTriadSummaries.map((triad) => triad.roughness),
            marker: {
              color: "#facc15",
              size: 6,
              symbol: "x",
            },
            text: exampleTriadSummaries.map((triad) => triad.label.replace(/ \(.*\)$/u, "")),
            textposition: "top center" as const,
            name: "A=220 triad guides",
            hovertemplate: "r=%{x:.3f}<br>s=%{y:.3f}<br>D=%{z:.3f}<extra></extra>",
          }
        : null;

    const sceneConfig: Record<string, unknown> = {
        xaxis: { title: "Ratio r (1 → 2)", gridcolor: "#1f2937", zerolinecolor: "#1f2937" },
        yaxis: { title: "Ratio s (1 → 2)", gridcolor: "#1f2937", zerolinecolor: "#1f2937" },
        zaxis: { title: "Relative dissonance index", gridcolor: "#1f2937" },
        bgcolor: "rgba(15,23,42,0.85)",
        hovermode: "closest",
      };

      // Preserve the camera position if it's stored in our ref, otherwise use default
      if (cameraStateRef.current) {
        sceneConfig.camera = cameraStateRef.current;
      } else {
        sceneConfig.camera = { eye: { x: 1.4, y: 1.3, z: 0.8 } };
      }

      const layout = {
        margin: { t: 0, r: 0, b: 0, l: 0 },
        scene: sceneConfig,
        paper_bgcolor: "rgba(15,23,42,0)",
        plot_bgcolor: "rgba(15,23,42,0)",
        showlegend: true,
        legend: {
          x: 0.05,
          y: 0.95,
          font: { color: "#e2e8f0" },
          bgcolor: "rgba(15,23,42,0.75)",
        },
        uirevision: UI_REVISION,
      };

      const traces = [surfaceTrace, markerTrace, minimaTrace];
      if (guideTrace) traces.push(guideTrace);

      await Plotly.react(
        container,
        traces,
        layout,
        { responsive: true, displaylogo: false }
      );

      plotlyModule = Plotly;
      plotlyInstanceRef.current = Plotly;

      // Save current camera state after render
      setTimeout(() => {
        if (container && plotlyModule && isMounted) {
          try {
            // Get current camera state
            const plotlyContainer = container as HTMLElement & { _fullLayout?: { scene?: { camera?: CameraState } } };
            const currentLayout = plotlyContainer._fullLayout;
            if (currentLayout?.scene?.camera) {
              cameraStateRef.current = currentLayout.scene.camera;
            }
          } catch {
            // Ignore errors getting camera state
          }
        }
      }, 0);

      const plotElement = container as unknown as PlotlyHTMLElement;
      type PlotlyClickPoint = {
        x: number;
        y: number;
        fullData?: { name?: string };
      };
      type PlotlyClickEvent = {
        points?: PlotlyClickPoint[];
        event?: { isTrusted?: boolean };
      };

      const handleClick = (event: unknown) => {
        const plotlyEvent = event as PlotlyClickEvent | undefined;
        const points = plotlyEvent?.points;
        const domEvent = plotlyEvent?.event;
        if (!points || points.length === 0) return;

        // Plotly can emit a second synthetic click when traces are restyled.
        // Skip those by requiring a trusted DOM event and ignoring the "Selected chord" trace.
        if (domEvent && domEvent.isTrusted === false) return;

        const clickPoint =
          points.find((point) => point.fullData?.name !== "Selected chord") ?? points[0];
        const { x, y } = clickPoint;
        setRatioA(x);
        setRatioB(y);
        playTriadRef.current?.(x, y);
      };

      type PlotlyHoverEvent = {
        points?: PlotlyClickPoint[];
      };

      const handleHover = (event: unknown) => {
        const plotlyEvent = event as PlotlyHoverEvent | undefined;
        const points = plotlyEvent?.points;
        if (!points || points.length === 0) return;

        const hoverPoint =
          points.find((point) => point.fullData?.name !== "Selected chord") ?? points[0];

        const x = hoverPoint?.x;
        const y = hoverPoint?.y;
        if (typeof x !== "number" || typeof y !== "number") return;

        const { ratioA: currentRatioA, ratioB: currentRatioB } = latestRatiosRef.current;
        if (Math.abs(x - currentRatioA) < 1e-4 && Math.abs(y - currentRatioB) < 1e-4) {
          return;
        }

        setRatioA(x);
        setRatioB(y);
      };

      plotElement.removeAllListeners?.("plotly_click");
      plotElement.on("plotly_click", handleClick);

      plotElement.removeAllListeners?.("plotly_hover");
      plotElement.on("plotly_hover", handleHover);
    };

    drawSurface().catch(() => {
      // Ignore failures in environments without WebGL
    });

    return () => {
      isMounted = false;
      if (container && plotlyModule) {
        plotlyModule.purge(container);
      }
    };
  }, [surface, minima, showExampleGuides, exampleTriadSummaries, playTriad]);

  // Effect for marker updates (when only the selected point changes)
  useEffect(() => {
    // Only run this effect after the initial render and when marker data changes
    if (!plotlyInstanceRef.current || !surfaceRef.current) return;

    const updateMarker = async () => {
      const Plotly = plotlyInstanceRef.current;
      const container = surfaceRef.current;
      if (!Plotly || !container) return;

      // Update only the marker trace (index 1 in the traces array - the selected chord trace)
      await Plotly.restyle(
        container,
        {
          x: [[ratioA]],
          y: [[ratioB]],
          z: [[selectedValue]]
        },
        [1] // Update only the second trace (marker trace at index 1)
      );
    };

    updateMarker();
  }, [ratioA, ratioB, selectedValue, plotlyInstanceRef, surfaceRef]); // Only run when marker position/value changes

  const playChordPreview = useCallback(() => {
    playTriad(ratioA, ratioB);
  }, [playTriad, ratioA, ratioB]);

  const handleExampleSelect = useCallback(
    (r: number, s: number) => {
      setRatioA(r);
      setRatioB(s);
      playTriad(r, s);
    },
    [playTriad]
  );

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (event) => {
        if (event?.data?.type === "stop-others" && event?.data?.src !== SOURCE) {
          stopAll();
        }
      };
    } catch {}

    return () => {
      stopAll();
      try { bc?.close(); } catch {}
    };
  }, [stopAll]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Triad Explorer</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-80 w-full flex-shrink-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg space-y-4 h-full">
            <h2 className="text-lg font-semibold text-white mb-2">Parameters</h2>

            <div className="space-y-5">
              <SliderControl
                label="Base f0 (Hz)"
                value={f0}
                displayValue={`${f0}`}
                min={50}
                max={1000}
                step={1}
                onChange={setF0}
                accent="orange"
              />
              <SliderControl
                label="Partials"
                value={partials}
                displayValue={`${partials}`}
                min={1}
                max={6}
                step={1}
                onChange={(value) => setPartials(Math.round(value))}
                accent="orange"
              />
              <SliderControl
                label="Rolloff"
                value={rolloff}
                displayValue={rolloff.toFixed(1)}
                min={0.5}
                max={2.5}
                step={0.1}
                onChange={setRolloff}
                accent="orange"
              />
              <SliderControl
                label="Ratio r"
                value={ratioA}
                displayValue={`${ratioA.toFixed(3)}×`}
                min={1}
                max={2}
                step={0.001}
                onChange={setRatioA}
                accent="orange"
              />
              <SliderControl
                label="Ratio s"
                value={ratioB}
                displayValue={`${ratioB.toFixed(3)}×`}
                min={1}
                max={2}
                step={0.001}
                onChange={setRatioB}
                accent="orange"
              />
              <SliderControl
                label="Grid step"
                value={gridStep}
                displayValue={gridStep.toFixed(3)}
                min={0.01}
                max={0.05}
                step={0.005}
                onChange={setGridStep}
                accent="orange"
              />
              <SliderControl
                label="Minima cutoff"
                value={minimaThreshold}
                displayValue={minimaThreshold.toFixed(2)}
                min={0.2}
                max={0.8}
                step={0.01}
                onChange={setMinimaThreshold}
                accent="orange"
              />

              <button
                className="w-full py-2 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                onClick={() => { playChordPreview(); }}
              >
                ▶ Play chord
              </button>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Chord (root × ratios)</span>
                <span className="font-mono text-gray-100 text-right">
                  {selectedNotes.join(" – ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Ratios</span>
                <span className="font-mono text-gray-100">{`${ratioA.toFixed(3)}×, ${ratioB.toFixed(3)}×`}</span>
              </div>
              <div className="flex justify-between">
                <span>Roughness</span>
                <span className="font-mono text-orange-300">{selectedValue.toFixed(3)}</span>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-example-guides"
                  checked={showExampleGuides}
                  onChange={(event) => setShowExampleGuides(event.target.checked)}
                  className="w-4 h-4 text-orange-500 bg-slate-800 border-slate-700 rounded focus:ring-orange-500 focus:ring-2"
                />
                <label htmlFor="show-example-guides" className="text-xs text-gray-400">Show A=220 triad guides</label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-white">Waveform breakdown</h2>
            <TriadWaveformBreakdown f0={f0} ratioA={ratioA} ratioB={ratioB} partials={partials} rolloff={rolloff} />
          </div>

          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg">
            <div className="h-[420px]" ref={surfaceRef} />
          </div>

          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Example triads (root = {f0} Hz)</h2>
              <span className="text-xs uppercase tracking-widest text-white/60">Presets</span>
            </div>
            <p className="text-sm text-gray-400">
              These presets use the same A≈220 Hz reference as the default study tone. Select one to focus the marker and audition the chord without resetting the camera.
            </p>
            <div className="space-y-3">
              {exampleTriadSummaries.map((triad) => {
                const selection: TriadSelection = {
                  id: `preset-${triad.id}`,
                  title: triad.label,
                  subtitle: triad.notes.join(" – "),
                  ratios: triad.ratios,
                  roughness: triad.roughness,
                  badge: "Preset",
                };
                return (
                  <TriadSelectionCard
                    key={selection.id}
                    selection={selection}
                    isActive={ratioMatches(selection.ratios, [ratioA, ratioB] as const)}
                    onSelect={() => handleExampleSelect(selection.ratios[0], selection.ratios[1])}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Consonant triads</h2>
              <span className="text-xs uppercase tracking-widest text-white/60">Local minima</span>
            </div>
            <p className="text-sm text-gray-400">
              These points sit at roughness minima across the surface. Select any card to jump the marker without losing your current camera angle.
            </p>
            <div className="space-y-3">
              {minimaSummaries.map((selection) => (
                <TriadSelectionCard
                  key={selection.id}
                  selection={selection}
                  isActive={ratioMatches(selection.ratios, [ratioA, ratioB] as const)}
                  onSelect={() => handleExampleSelect(selection.ratios[0], selection.ratios[1])}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type TriadSelectionCardProps = {
  selection: TriadSelection;
  isActive: boolean;
  onSelect: () => void;
};

function TriadSelectionCard({ selection, isActive, onSelect }: TriadSelectionCardProps) {
  const [r, s] = selection.ratios;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-all duration-200 hover:border-orange-400/70 hover:bg-orange-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/80 ${
        isActive ? "border-orange-400/70 bg-orange-500/10 shadow-[0_0_0_1px_rgba(251,146,60,0.4)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span
            className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-slate-900/60 text-xs font-semibold text-white transition group-hover:border-orange-400 group-hover:text-orange-200 ${
              isActive ? "border-orange-400 text-orange-200" : ""
            }`}
          >
            ▶
          </span>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{selection.title}</span>
              {selection.badge ? (
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/70">
                  {selection.badge}
                </span>
              ) : null}
            </div>
            <div className="text-xs text-gray-400">{selection.subtitle}</div>
            <div className="text-[11px] font-mono text-gray-500">{`r=${r.toFixed(3)}× · s=${s.toFixed(3)}×`}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <span className="font-mono text-emerald-300">{selection.roughness.toFixed(3)}</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">Roughness</span>
        </div>
      </div>
    </button>
  );
}

type TriadWaveformBreakdownProps = {
  f0: number;
  ratioA: number;
  ratioB: number;
  partials: number;
  rolloff: number;
};

function TriadWaveformBreakdown({ f0, ratioA, ratioB, partials, rolloff }: TriadWaveformBreakdownProps) {
  const toneColors = TRIAD_TONE_COLORS;
  const sampleCount = 360;
  const breakdown = useMemo(() => {
    const shortTimes = Array.from({ length: sampleCount }, (_, i) => (i / (sampleCount - 1)) * 2);
    const longSampleCount = 720;
    const longTimes = Array.from({ length: longSampleCount }, (_, i) => (i / (longSampleCount - 1)) * 20);

    const ratios = [1, ratioA, ratioB];
    const shortSums = ratios.map(() => Array(sampleCount).fill(0));
    const longSums = ratios.map(() => Array(longSampleCount).fill(0));
    const shortPartialValues = ratios.map(() => [] as number[][]);

    let maxAbs = 0;

    for (let k = 1; k <= partials; k++) {
      const amp = 1 / Math.pow(k, rolloff);

      ratios.forEach((ratio, toneIdx) => {
        const shortValues = shortTimes.map((t) => amp * Math.sin(2 * Math.PI * k * ratio * t));
        const longValues = longTimes.map((t) => amp * Math.sin(2 * Math.PI * k * ratio * t));
        shortPartialValues[toneIdx].push(shortValues);

        for (let i = 0; i < sampleCount; i++) {
          shortSums[toneIdx][i] += shortValues[i];
          maxAbs = Math.max(maxAbs, Math.abs(shortValues[i]));
        }

        for (let i = 0; i < longSampleCount; i++) {
          longSums[toneIdx][i] += longValues[i];
          maxAbs = Math.max(maxAbs, Math.abs(longValues[i]));
        }
      });
    }

    const combinedShort = shortSums[0].map((_, idx) => shortSums[0][idx] + shortSums[1][idx] + shortSums[2][idx]);
    const combinedLong = longSums[0].map((_, idx) => longSums[0][idx] + longSums[1][idx] + longSums[2][idx]);

    combinedShort.forEach((value) => {
      maxAbs = Math.max(maxAbs, Math.abs(value));
    });
    combinedLong.forEach((value) => {
      maxAbs = Math.max(maxAbs, Math.abs(value));
    });

    const normalizer = maxAbs > 0 ? maxAbs : 1;

    const shortDims = { width: 360, height: 140, padX: 22, padY: 24 };
    const longDims = { width: 360, height: 140, padX: 22, padY: 24 };
    const shortInnerWidth = shortDims.width - 2 * shortDims.padX;
    const longInnerWidth = longDims.width - 2 * longDims.padX;
    const shortMidY = shortDims.height / 2;
    const longMidY = longDims.height / 2;
    const shortScaleY = (shortDims.height - 2 * shortDims.padY) / 2;
    const longScaleY = (longDims.height - 2 * longDims.padY) / 2;

    const toShortPath = (values: number[]) =>
      values
        .map((val, idx) => {
          const x = shortDims.padX + (idx / (sampleCount - 1)) * shortInnerWidth;
          const y = shortMidY - (val / normalizer) * shortScaleY;
          return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");

    const toLongPath = (values: number[]) =>
      values
        .map((val, idx) => {
          const x = longDims.padX + (idx / (longSampleCount - 1)) * longInnerWidth;
          const y = longMidY - (val / normalizer) * longScaleY;
          return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");

    const toneShortSumPaths = shortSums.map(toShortPath);
    const toneLongSumPaths = longSums.map(toLongPath);
    const tonePartialPaths = shortPartialValues.map((partialsArray) => partialsArray.map(toShortPath));

    const combined = {
      sumPath: toShortPath(combinedShort),
      longSumPath: toLongPath(combinedLong),
      overlays: toneShortSumPaths.map((path, idx) => ({ path, color: toneColors[idx] })),
      longOverlays: toneLongSumPaths.map((path, idx) => ({ path, color: toneColors[idx] })),
    };

    const partialRows = Array.from({ length: partials }, (_, idx) => ({
      partialNumber: idx + 1,
      paths: tonePartialPaths.map((paths) => paths[idx] ?? ""),
    }));

    const shortTicks = [0, 0.5, 1, 1.5, 2].map((cycle) => shortDims.padX + (cycle / 2) * shortInnerWidth);
    const longTicks = [0, 5, 10, 15, 20].map((cycle) => longDims.padX + (cycle / 20) * longInnerWidth);

    return {
      shortDims,
      longDims,
      shortTicks,
      longTicks,
      toneShortSumPaths,
      toneLongSumPaths,
      tonePartialPaths,
      combined,
      partialRows,
    };
  }, [partials, ratioA, ratioB, rolloff, toneColors]);

  const toneSummaries = [
    {
      title: "Root tone (2 periods)",
      subtitle: `${f0.toFixed(1)} Hz`,
      color: toneColors[0],
      shortPath: breakdown.toneShortSumPaths[0],
      longPath: breakdown.toneLongSumPaths[0],
      partialPaths: breakdown.tonePartialPaths[0],
    },
    {
      title: "Ratio r tone (2 periods)",
      subtitle: `${(f0 * ratioA).toFixed(1)} Hz`,
      color: toneColors[1],
      shortPath: breakdown.toneShortSumPaths[1],
      longPath: breakdown.toneLongSumPaths[1],
      partialPaths: breakdown.tonePartialPaths[1],
    },
    {
      title: "Ratio s tone (2 periods)",
      subtitle: `${(f0 * ratioB).toFixed(1)} Hz`,
      color: toneColors[2],
      shortPath: breakdown.toneShortSumPaths[2],
      longPath: breakdown.toneLongSumPaths[2],
      partialPaths: breakdown.tonePartialPaths[2],
    },
  ];

  return (
    <div className="space-y-6">
      {partials > 1 && (
        <div className="space-y-4">
          <div className="text-sm text-gray-300 font-medium">Partial waveforms comparison</div>
          {breakdown.partialRows.map((row) => (
            <div key={`triad-partial-${row.partialNumber}`} className="grid gap-4 md:grid-cols-3">
              <WavePanel
                title={`Partial ${row.partialNumber}`}
                subtitle={`Root tone, ${f0.toFixed(1)} Hz × ${row.partialNumber}`}
                partialPaths={[]}
                partialColor={toneColors[0]}
                sumPath={row.paths[0]}
                sumColor={toneColors[0]}
                ticks={breakdown.shortTicks}
                dims={breakdown.shortDims}
              />
              <WavePanel
                title={`Partial ${row.partialNumber}`}
                subtitle={`Ratio r, ${(f0 * ratioA).toFixed(1)} Hz × ${row.partialNumber}`}
                partialPaths={[]}
                partialColor={toneColors[1]}
                sumPath={row.paths[1]}
                sumColor={toneColors[1]}
                ticks={breakdown.shortTicks}
                dims={breakdown.shortDims}
              />
              <WavePanel
                title={`Partial ${row.partialNumber}`}
                subtitle={`Ratio s, ${(f0 * ratioB).toFixed(1)} Hz × ${row.partialNumber}`}
                partialPaths={[]}
                partialColor={toneColors[2]}
                sumPath={row.paths[2]}
                sumColor={toneColors[2]}
                ticks={breakdown.shortTicks}
                dims={breakdown.shortDims}
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {toneSummaries.map((tone, idx) => (
          <WavePanel
            key={`tone-short-${idx}`}
            title={tone.title}
            subtitle={tone.subtitle}
            partialPaths={tone.partialPaths}
            partialColor={tone.color}
            sumPath={tone.shortPath}
            sumColor={tone.color}
            ticks={breakdown.shortTicks}
            dims={breakdown.shortDims}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {toneSummaries.map((tone, idx) => (
          <WavePanel
            key={`tone-long-${idx}`}
            title="Long-term (20 periods)"
            subtitle={tone.subtitle}
            partialPaths={[]}
            partialColor={tone.color}
            sumPath={tone.longPath}
            sumColor={tone.color}
            ticks={breakdown.longTicks}
            dims={breakdown.longDims}
          />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-sm text-gray-300 font-medium mb-2">Triad waveform (2 periods)</div>
          <WavePanel
            title=""
            subtitle="Combined tone"
            partialPaths={[]}
            partialColor="#94a3b8"
            sumPath={breakdown.combined.sumPath}
            sumColor="#f8fafc"
            ticks={breakdown.shortTicks}
            dims={breakdown.shortDims}
            overlays={breakdown.combined.overlays}
            showThickOverlays
          />
        </div>
        <div>
          <div className="text-sm text-gray-300 font-medium mb-2">Triad waveform (20 periods)</div>
          <WavePanel
            title=""
            subtitle="Envelope over 20 periods"
            partialPaths={[]}
            partialColor="#94a3b8"
            sumPath={breakdown.combined.longSumPath}
            sumColor="#f8fafc"
            ticks={breakdown.longTicks}
            dims={breakdown.longDims}
            overlays={breakdown.combined.longOverlays}
            showThickOverlays
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-6 rounded-full" style={{ backgroundColor: toneColors[0] }} />
          Root tone layers
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-6 rounded-full" style={{ backgroundColor: toneColors[1] }} />
          Ratio r layers
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-6 rounded-full" style={{ backgroundColor: toneColors[2] }} />
          Ratio s layers
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-6 rounded-full bg-slate-100" />
          Combined waveform
        </span>
      </div>
    </div>
  );
}

type WavePanelProps = {
  title: string;
  subtitle: string;
  partialPaths: string[];
  partialColor: string;
  sumPath: string;
  sumColor: string;
  ticks: number[];
  dims: { width: number; height: number; padX: number; padY: number };
  overlays?: { path: string; color: string }[];
  showThickOverlays?: boolean;
};

function WavePanel({ title, subtitle, partialPaths, partialColor, sumPath, sumColor, ticks, dims, overlays, showThickOverlays }: WavePanelProps) {
  const heightClass = "h-[140px]";
  return (
    <div className="space-y-2 text-xs text-gray-300">
      {(title || subtitle) && (
        <div>
          {title && <div className="font-semibold text-gray-100">{title}</div>}
          {subtitle && <div className="text-gray-500">{subtitle}</div>}
        </div>
      )}
      <svg viewBox={`0 0 ${dims.width} ${dims.height}`} className={`w-full ${heightClass}`}>
        <rect x="0" y="0" width={dims.width} height={dims.height} rx="12" fill="#0f172a" opacity="0.85" />
        <line x1={dims.padX} y1={dims.height / 2} x2={dims.width - dims.padX} y2={dims.height / 2} stroke="#1f2937" strokeDasharray="4 6" />
        {ticks.map((tick, idx) => (
          <line key={`tick-${idx}`} x1={tick} y1={dims.padY} x2={tick} y2={dims.height - dims.padY} stroke="#1f2937" strokeDasharray="4 6" />
        ))}

        {partialPaths.map((path, idx) => (
          <path key={`partial-${idx}`} d={path} fill="none" stroke={partialColor} strokeWidth={0.75} opacity={0.4} />
        ))}

        {overlays?.map((overlay, idx) => (
          <path
            key={`overlay-${idx}`}
            d={overlay.path}
            fill="none"
            stroke={overlay.color}
            strokeWidth={showThickOverlays ? 2.5 : 1.25}
            opacity={showThickOverlays ? 0.85 : 0.5}
          />
        ))}

        <path d={sumPath} fill="none" stroke={sumColor} strokeWidth={overlays && overlays.length > 0 ? 1.75 : 2.25} />
      </svg>
    </div>
  );
}
