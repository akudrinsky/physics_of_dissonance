"use client";

import { useCallback, useRef } from "react";
import { ActiveVoice, ReferenceSynth } from "./audio";

type PlayRequest = {
  baseFrequency: number;
  partialMultipliers: number[];
  partialAmplitudes: number[];
  tuning: number[];
  channel: string;
  source: string;
};

export function useReferenceTonePlayer() {
  const audioRef = useRef<AudioContext | null>(null);
  const activeVoicesRef = useRef<ActiveVoice[]>([]);

  const stopAll = useCallback(() => {
    const ctx = audioRef.current;
    const now = ctx?.currentTime ?? 0;

    activeVoicesRef.current.forEach((voice) => {
      if (voice.cleanupTimer !== null) {
        clearTimeout(voice.cleanupTimer);
      }

      const releaseEnd = voice.synth.forceSilence(now);
      voice.cleanupTimer = window.setTimeout(() => {
        voice.synth.disconnect();
        activeVoicesRef.current = activeVoicesRef.current.filter((entry) => entry !== voice);
      }, Math.max(0, (releaseEnd - now + 0.02) * 1000));
    });
  }, []);

  const playChord = useCallback(async ({ baseFrequency, partialMultipliers, partialAmplitudes, tuning, channel, source }: PlayRequest) => {
    try { new BroadcastChannel(channel).postMessage({ type: "stop-others", src: source }); } catch {}

    if (!audioRef.current || audioRef.current.state === "closed") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioRef.current = new audioContext();
    }

    const ctx = audioRef.current;
    if (!ctx) return;
    try { await ctx.resume(); } catch {}

    if (!partialMultipliers.length) return;

    stopAll();

    const startTime = ctx.currentTime;

    tuning.forEach((multiplier) => {
      const synth = new ReferenceSynth(ctx, partialMultipliers, partialAmplitudes);
      synth.connect(ctx.destination);
      const voice: ActiveVoice = { synth, cleanupTimer: null };
      activeVoicesRef.current.push(voice);

      const stopTime = synth.play(baseFrequency * multiplier, startTime);
      voice.cleanupTimer = window.setTimeout(() => {
        synth.disconnect();
        activeVoicesRef.current = activeVoicesRef.current.filter((entry) => entry !== voice);
      }, Math.max(0, (stopTime - startTime + 0.05) * 1000));
    });
  }, [stopAll]);

  return {
    playChord,
    stopAll,
  };
}
