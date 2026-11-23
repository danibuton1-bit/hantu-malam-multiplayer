import { describe, expect, it } from "vitest";
import { newHaunt, stepHaunt, hauntKind, SCARE_DIST, COOLDOWN_MIN } from "./haunt";

const me = { x: 0, y: 0, yaw: 0 };
const place = () => ({ x: 400, y: 0 });
const run = (h: ReturnType<typeof newHaunt>, from: number, to: number) => { const out: string[] = []; for (let t = from; t < to; t += 50) { const k = stepHaunt(h, t, 0.05, me, place, () => 0); if (k) out.push(k); } return out; };

describe("haunt", () => {
  it("ghosts appear one at a time in turn: kuyang, kuntilanak, pocong", () => {
    const h = newHaunt(0, 0);
    expect(run(h, 0, 200000).slice(0, 3)).toEqual(["kuyang", "kuntilanak", "pocong"]);
  });
  it("only scares within 1.5 m and vanishes after", () => {
    const h = newHaunt(0, 0); stepHaunt(h, 0, 0.05, me, place);
    expect(stepHaunt(h, 50, 0.05, me, place)).toBeNull();
    h.x = SCARE_DIST - 1; expect(stepHaunt(h, 100, 0.05, me, place)).toBe("kuyang");
    expect(h.active).toBe(false); expect(hauntKind(h)).toBe("kuntilanak");
  });
  it("waits at least 20 s before the next ghost", () => {
    const h = newHaunt(0, 0); stepHaunt(h, 0, 0.05, me, place); h.x = 10; stepHaunt(h, 100, 0.05, me, place, () => 0);
    expect(h.nextAt - 100).toBeGreaterThanOrEqual(COOLDOWN_MIN);
    stepHaunt(h, 100 + COOLDOWN_MIN - 50, 0.05, me, place); expect(h.active).toBe(false);
  });
});
