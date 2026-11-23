import { describe, expect, it } from "vitest";
import { applyMap } from "./game";
import { firstHunter, HIDE_MS, nextHunter, phaseAt, PROPS, PROP_DEFS, ROLL_MS, shoot, squadNumbers, hiderTarget } from "./prophunt";

applyMap("rumah");
describe("petak umpet", () => {
  it("hiders get 20 seconds to hide", () => { expect(HIDE_MS).toBe(20000); expect(phaseAt(0, ROLL_MS + 19999).phase).toBe("hide"); expect(phaseAt(0, ROLL_MS + 20000).phase).toBe("hunt"); });
  it("first hunter is the same on every client", () => { expect(firstHunter(["b", "a", "c"], 42)).toBe(firstHunter(["c", "a", "b"], 42)); });
  it("the first player shot becomes the next hunter", () => { expect(nextHunter("h", ["x", "y"])).toBe("x"); });
  it("hunter hunts again when nobody was shot", () => { expect(nextHunter("h", [])).toBe("h"); });
  it("squad numbers are 1..n", () => { expect(Object.values(squadNumbers(["a", "b", "c", "d"], 7)).sort()).toEqual([1, 2, 3, 4]); });
  it("rooms hold very small and very large props", () => {
    const hs = PROPS.map((p) => PROP_DEFS[p.kind].h);
    expect(Math.min(...hs)).toBeLessThanOrEqual(0.1); expect(Math.max(...hs)).toBeGreaterThanOrEqual(1.9); expect(PROPS.length).toBeGreaterThan(60);
  });
  it("a bullet hits a disguised hider in front and is stopped by walls", () => {
    const t = hiderTarget("x", 400, 200, "kardus", false);
    // yaw 0 looks toward -y; aim slightly down at the box
    expect(shoot(400, 300, 1.6, 0, Math.atan(-(1.4 / 2)), [t]).id).toBe("x");
    expect(shoot(150, 300, 1.6, Math.PI, 0, [hiderTarget("y", 150, 800, null, false)]).id).toBeNull();
  });
});
