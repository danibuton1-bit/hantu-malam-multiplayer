import { describe, expect, it } from "vitest";
import { botsActive, teamMax } from "./team-mode";

describe("team modes", () => {
  it("solo holds 1, duo 2, squad 4 players", () => { expect([teamMax("solo"), teamMax("duo"), teamMax("squad")]).toEqual([1, 2, 4]); });
  it("bots only in solo when allowed", () => { expect(botsActive("solo", true, 1)).toBe(true); expect(botsActive("solo", false, 1)).toBe(false); });
  it("duo and squad never get bots", () => { expect(botsActive("duo", true, 1)).toBe(false); expect(botsActive("squad", true, 1)).toBe(false); });
});
