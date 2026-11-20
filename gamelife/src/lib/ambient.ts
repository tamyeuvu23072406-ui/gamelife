export type Ambient = { update: (weather: string, hour: number, indoors: boolean) => void; stop: () => void };

/** Synthesized ambience (no audio assets). Must be started from a user gesture. */
export function startAmbient(): Ambient | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  const muffle = ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 12000;
  master.connect(muffle);
  muffle.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const layer = (type: BiquadFilterType, freq: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
    return g;
  };
  const rain = layer("highpass", 1500);
  const wind = layer("lowpass", 500);
  let day = false;
  let night = false;
  const tone = (freq: number, dur: number, vol: number, type: OscillatorType = "sine", when = 0) => {
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.linearRampToValueAtTime(freq * 1.25, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };
  const iv = setInterval(() => {
    if (day && Math.random() < 0.45) {
      const f = 2200 + Math.random() * 1600;
      tone(f, 0.09, 0.05);
      if (Math.random() < 0.6) tone(f * 1.1, 0.09, 0.05, "sine", 0.14);
    }
    if (night && Math.random() < 0.8) for (let i = 0; i < 3; i++) tone(4300, 0.04, 0.025, "square", i * 0.07);
  }, 700);
  return {
    update(weather, hour, indoors) {
      const wet = weather === "rain";
      day = hour >= 6 && hour < 18 && !wet;
      night = hour >= 19 || hour < 5;
      const t = ctx.currentTime;
      rain.gain.setTargetAtTime(wet ? 0.22 : 0, t, 0.6);
      wind.gain.setTargetAtTime(weather === "cloudy" ? 0.12 : wet ? 0.08 : 0.03, t, 0.8);
      muffle.frequency.setTargetAtTime(indoors ? 500 : 12000, t, 0.3);
    },
    stop() {
      clearInterval(iv);
      void ctx.close();
    },
  };
}
