// Haunt cycle: one ghost at a time per hunter. It spawns away from the hunter, chases (passing through walls),
// jump-scares only within SCARE_DIST, then vanishes; after a cooldown the next ghost in turn appears.
export type GhostKind = "kuyang" | "kuntilanak" | "pocong";
export const GHOST_ORDER: GhostKind[] = ["kuyang", "kuntilanak", "pocong"];
export const SCARE_DIST = 75; // 1.5 m (50 units = 1 m)
export const SPAWN_DIST = 420;
export const CHASE_SPEED = 120; // a bit slower than a walking hunter: running away works
export const COOLDOWN_MIN = 20000, COOLDOWN_RAND = 10000, MAX_CHASE = 45000;

export type Haunt = { idx: number; active: boolean; x: number; y: number; nextAt: number; spawnedAt: number };
export const newHaunt = (now: number, firstDelay = 15000): Haunt => ({ idx: 0, active: false, x: 0, y: 0, nextAt: now + firstDelay, spawnedAt: 0 });
export const hauntKind = (h: Haunt): GhostKind => GHOST_ORDER[h.idx % GHOST_ORDER.length]!;

/** Advance the haunt. Returns the ghost that just scared the player, or null. */
export function stepHaunt(h: Haunt, now: number, dt: number, me: { x: number; y: number; yaw: number }, place: (yaw: number) => { x: number; y: number } | null, rand = Math.random): GhostKind | null {
  if (!h.active) {
    if (now < h.nextAt) return null;
    const p = place(me.yaw);
    if (!p) { h.nextAt = now + 2000; return null; }
    h.active = true; h.x = p.x; h.y = p.y; h.spawnedAt = now; return null;
  }
  const dx = me.x - h.x, dy = me.y - h.y, d = Math.hypot(dx, dy);
  const vanish = () => { h.active = false; h.idx++; h.nextAt = now + COOLDOWN_MIN + rand() * COOLDOWN_RAND; };
  if (d < SCARE_DIST) { const k = hauntKind(h); vanish(); return k; }
  if (now - h.spawnedAt > MAX_CHASE) { vanish(); return null; }
  const s = Math.min(d, CHASE_SPEED * dt); h.x += (dx / d) * s; h.y += (dy / d) * s;
  return null;
}
