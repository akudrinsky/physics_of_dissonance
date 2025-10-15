const MIN_GAIN = 0.000001;
const BASE_FADE_IN = 0.002;
const BASE_RELEASE = 6.91 * 0.5;
const RELEASE_STAGGER = 6.91 * 0.05;
const QUICK_RELEASE = 0.12;
const QUICK_STAGGER = 0.03;

class ReferenceOsc {
  private readonly osc: OscillatorNode;
  private readonly gain: GainNode;
  private scheduledStop: number | null = null;

  constructor(private ctx: AudioContext) {
    this.osc = ctx.createOscillator();
    this.osc.type = "sine";
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.osc.connect(this.gain);
  }

  connect(dest: AudioNode) {
    this.gain.connect(dest);
  }

  disconnect() {
    try { this.gain.disconnect(); } catch {}
    try { this.osc.disconnect(); } catch {}
  }

  start(time: number) {
    try {
      this.osc.start(time);
      this.scheduledStop = null;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "InvalidStateError") {
        throw error;
      }
    }
  }

  stop(time: number) {
    if (this.scheduledStop !== null && time >= this.scheduledStop - 1e-6) {
      return;
    }
    try {
      this.osc.stop(time);
      this.scheduledStop = time;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "InvalidStateError") {
        throw error;
      }
    }
  }

  setFrequencyAtTime(frequency: number, time: number) {
    this.osc.frequency.setValueAtTime(frequency, time);
  }

  fadeIn(amplitude: number, targetTime: number) {
    this.gain.gain.linearRampToValueAtTime(amplitude, targetTime);
  }

  scheduleFadeOut(targetTime: number) {
    this.gain.gain.exponentialRampToValueAtTime(MIN_GAIN, targetTime);
  }

  forceFadeOut(now: number, targetTime: number): number {
    const safeTarget = Math.max(now + 0.01, targetTime);
    const param = this.gain.gain;
    try { param.cancelScheduledValues(now); } catch {}
    const current = Math.max(param.value, MIN_GAIN);
    param.setValueAtTime(current, now);
    param.exponentialRampToValueAtTime(MIN_GAIN, safeTarget);
    this.stop(safeTarget);
    return safeTarget;
  }
}

export class ReferenceSynth {
  private readonly masterGain: GainNode;
  private readonly oscillators: ReferenceOsc[];

  constructor(
    private ctx: AudioContext,
    private partialMultipliers: number[],
    private partialAmplitudes: number[]
  ) {
    this.masterGain = ctx.createGain();
    const partialCount = Math.max(partialMultipliers.length, 1);
    this.masterGain.gain.value = Math.max(1 / partialCount, 0.5);
    this.oscillators = partialMultipliers.map(() => new ReferenceOsc(ctx));
    this.oscillators.forEach((osc) => osc.connect(this.masterGain));
  }

  connect(dest: AudioNode) {
    this.masterGain.connect(dest);
  }

  disconnect() {
    try { this.masterGain.disconnect(); } catch {}
    this.oscillators.forEach((osc) => osc.disconnect());
  }

  play(baseFrequency: number, startTime: number): number {
    if (!this.partialMultipliers.length) {
      return startTime;
    }

    this.oscillators.forEach((osc, idx) => {
      osc.setFrequencyAtTime(baseFrequency * this.partialMultipliers[idx], startTime);
      osc.start(startTime);
      osc.fadeIn(this.partialAmplitudes[idx], startTime + BASE_FADE_IN);
      const releaseMoment = Math.max(startTime, startTime + BASE_RELEASE - RELEASE_STAGGER * idx);
      osc.scheduleFadeOut(releaseMoment);
      osc.stop(startTime + BASE_RELEASE);
    });

    return startTime + BASE_RELEASE;
  }

  forceSilence(now: number): number {
    let latest = now;
    this.oscillators.forEach((osc, idx) => {
      const releaseMoment = now + QUICK_RELEASE - QUICK_STAGGER * idx;
      const endTime = osc.forceFadeOut(now, releaseMoment);
      latest = Math.max(latest, endTime);
    });
    return latest;
  }
}

export type ActiveVoice = {
  synth: ReferenceSynth;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
};
