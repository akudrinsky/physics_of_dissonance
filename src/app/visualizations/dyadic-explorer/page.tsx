"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SliderControl } from "@/components/visualizations/SliderControl";
import type { MouseEvent as ReactMouseEvent } from "react";
import { dyadicDissonance, spectrumFromHarmonics } from "@/lib/dissonance/math";
import { useReferenceTonePlayer } from "@/lib/dissonance/useReferenceTonePlayer";

export default function DyadicExplorerPage() {
  const CHANNEL = "dissonance-audio";
  const SOURCE = "dyadic-explorer";
  const RATIO_MIN = 1;
  const RATIO_MAX = 2;
  const SVG_WIDTH = 720;
  const SVG_HEIGHT = 360;
  const MARGIN = { top: 36, right: 32, bottom: 52, left: 68 };
  const INNER_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right;
  const INNER_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

  const [f0, setF0] = useState(220);
  const [partials, setPartials] = useState(1);
  const [rolloff, setRolloff] = useState(1.0);
  const [selectedRatio, setSelectedRatio] = useState(1.0);
  const [showIntervalGuides, setShowIntervalGuides] = useState(false); // New state for toggle
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { playChord, stopAll } = useReferenceTonePlayer();

  // Define interval guides
  const intervalGuides = [
    { name: "Unison", ratio: 1, semitones: 0, text: "1:1", flavor: "consonant" as const },
    { name: "Major 2nd", ratio: 9 / 8, semitones: 2, text: "9:8", flavor: "rough" as const },
    { name: "Major 3rd", ratio: 5 / 4, semitones: 4, text: "5:4", flavor: "consonant" as const },
    { name: "Perfect 4th", ratio: 4 / 3, semitones: 5, text: "4:3", flavor: "consonant" as const },
    { name: "Tritone", ratio: Math.sqrt(2), semitones: 6, text: "√2", flavor: "rough" as const },
    { name: "Perfect 5th", ratio: 3 / 2, semitones: 7, text: "3:2", flavor: "consonant" as const },
    { name: "Major 6th", ratio: 5 / 3, semitones: 9, text: "5:3", flavor: "neutral" as const },
    { name: "Octave", ratio: 2, semitones: 12, text: "2:1", flavor: "consonant" as const },
  ];

  const samples = useMemo(() => {
    const spectrum = spectrumFromHarmonics(f0, partials, rolloff);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 240; i++) {
      const ratio = 1 + i * (1 / 240);
      xs.push(ratio);
      ys.push(dyadicDissonance(f0, ratio, spectrum));
    }
    const max = Math.max(...ys);
    const normYs = ys.map((y) => (max > 0 ? y / max : 0));
    // detect local minima and peaks
    const minima: { i: number; r: number; y: number }[] = [];
    const peaks: { i: number; r: number; y: number }[] = [];
    for (let i = 1; i < normYs.length - 1; i++) {
      const y0 = normYs[i - 1];
      const y1 = normYs[i];
      const y2 = normYs[i + 1];
      if (y1 < y0 && y1 < y2) minima.push({ i, r: xs[i], y: y1 });
      if (y1 > y0 && y1 > y2) peaks.push({ i, r: xs[i], y: y1 });
    }
    return { xs, ys: normYs, minima, peaks };
  }, [f0, partials, rolloff]);

  const stopAudio = useCallback(() => {
    stopAll();
  }, [stopAll]);

  const playAudio = useCallback(async (baseFreq: number, ratio: number) => {
    const partialMultipliers = Array.from({ length: partials }, (_, i) => i + 1);
    const partialAmplitudes = partialMultipliers.map((k) => Math.pow(k, -rolloff));
    if (!partialMultipliers.length) return;

    await playChord({
      baseFrequency: baseFreq,
      partialMultipliers,
      partialAmplitudes,
      tuning: [1, ratio],
      channel: CHANNEL,
      source: SOURCE,
    });
  }, [partials, rolloff, playChord]);



  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (ev) => {
        if (ev?.data?.type === "stop-others" && ev?.data?.src !== SOURCE) {
          stopAudio();
        }
      };
    } catch {}
    // No visibility state handling needed since we're not using continuous play
    return () => {
      stopAudio();
      try { bc?.close(); } catch {}
    };
  }, [stopAudio]);

  const handleMouseMove = useCallback((e: ReactMouseEvent<SVGSVGElement>) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    let svgX: number | null = null;
    try {
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svgEl.getScreenCTM();
      if (ctm) {
        try {
          const inv = ctm.inverse();
          const cursor = pt.matrixTransform(inv);
          svgX = cursor.x;
        } catch {
          svgX = null;
        }
      }
    } catch {
      svgX = null;
    }
    if (svgX === null) {
      const rect = svgEl.getBoundingClientRect();
      svgX = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
    }
    const x = Math.max(MARGIN.left, Math.min(SVG_WIDTH - MARGIN.right, svgX));
    const ratio = RATIO_MIN + ((x - MARGIN.left) / INNER_WIDTH) * (RATIO_MAX - RATIO_MIN);
    setSelectedRatio(ratio);
  }, [INNER_WIDTH, MARGIN.left, MARGIN.right, RATIO_MAX, RATIO_MIN]);

  const ratioToX = (ratio: number) => {
    const clamped = Math.max(RATIO_MIN, Math.min(RATIO_MAX, ratio));
    return MARGIN.left + ((clamped - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * INNER_WIDTH;
  };
  const valueToY = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    return MARGIN.top + (1 - clamped) * INNER_HEIGHT;
  };
  const baselineY = MARGIN.top + INNER_HEIGHT;

  let curvePath = "";
  let areaPath = "";
  if (samples.xs.length > 0) {
    curvePath = `M ${ratioToX(samples.xs[0])} ${valueToY(samples.ys[0])}`;
    for (let i = 1; i < samples.xs.length; i++) {
      curvePath += ` L ${ratioToX(samples.xs[i])} ${valueToY(samples.ys[i])}`;
    }
    const firstX = ratioToX(samples.xs[0]);
    const lastX = ratioToX(samples.xs[samples.xs.length - 1]);
    areaPath = `${curvePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }

  const clampedSelectedRatio = Math.max(RATIO_MIN, Math.min(RATIO_MAX, selectedRatio));
  const selectedNormalizedValue = (() => {
    if (!samples.xs.length) return 0;
    const position = (clampedSelectedRatio - RATIO_MIN) / (RATIO_MAX - RATIO_MIN);
    const approximateIndex = Math.round(position * (samples.xs.length - 1));
    const index = Math.max(0, Math.min(samples.ys.length - 1, approximateIndex));
    return samples.ys[index];
  })();
  const selectedX = ratioToX(clampedSelectedRatio);
  const selectedY = valueToY(selectedNormalizedValue);
  const flavorStyles = {
    consonant: { line: "#22c55e", text: "#bbf7d0" },
    rough: { line: "#ef4444", text: "#fecaca" },
    neutral: { line: "#fbbf24", text: "#fde68a" },
  } as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dyadic Explorer</h1>
      
      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sticky Controls Panel - Left Side */}
        <div className="lg:w-80 w-full flex-shrink-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 p-5 shadow-lg space-y-4 h-full">
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
              />

              <SliderControl
                label="Partials"
                value={partials}
                displayValue={`${partials}`}
                min={1}
                max={6}
                step={1}
                onChange={(value) => setPartials(Math.round(value))}
              />

              <SliderControl
                label="Rolloff"
                value={rolloff}
                displayValue={rolloff.toFixed(1)}
                min={0.5}
                max={2.5}
                step={0.1}
                onChange={setRolloff}
              />

              <SliderControl
                label="r (ratio)"
                value={selectedRatio}
                displayValue={`${selectedRatio.toFixed(3)}×`}
                min={1}
                max={2}
                step={0.001}
                onChange={setSelectedRatio}
              />
              
              <div className="pt-2 space-y-3">
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    id="show-interval-guides" 
                    checked={showIntervalGuides}
                    onChange={(e) => setShowIntervalGuides(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="show-interval-guides" className="ml-2 text-sm font-medium text-gray-300">Show interval guides</label>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg" 
                    onClick={() => { void playAudio(f0, selectedRatio); }}>
                    ▶ Play
                  </button>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-700">
              <h3 className="text-md font-semibold text-white mb-2">Selected Ratio</h3>
              <div className="text-2xl font-bold text-center py-3 bg-gray-800/50 rounded-lg text-blue-300">
                {selectedRatio.toFixed(3)}×
              </div>
              <div className="text-center text-sm text-gray-400 mt-2">
                Relative dissonance: {selectedNormalizedValue.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content - Right Side */}
        <div className="flex-1 space-y-6">
          {/* Waveform build-up section */}
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 p-5 shadow-lg">
            <WaveformBreakdown f0={f0} ratio={clampedSelectedRatio} partials={partials} rolloff={rolloff} />
          </div>
          
          {/* Visualization */}
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 p-5 shadow-lg">
            <svg ref={svgRef} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-[360px] cursor-crosshair"
              onMouseMove={handleMouseMove}
              onClick={() => { void playAudio(f0, selectedRatio); }}
            >
              <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="transparent" />
              <defs>
                <linearGradient id="dyad-background" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="dyad-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.05" />
                </linearGradient>
                <radialGradient id="dyad-minima-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </radialGradient>
                <clipPath id="dyad-clip">
                  <rect x={MARGIN.left} y={MARGIN.top} width={INNER_WIDTH} height={INNER_HEIGHT} />
                </clipPath>
              </defs>
              <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#dyad-background)" rx="16" />
              <g clipPath="url(#dyad-clip)">
                {areaPath && <path d={areaPath} fill="url(#dyad-area)" opacity="0.7" />}
                {curvePath && <path d={curvePath} fill="none" stroke="#93c5fd" strokeWidth="3" />}
              </g>
              {/* Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((value) => {
                const y = valueToY(value);
                return (
                  <g key={`grid-h-${value}`}>
                    <line x1={MARGIN.left} y1={y} x2={SVG_WIDTH - MARGIN.right} y2={y} stroke="#ffffff12" strokeDasharray="4 6" />
                    <text x={MARGIN.left - 12} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end">{value.toFixed(2)}</text>
                  </g>
                );
              })}
              {/* Axes */}
              <line x1={MARGIN.left} y1={baselineY} x2={SVG_WIDTH - MARGIN.right} y2={baselineY} stroke="#ffffff33" strokeWidth="1" />
              <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={baselineY} stroke="#ffffff33" strokeWidth="1" />
              {/* Interval guides - shown when toggle is enabled */}
              {showIntervalGuides && intervalGuides.map((guide, idx) => {
                const xJust = ratioToX(guide.ratio);
                const labelY = MARGIN.top - 10 - (idx % 2) * 16;
                const style = flavorStyles[guide.flavor];
                return (
                  <g 
                    key={`guide-${guide.name}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => playAudio(f0, guide.ratio)}
                  >
                    <line x1={xJust} y1={MARGIN.top} x2={xJust} y2={baselineY} stroke={style.line} strokeDasharray="6 5" strokeWidth="1.4" strokeOpacity={0.9} />
                    <g transform={`translate(${xJust}, ${labelY})`}>
                      <text x="0" y="-2" fill={style.text} fontSize="10" textAnchor="middle" fontWeight="600">{guide.name}</text>
                    </g>
                  </g>
                );
              })}
              {/* Selected ratio marker */}
              {selectedRatio && (
                <g>
                  <line x1={selectedX} y1={MARGIN.top} x2={selectedX} y2={baselineY} stroke="#ef4444" strokeDasharray="6 4" strokeWidth="1.25" />
                  <circle cx={selectedX} cy={selectedY} r="5" fill="#ef4444" />
                  <rect x={selectedX - 54} y={MARGIN.top - 30} width="108" height="24" rx="6" fill="#111827" opacity="0.95" />
                  <text x={selectedX} y={MARGIN.top - 14} fill="#f1f5f9" fontSize="11" textAnchor="middle">r = {clampedSelectedRatio.toFixed(3)}×</text>
                  <rect x={selectedX - 60} y={selectedY - 34} width="120" height="20" rx="6" fill="#111827" opacity="0.9" />
                  <text x={selectedX} y={selectedY - 20} fill="#f1f5f9" fontSize="10" textAnchor="middle">
                    Relative dissonance ≈ {selectedNormalizedValue.toFixed(2)}
                  </text>
                </g>
              )}
              {/* Axis labels */}
              <text x={(MARGIN.left + SVG_WIDTH - MARGIN.right) / 2} y={SVG_HEIGHT - 8} fill="#cbd5f5" fontSize="12" textAnchor="middle" fontWeight="600">Interval ratio r</text>
              <text x={16} y={(MARGIN.top + baselineY) / 2} fill="#cbd5f5" fontSize="12" textAnchor="middle" fontWeight="600" transform={`rotate(-90, 16, ${(MARGIN.top + baselineY) / 2})`}>Relative dissonance index</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}


function WaveformBreakdown({ f0, ratio, partials, rolloff }: { f0: number; ratio: number; partials: number; rolloff: number }) {
  const sampleCount = 360;
  const breakdown = useMemo(() => {
    // Short-term view (2 periods) - for detailed analysis
    const shortTimes = Array.from({ length: sampleCount }, (_, i) => (i / (sampleCount - 1)) * 2);
    const basePartialsValues: number[][] = [];
    const partnerPartialsValues: number[][] = [];
    const baseSum = Array(sampleCount).fill(0);
    const partnerSum = Array(sampleCount).fill(0);
    let maxAbs = 0;

    for (let k = 1; k <= partials; k++) {
      const amp = 1 / Math.pow(k, rolloff);
      const baseValues = shortTimes.map((t) => amp * Math.sin(2 * Math.PI * k * t));
      const partnerValues = shortTimes.map((t) => amp * Math.sin(2 * Math.PI * k * ratio * t));
      basePartialsValues.push(baseValues);
      partnerPartialsValues.push(partnerValues);
      for (let i = 0; i < sampleCount; i++) {
        baseSum[i] += baseValues[i];
        partnerSum[i] += partnerValues[i];
        maxAbs = Math.max(maxAbs, Math.abs(baseValues[i]), Math.abs(partnerValues[i]));
      }
    }

    const combined = baseSum.map((v, i) => v + partnerSum[i]);
    for (const val of combined) {
      maxAbs = Math.max(maxAbs, Math.abs(val));
    }
    const normalizer = maxAbs > 0 ? maxAbs : 1;

    // Calculate normalization for long-term view as well
    let longTermMaxAbs = 0;
    const longSampleCount = 720; // Higher resolution for the longer view
    const longTimes = Array.from({ length: longSampleCount }, (_, i) => (i / (longSampleCount - 1)) * 20);
    
    for (let k = 1; k <= partials; k++) {
      const amp = 1 / Math.pow(k, rolloff);
      const longBaseValues = longTimes.map((t) => amp * Math.sin(2 * Math.PI * k * t));
      const longPartnerValues = longTimes.map((t) => amp * Math.sin(2 * Math.PI * k * ratio * t));
      for (let i = 0; i < longSampleCount; i++) {
        const longCombinedValue = longBaseValues[i] + longPartnerValues[i];
        longTermMaxAbs = Math.max(longTermMaxAbs, Math.abs(longCombinedValue));
      }
    }

    const longNormalizer = longTermMaxAbs > 0 ? longTermMaxAbs : 1;

    // Short-term dimensions
    const shortDims = { width: 360, height: 140, padX: 22, padY: 24 }; // Same height as WavePanel
    const shortInnerWidth = shortDims.width - 2 * shortDims.padX;
    const shortMidY = shortDims.height / 2;
    const shortScaleY = (shortDims.height - 2 * shortDims.padY) / 2;

    const toShortPath = (values: number[]) => values
      .map((val, idx) => {
        const x = shortDims.padX + (idx / (sampleCount - 1)) * shortInnerWidth;
        const y = shortMidY - (val / normalizer) * shortScaleY;
        // Round to fixed decimal places for consistency
        return `${idx === 0 ? "M" : "L" } ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    // Long-term dimensions (20 periods view)
    const longDims = { width: 360, height: 140, padX: 22, padY: 24 };
    const longInnerWidth = longDims.width - 2 * longDims.padX;
    const longMidY = longDims.height / 2;
    const longScaleY = (longDims.height - 2 * longDims.padY) / 2;

    const toLongPath = (values: number[]) => values
      .map((val, idx) => {
        const x = longDims.padX + (idx / (longSampleCount - 1)) * longInnerWidth;
        const y = longMidY - (val / longNormalizer) * longScaleY;
        // Round to fixed decimal places for consistency
        return `${idx === 0 ? "M" : "L" } ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    // Create paths for long-term view
    const longBaseSum = Array(longSampleCount).fill(0);
    const longPartnerSum = Array(longSampleCount).fill(0);
    const longCombined = Array(longSampleCount).fill(0);

    for (let k = 1; k <= partials; k++) {
      const amp = 1 / Math.pow(k, rolloff);
      const longBaseValues = longTimes.map((t) => amp * Math.sin(2 * Math.PI * k * t));
      const longPartnerValues = longTimes.map((t) => amp * Math.sin(2 * Math.PI * k * ratio * t));
      for (let i = 0; i < longSampleCount; i++) {
        longBaseSum[i] += longBaseValues[i];
        longPartnerSum[i] += longPartnerValues[i];
        longCombined[i] = longBaseSum[i] + longPartnerSum[i];
      }
    }

    const shortTicks = [0, 0.5, 1, 1.5, 2].map((cycle) => shortDims.padX + (cycle / 2) * shortInnerWidth);
    const longTicks = [0, 5, 10, 15, 20].map((cycle) => longDims.padX + (cycle / 20) * longInnerWidth);

    // Create paths for each partial of both base and partner
    const basePartialPaths = basePartialsValues.map(toShortPath);

    return {
      shortDims,
      shortTicks,
      longDims,
      longTicks,
      base: { 
        partialPaths: basePartialPaths, 
        sumPath: toShortPath(baseSum),
        longSumPath: toLongPath(longBaseSum)
      },
      partner: { 
        partialPaths: partnerPartialsValues.map(toShortPath), 
        sumPath: toShortPath(partnerSum),
        longSumPath: toLongPath(longPartnerSum)
      },
      combined: {
        sumPath: toShortPath(combined),
        longSumPath: toLongPath(longCombined),
        overlays: [
          { path: toShortPath(baseSum), color: "#38bdf8" },
          { path: toShortPath(partnerSum), color: "#fb923c" },
        ],
        longOverlays: [
          { path: toLongPath(longBaseSum), color: "#38bdf8" },
          { path: toLongPath(longPartnerSum), color: "#fb923c" },
        ],
      },
      allPartialData: basePartialsValues.map((baseValues, idx) => ({
        basePath: toShortPath(baseValues),
        partnerPath: toShortPath(partnerPartialsValues[idx]),
        partialNumber: idx + 1
      }))
    };
  }, [partials, ratio, rolloff, sampleCount]);

  const toneB = (f0 * ratio).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Individual partial comparisons - only if more than 1 partial (moved up as they're foundational) */}
      {partials > 1 && (
        <div className="space-y-4">
          <div className="text-sm text-gray-300 font-medium">Partial waveforms comparison</div>
          {breakdown.allPartialData.map((partialData, idx) => (
            <div key={`partial-row-${idx}`} className="grid grid-cols-2 gap-4">
              <WavePanel
                title={`Partial ${partialData.partialNumber}`}
                subtitle={`Base tone, ${f0.toFixed(1)} Hz × ${partialData.partialNumber}`}
                partialPaths={[]}
                partialColor="#38bdf8"
                sumPath={partialData.basePath}
                sumColor="#38bdf8"
                ticks={breakdown.shortTicks}
                dims={breakdown.shortDims}
              />
              <WavePanel
                title={`Partial ${partialData.partialNumber}`}
                subtitle={`Shifted tone, ${(f0 * ratio).toFixed(1)} Hz × ${partialData.partialNumber}`}
                partialPaths={[]}
                partialColor="#fb923c"
                sumPath={partialData.partnerPath}
                sumColor="#fb923c"
                ticks={breakdown.shortTicks}
                dims={breakdown.shortDims}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Base and shifted waveforms in a row */}
      <div className="grid gap-4 md:grid-cols-2">
        <WavePanel
          title="Base tone (2 periods)"
          subtitle={`${f0.toFixed(1)} Hz`}
          partialPaths={breakdown.base.partialPaths}
          partialColor="#38bdf8"
          sumPath={breakdown.base.sumPath}
          sumColor="#38bdf8"
          ticks={breakdown.shortTicks}
          dims={breakdown.shortDims}
        />
        <WavePanel
          title="Shifted tone (2 periods)"
          subtitle={`${toneB} Hz`}
          partialPaths={breakdown.partner.partialPaths}
          partialColor="#fb923c"
          sumPath={breakdown.partner.sumPath}
          sumColor="#fb923c"
          ticks={breakdown.shortTicks}
          dims={breakdown.shortDims}
        />
      </div>
      
      {/* Combined waveforms: 2 periods and 20 periods in a row */}
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-sm text-gray-300 font-medium mb-2">Combined waveform (2 periods)</div>
          <WavePanel
            title=""
            subtitle="What reaches your ear"
            partialPaths={[]}
            partialColor="#94a3b8"
            sumPath={breakdown.combined.sumPath}
            sumColor="#f8fafc"
            ticks={breakdown.shortTicks}
            dims={breakdown.shortDims}
            overlays={breakdown.combined.overlays}
            showThickOverlays={true}
          />
        </div>
        
        <div>
          <div className="text-sm text-gray-300 font-medium mb-2">Combined waveform (20 periods)</div>
          <WavePanel
            title=""
            subtitle="Long-term pattern"
            partialPaths={[]}
            partialColor="#94a3b8"
            sumPath={breakdown.combined.longSumPath}
            sumColor="#f8fafc"
            ticks={breakdown.longTicks}
            dims={breakdown.longDims}
            overlays={breakdown.combined.longOverlays}
            showThickOverlays={true}
          />
        </div>
      </div>
      
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-6 rounded-full bg-sky-400/80" />
          Base partial layers
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-6 rounded-full bg-orange-400/80" />
          Shifted partial layers
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex h-2 w-6 rounded-full bg-slate-100" />
          Combined waveform (what you hear)
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
      <div>
        <div className="font-semibold text-gray-100">{title}</div>
        <div className="text-gray-500">{subtitle}</div>
      </div>
      <svg viewBox={`0 0 ${dims.width} ${dims.height}`} className={`w-full ${heightClass}`}>
        <rect x="0" y="0" width={dims.width} height={dims.height} rx="12" fill="#0f172a" opacity="0.85" />
        <line x1={dims.padX} y1={dims.height / 2} x2={dims.width - dims.padX} y2={dims.height / 2} stroke="#1f2937" strokeDasharray="4 6" />
        {ticks.map((x, idx) => (
          <line key={`tick-${idx}`} x1={x} y1={dims.padY - 6} x2={x} y2={dims.height - dims.padY + 6} stroke="#1f2937" strokeDasharray="2 6" />
        ))}
        {partialPaths.map((path, idx) => (
          <path key={`partial-${idx}`} d={path} stroke={partialColor} strokeOpacity={0.4} strokeWidth={0.8} fill="none" />
        ))}
        {overlays?.map((overlay, idx) => (
          <path key={`overlay-${idx}`} d={overlay.path} stroke={overlay.color} strokeDasharray={showThickOverlays ? undefined : "6 5"} strokeWidth={showThickOverlays ? "2.0" : "1.4"} strokeOpacity={showThickOverlays ? 0.8 : 0.6} fill="none" />
        ))}
        <path d={sumPath} stroke={sumColor} strokeWidth="2.0" fill="none" />
      </svg>
    </div>
  );
}
