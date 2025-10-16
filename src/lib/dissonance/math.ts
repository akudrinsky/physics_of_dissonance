import type { Spectrum } from "./types";

const LOG10 = Math.log(10);
const LN2 = Math.log(2);

export function harmonicTonePartials(fundamentalHz: number, numPartials: number, rolloff: number) {
  const partials: { frequencyHz: number; amplitude: number }[] = [];
  for (let k = 1; k <= numPartials; k++) {
    const frequencyHz = k * fundamentalHz;
    const amplitude = Math.pow(k, -rolloff);
    partials.push({ frequencyHz, amplitude });
  }
  return partials;
}

export function spectrumFromHarmonics(fundamentalHz: number, numPartials: number, rolloff: number): Spectrum {
  const partials = harmonicTonePartials(fundamentalHz, numPartials, rolloff);
  return {
    freq: partials.map((p) => p.frequencyHz / fundamentalHz),
    amp: partials.map((p) => p.amplitude),
  };
}

export function ampToLoudness(amp: number): number {
  const dB = (20 * Math.log(amp)) / LOG10;
  return Math.pow(2, dB / 10) / 16;
}

export function dissonanceKernel(f1: number, f2: number, l1: number, l2: number): number {
  const x = 0.24;
  const s1 = 0.0207;
  const s2 = 18.96;
  const fmin = Math.min(f1, f2);
  const fmax = Math.max(f1, f2);
  const s = x / (s1 * fmin + s2);
  const p = s * (fmax - fmin);

  const b1 = 3.51;
  const b2 = 5.75;
  const l12 = Math.min(l1, l2);

  return l12 * (Math.exp(-b1 * p) - Math.exp(-b2 * p));
}

export function dyadicDissonance(
  baseFreq: number,
  ratio: number,
  spectrum: Spectrum
): number {
  const { freq: freqArray, amp: ampArray } = spectrum;
  const loudnessArray = ampArray.map(ampToLoudness);
  const numPartials = freqArray.length;
  let dissonanceScore = 0;

  for (let i = 0; i < numPartials; i++) {
    for (let j = 0; j < numPartials; j++) {
      const f1 = baseFreq * freqArray[i];
      const f2 = baseFreq * freqArray[j];
      const l1 = loudnessArray[i];
      const l2 = loudnessArray[j];
      dissonanceScore +=
        0.5 * dissonanceKernel(f1, f2, l1, l2) +
        0.5 * dissonanceKernel(ratio * f1, ratio * f2, l1, l2) +
        dissonanceKernel(f1, ratio * f2, l1, l2);
    }
  }

  return dissonanceScore / 2;
}

export type TriadSurfaceOptions = {
  baseFreq: number;
  spectrum: Spectrum;
  minRatio?: number;
  maxRatio?: number;
  step?: number;
};

export function computeTriadSurface({
  baseFreq,
  spectrum,
  minRatio = 1,
  maxRatio = 2,
  step = 0.02,
}: TriadSurfaceOptions) {
  const { freq: freqArray, amp: ampArray } = spectrum;
  const loudnessArray = ampArray.map(ampToLoudness);
  const numPartials = freqArray.length;

  const ratios: number[] = [];
  for (let r = minRatio; r <= maxRatio + 1e-9; r += step) {
    ratios.push(Number(r.toFixed(6)));
  }

  const data: number[][] = [];
  let maxScore = Number.NEGATIVE_INFINITY;

  for (const r of ratios) {
    const row: number[] = [];
    for (const s of ratios) {
      let dissonanceSum = 0;
      for (let i = 0; i < numPartials; i++) {
        for (let j = 0; j < numPartials; j++) {
          const f1 = baseFreq * freqArray[i];
          const f2 = baseFreq * freqArray[j];
          const l1 = loudnessArray[i];
          const l2 = loudnessArray[j];

          const d =
            dissonanceKernel(f1, f2, l1, l2) +
            dissonanceKernel(r * f1, r * f2, l1, l2) +
            dissonanceKernel(f1, r * f2, l1, l2) +
            dissonanceKernel(s * f1, s * f2, l1, l2) +
            dissonanceKernel(f1, s * f2, l1, l2) +
            dissonanceKernel(r * f1, s * f2, l1, l2);

          dissonanceSum += d;
        }
      }

      dissonanceSum /= 2;
      row.push(dissonanceSum);
      if (dissonanceSum > maxScore) {
        maxScore = dissonanceSum;
      }
    }
    data.push(row);
  }

  const normalized = data.map((row) =>
    row.map((value) => (maxScore > 0 ? value / maxScore : 0))
  );

  return {
    ratios,
    values: normalized,
  };
}

export function ratioToMidi(ratio: number) {
  return 12 * Math.log(ratio) / LN2 + 60;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function midiToNoteName(midi: number) {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12];
  return `${note}${octave}`;
}

export function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function ratioToNoteName(ratio: number, baseFrequency: number) {
  const midi = frequencyToMidi(baseFrequency * ratio);
  return midiToNoteName(midi);
}
