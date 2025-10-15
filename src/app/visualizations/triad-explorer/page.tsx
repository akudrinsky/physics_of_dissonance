"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SliderControl } from "@/components/visualizations/SliderControl";
import { computeTriadSurface, midiToNoteName, ratioToMidi, spectrumFromHarmonics } from "@/lib/dissonance/math";
import { useReferenceTonePlayer } from "@/lib/dissonance/useReferenceTonePlayer";

type SurfaceData = ReturnType<typeof computeTriadSurface>;

type TriadMinimum = {
  ratioX: number;
  ratioY: number;
  value: number;
};

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

  const [f0, setF0] = useState(220);
  const [partials, setPartials] = useState(3);
  const [rolloff, setRolloff] = useState(1.0);
  const [ratioA, setRatioA] = useState(5 / 4);
  const [ratioB, setRatioB] = useState(3 / 2);
  const [gridStep, setGridStep] = useState(0.02);
  const [minimaThreshold, setMinimaThreshold] = useState(0.45);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const { playChord, stopAll } = useReferenceTonePlayer();

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

  const selectedValue = useMemo(
    () => sampleSurface(surface, ratioA, ratioB),
    [surface, ratioA, ratioB]
  );

  useEffect(() => {
    type PlotlyModule = {
      react: (element: HTMLElement | null, data: unknown[], layout?: unknown, config?: unknown) => Promise<unknown> | void;
      purge: (element: HTMLElement | null) => void;
    };

    let isMounted = true;
    let plotlyModule: PlotlyModule | null = null;
    const container = surfaceRef.current;

    const drawSurface = async () => {
      const plotlyImport = (await import("plotly.js-dist-min")) as unknown as PlotlyModule & { default?: PlotlyModule };
      const Plotly = plotlyImport.default ?? plotlyImport;
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

      const layout = {
        margin: { t: 0, r: 0, b: 0, l: 0 },
        scene: {
          xaxis: { title: "Ratio r (1 → 2)", gridcolor: "#1f2937", zerolinecolor: "#1f2937" },
          yaxis: { title: "Ratio s (1 → 2)", gridcolor: "#1f2937", zerolinecolor: "#1f2937" },
          zaxis: { title: "Normalized spectral dissonance", gridcolor: "#1f2937" },
          camera: {
            eye: { x: 1.4, y: 1.3, z: 0.8 },
          },
          bgcolor: "rgba(15,23,42,0.85)",
        },
        paper_bgcolor: "rgba(15,23,42,0)",
        plot_bgcolor: "rgba(15,23,42,0)",
        showlegend: true,
        legend: {
          x: 0.05,
          y: 0.95,
          font: { color: "#e2e8f0" },
          bgcolor: "rgba(15,23,42,0.75)",
        },
      };

      await Plotly.react(
        container,
        [surfaceTrace, markerTrace, minimaTrace],
        layout,
        { responsive: true, displaylogo: false }
      );

      plotlyModule = Plotly;
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
  }, [surface, ratioA, ratioB, selectedValue, minima]);

  const playChordPreview = useCallback(async () => {
    const partialMultipliers = Array.from({ length: partials }, (_, i) => i + 1);
    const partialAmplitudes = partialMultipliers.map((k) => Math.pow(k, -rolloff));
    if (!partialMultipliers.length) return;

    await playChord({
      baseFrequency: f0,
      partialMultipliers,
      partialAmplitudes,
      tuning: [1, ratioA, ratioB],
      channel: CHANNEL,
      source: SOURCE,
    });
  }, [partials, rolloff, playChord, f0, ratioA, ratioB]);

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

  const selectedMidi = {
    r: ratioToMidi(ratioA),
    s: ratioToMidi(ratioB),
  };

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
                onClick={() => { void playChordPreview(); }}
              >
                ▶ Play chord
              </button>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>r (closest note)</span>
                <span className="font-mono text-gray-100">
                  {midiToNoteName(selectedMidi.r)} ({selectedMidi.r.toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between">
                <span>s (closest note)</span>
                <span className="font-mono text-gray-100">
                  {midiToNoteName(selectedMidi.s)} ({selectedMidi.s.toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Roughness</span>
                <span className="font-mono text-orange-300">{selectedValue.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg">
            <div className="h-[420px]" ref={surfaceRef} />
          </div>

          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-white">Consonant triads</h2>
            <p className="text-sm text-gray-400">
              Local minima inside the surface (lower roughness indicates more consonant triads). Click a row to audition the chord.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Play</th>
                    <th className="py-2 pr-3 font-medium">Ratios (r, s)</th>
                    <th className="py-2 pr-3 font-medium">Notes</th>
                    <th className="py-2 pr-3 font-medium">Normalized roughness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {minima.map((minimum) => (
                    <tr key={`${minimum.ratioX}-${minimum.ratioY}`} className="text-gray-200">
                      <td className="py-2 pr-3">
                        <button
                          className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold hover:bg-slate-700 transition"
                          onClick={() =>
                            void playChord({
                              baseFrequency: f0,
                              partialMultipliers: Array.from({ length: partials }, (_, i) => i + 1),
                              partialAmplitudes: Array.from({ length: partials }, (_, i) => Math.pow(i + 1, -rolloff)),
                              tuning: [1, minimum.ratioX, minimum.ratioY],
                              channel: CHANNEL,
                              source: SOURCE,
                            })
                          }
                        >
                          ▶
                        </button>
                      </td>
                      <td className="py-2 pr-3 font-mono text-sm">
                        {minimum.ratioX.toFixed(3)}×, {minimum.ratioY.toFixed(3)}×
                      </td>
                      <td className="py-2 pr-3">
                        {[midiToNoteName(60), midiToNoteName(ratioToMidi(minimum.ratioX)), midiToNoteName(ratioToMidi(minimum.ratioY))].join(" — ")}
                      </td>
                      <td className="py-2 pr-3 font-mono text-sm text-emerald-300">
                        {minimum.value.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
