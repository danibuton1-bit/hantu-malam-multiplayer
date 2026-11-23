/** Who is talking right now (local mic + every remote voice stream we receive). Read by name tags. */
export const speaking: Record<string, boolean> = {};
type Meter = { stop: () => void };
let ctx: AudioContext | null = null;
export function meter(id: string, stream: MediaStream): Meter {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    void ctx.resume();
    const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize); let hold = 0;
    const iv = window.setInterval(() => {
      an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) { const d = (v - 128) / 128; s += d * d; }
      const rms = Math.sqrt(s / buf.length); const now = performance.now();
      if (rms > 0.035) hold = now + 350; speaking[id] = now < hold;
    }, 120);
    return { stop: () => { clearInterval(iv); src.disconnect(); speaking[id] = false; } };
  } catch { return { stop: () => {} }; }
}
