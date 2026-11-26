import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAvatar } from "./avatar3d";
import { CHAR_IDS } from "./art";

describe("shared articulated avatars", () => {
  for (const id of CHAR_IDS) for (const low of [true, false]) {
    it(`${id} ${low ? "mobile" : "full"}: elbows and knees animate without detaching`, () => {
      const avatar = buildAvatar(id, p => new THREE.MeshStandardMaterial(p), low);
      const elbow = avatar.root.getObjectByName("elbow-left");
      const knee = avatar.root.getObjectByName("knee-left");
      const wrist = avatar.root.getObjectByName("wrist-right");
      if (!elbow || !knee || !wrist) throw new Error("Missing articulated joint");
      const elbowAnchor = elbow.position.clone(), kneeAnchor = knee.position.clone();
      avatar.update({ dt: 0.05, t: 0, moving: false, pitch: 0, emote: null });
      const idleElbow = elbow.rotation.x, idleKnee = knee.rotation.x;
      let elbowMoved = false, kneeMoved = false;
      for (let frame = 0; frame < 90; frame++) {
        avatar.update({ dt: 0.05, t: frame / 20, moving: true, pitch: 0.2, emote: null });
        elbowMoved ||= Math.abs(elbow.rotation.x - idleElbow) > 0.05;
        kneeMoved ||= Math.abs(knee.rotation.x - idleKnee) > 0.05;
        expect(elbow.position.equals(elbowAnchor)).toBe(true);
        expect(knee.position.equals(kneeAnchor)).toBe(true);
      }
      expect(elbowMoved).toBe(true); expect(kneeMoved).toBe(true);
      for (const emote of ["wave", "dance", "salute", "hug", "kiss", "scared", null]) {
        avatar.update({ dt: 0.05, t: 7, moving: false, pitch: 0, emote });
        avatar.root.updateMatrixWorld(true);
        avatar.root.traverse(node => expect(node.matrixWorld.elements.every(Number.isFinite)).toBe(true));
      }
      avatar.update({ dt: 0.05, t: 8, moving: false, pitch: 0, emote: null });
      expect(avatar.root.getObjectByName("body")?.position.x).toBe(0);
      expect(wrist.parent?.name).toBe("elbow-right");
    });
  }
});