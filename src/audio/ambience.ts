import { useEffect } from "react";
import { useGame } from "../state/game";
import { random } from "../config/park";
let context: AudioContext | undefined,
  gain: GainNode | undefined,
  timer: ReturnType<typeof setInterval> | undefined;
const rng = random(170);
export function startAudio() {
  try {
    if (!context) {
      context = new AudioContext();
      gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      const buffer = context.createBuffer(
          1,
          context.sampleRate * 3,
          context.sampleRate,
        ),
        samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = (rng() * 2 - 1) * 0.12;
      const water = context.createBufferSource();
      water.buffer = buffer;
      water.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 650;
      water.connect(filter);
      filter.connect(gain);
      water.start();
      timer = setInterval(() => {
        if (!context || !gain || context.state !== "running") return;
        for (let i = 0; i < 3; i++) {
          const now = context.currentTime + i * 0.16;
          const chirp = context.createOscillator(),
            envelope = context.createGain();
          chirp.type = "sine";
          chirp.frequency.setValueAtTime(1700 + rng() * 700, now);
          chirp.frequency.exponentialRampToValueAtTime(
            2800 + rng() * 900,
            now + 0.08,
          );
          chirp.frequency.exponentialRampToValueAtTime(1500, now + 0.17);
          envelope.gain.setValueAtTime(0, now);
          envelope.gain.linearRampToValueAtTime(0.035, now + 0.02);
          envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          chirp.connect(envelope);
          envelope.connect(gain);
          chirp.start(now);
          chirp.stop(now + 0.2);
          chirp.onended = () => {
            chirp.disconnect();
            envelope.disconnect();
          };
        }
      }, 3600);
    }
    void context.resume().catch(() => {});
  } catch {
    /* Gameplay remains available if the browser denies audio. */
  }
}
export function useAudio() {
  const { settings, entered, hidden } = useGame();
  useEffect(() => {
    if (!context || !gain || !entered) return;
    if (hidden) {
      void context.suspend().catch(() => {});
      return;
    }
    void context.resume().catch(() => {});
    gain.gain.setTargetAtTime(
      settings.muted ? 0 : settings.volume,
      context.currentTime,
      0.15,
    );
  }, [settings.volume, settings.muted, entered, hidden]);
  useEffect(
    () => () => {
      if (timer) clearInterval(timer);
      void context?.close().catch(() => {});
      context = undefined;
      gain = undefined;
      timer = undefined;
    },
    [],
  );
}
