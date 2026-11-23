// Petak Umpet (prop hunt) rules: pure TypeScript, no React / three.js.
import { circleHitsRect, PLAYER_R, WALLS, type Rect } from "./game";

export const PETAK = "petak";
export const ROLL_MS = 6000, HIDE_MS = 20000, HUNT_MS = 180000, RESULT_MS = 7000;
export const EYE_STAND = 1.6, EYE_CROUCH = 0.95;

export type PropKind =
  | "cangkir" | "botol" | "kaleng" | "vas" | "buku" | "lilin" | "apel"
  | "kardus" | "kursi" | "ember" | "koper" | "radio" | "catkaleng" | "ban"
  | "lemari" | "kulkas" | "sofa" | "drum" | "rak" | "meja";
/** Footprint w x d in world px (50 px = 1 m), height h in meters. */
export const PROP_DEFS: Record<PropKind, { nama: string; w: number; d: number; h: number }> = {
  cangkir: { nama: "Cangkir Kopi", w: 5, d: 5, h: 0.1 },
  botol: { nama: "Botol Sirup", w: 5, d: 5, h: 0.3 },
  kaleng: { nama: "Kaleng Minuman", w: 4, d: 4, h: 0.13 },
  vas: { nama: "Vas Bunga", w: 7, d: 7, h: 0.28 },
  buku: { nama: "Buku Tebal", w: 10, d: 8, h: 0.07 },
  lilin: { nama: "Lilin", w: 4, d: 4, h: 0.16 },
  apel: { nama: "Apel di Piring", w: 10, d: 10, h: 0.08 },
  kardus: { nama: "Kardus", w: 24, d: 22, h: 0.45 },
  kursi: { nama: "Kursi Kayu", w: 24, d: 24, h: 0.9 },
  ember: { nama: "Ember Pel", w: 16, d: 16, h: 0.35 },
  koper: { nama: "Koper Tua", w: 26, d: 12, h: 0.55 },
  radio: { nama: "Radio Transistor", w: 16, d: 8, h: 0.22 },
  catkaleng: { nama: "Kaleng Cat", w: 14, d: 14, h: 0.3 },
  ban: { nama: "Ban Bekas", w: 32, d: 32, h: 0.22 },
  lemari: { nama: "Lemari 2 Pintu", w: 60, d: 28, h: 2.0 },
  kulkas: { nama: "Kulkas", w: 36, d: 34, h: 1.8 },
  sofa: { nama: "Sofa Panjang", w: 100, d: 40, h: 0.85 },
  drum: { nama: "Drum Minyak", w: 30, d: 30, h: 0.9 },
  rak: { nama: "Rak Buku", w: 50, d: 18, h: 1.9 },
  meja: { nama: "Meja Bundar", w: 50, d: 50, h: 0.75 },
};
export const PROP_KINDS = Object.keys(PROP_DEFS) as PropKind[];
export type Placed = { i: number; kind: PropKind; x: number; y: number; e: number; rot: number };

// one furniture layout per room (offsets inside a 500x500 room), rotated through the house
const TEMPLATE: [PropKind, number, number, number][] = [
  ["lemari", 70, 40, 0], ["kulkas", 440, 70, 0], ["sofa", 130, 455, 0], ["rak", 455, 400, 0],
  ["meja", 330, 330, 0], ["cangkir", 318, 322, 0.75], ["apel", 342, 336, 0.75], ["vas", 330, 312, 0.75], ["lilin", 345, 318, 0.75],
  ["kursi", 380, 380, 0], ["kursi", 275, 330, 0], ["kardus", 60, 300, 0], ["kardus", 64, 330, 0.45],
  ["ember", 200, 70, 0], ["koper", 410, 170, 0], ["radio", 455, 400, 1.0], ["buku", 452, 395, 1.9], ["botol", 440, 70, 1.8],
  ["catkaleng", 110, 220, 0], ["ban", 380, 455, 0], ["drum", 40, 460, 0], ["kaleng", 210, 455, 0.85], ["botol", 70, 40, 2.0],
];
const ROOM_ORIGINS: [number, number][] = [[0, 0], [500, 0], [1000, 0], [0, 500], [500, 500], [1000, 500]];
// spots kept free: start-room spawn ring + the layar tancap, doorways
const KEEP_FREE: { x: number; y: number; r: number }[] = [
  { x: 250, y: 260, r: 120 }, { x: 250, y: 40, r: 120 },
  { x: 500, y: 250, r: 70 }, { x: 1000, y: 320, r: 70 }, { x: 500, y: 700, r: 70 }, { x: 1000, y: 780, r: 70 },
  { x: 250, y: 500, r: 70 }, { x: 750, y: 500, r: 70 }, { x: 1250, y: 500, r: 70 },
  { x: 750, y: 300, r: 60 }, // hallway table furniture
];
export const PROPS: Placed[] = (() => {
  const out: Placed[] = [];
  ROOM_ORIGINS.forEach(([ox, oy], ri) => {
    for (const [kind, fx, fy, e] of TEMPLATE) {
      // mirror every other room so the house does not look copy-pasted
      const x = ox + (ri % 2 ? 500 - fx : fx), y = oy + (ri >= 3 ? 500 - fy : fy);
      if (KEEP_FREE.some((k) => Math.hypot(k.x - x, k.y - y) < k.r)) continue;
      out.push({ i: out.length, kind, x, y, e, rot: ((ri * 7 + out.length) % 4) * 0.4 });
    }
  });
  return out;
})();
export const propRect = (kind: PropKind, x: number, y: number): Rect => { const d = PROP_DEFS[kind]; return { x: x - d.w / 2, y: y - d.d / 2, w: d.w, h: d.d }; };
/** Big floor props physically block walking (and bullets). */
export const BLOCKING = PROPS.filter((p) => p.e === 0 && PROP_DEFS[p.kind].h >= 0.7 && PROP_DEFS[p.kind].w >= 24).map((p) => propRect(p.kind, p.x, p.y));

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** First round only: the layar tancap picks the hunter at random (same answer on every client). */
export function firstHunter(ids: string[], seed: number) { const s = [...ids].sort(); return s[Math.floor(seeded(seed)() * s.length)]!; }
/** Later rounds: the loser hunts. The first hider shot is the loser; if nobody was shot the hunter lost and hunts again. */
export function nextHunter(hunter: string, elimOrder: string[]) { return elimOrder[0] ?? hunter; }
/** Squad numbers 1..n shuffled once per match. */
export function squadNumbers(ids: string[], seed: number): Record<string, number> {
  const s = [...ids].sort(); const r = seeded(seed ^ 0x9e3779b9);
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j]!, s[i]!]; }
  return Object.fromEntries(s.map((id, i) => [id, i + 1]));
}
export type Phase = "roll" | "hide" | "hunt" | "done";
export function phaseAt(t0: number, now: number): { phase: Phase; left: number } {
  const e = now - t0;
  if (e < ROLL_MS) return { phase: "roll", left: ROLL_MS - e };
  if (e < ROLL_MS + HIDE_MS) return { phase: "hide", left: ROLL_MS + HIDE_MS - e };
  if (e < ROLL_MS + HIDE_MS + HUNT_MS) return { phase: "hunt", left: ROLL_MS + HIDE_MS + HUNT_MS - e };
  return { phase: "done", left: 0 };
}
export type Target = { id: string; x: number; y: number; w: number; d: number; h: number; base?: number };
export const hiderTarget = (id: string, x: number, y: number, disguise: PropKind | null, crouch: boolean, base = 0): Target =>
  disguise ? { id, x, y, w: PROP_DEFS[disguise].w, d: PROP_DEFS[disguise].d, h: PROP_DEFS[disguise].h, base } : { id, x, y, w: PLAYER_R * 2, d: PLAYER_R * 2, h: crouch ? 1.15 : 1.8 };
/**
 * Hitscan from (x, y, eye m) along yaw/pitch. Walls and big furniture stop the bullet.
 * Returns the hit target id (or null) and the impact point.
 */
export function shoot(x: number, y: number, eye: number, yaw: number, pitch: number, targets: Target[], max = 1400) {
  const dx = -Math.sin(yaw), dy = -Math.cos(yaw), slope = Math.tan(pitch) / 50; // meters per px
  const solids = [...WALLS, ...BLOCKING];
  for (let t = 6; t < max; t += 3) {
    const px = x + dx * t, py = y + dy * t, h = eye + slope * t;
    if (h < 0) return { id: null, x: px, y: py, h: 0 };
    for (const g of targets) {
      const b = g.base ?? 0;
      if (Math.abs(px - g.x) <= g.w / 2 + 1 && Math.abs(py - g.y) <= g.d / 2 + 1 && h >= b && h <= b + g.h) return { id: g.id, x: px, y: py, h };
    }
    if (h < 3.2 && solids.some((w) => circleHitsRect(px, py, 1, w))) return { id: null, x: px, y: py, h };
  }
  return { id: null, x: x + dx * max, y: y + dy * max, h: eye + slope * max };
}
/** Nearest prop to copy (within reach). */
export function nearestProp(x: number, y: number, max = 110) {
  let best: Placed | null = null, bd = max;
  for (const p of PROPS) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
  return best;
}
export const START_SPOTS = [{ x: 250, y: 250 }, { x: 180, y: 300 }, { x: 320, y: 300 }, { x: 250, y: 350 }, { x: 170, y: 220 }, { x: 330, y: 220 }];
