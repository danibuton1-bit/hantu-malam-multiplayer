// Lightweight articulated humanoids shared by the lobby, classic matches and Prop Hunt.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CharId } from "./art";

type Pal = { cover: number; top: number; pants: number; shoe: number; skirt?: number; hair?: number; pack?: number; torch: number; iris: string; girl: boolean };
const PAL: Record<CharId, Pal> = {
  raka: { cover: 0x17171b, top: 0x1b1b20, pants: 0x1f1f24, shoe: 0x141416, hair: 0x7a4a2a, torch: 0x2a2a2e, iris: "#4a3426", girl: false },
  aisyah: { cover: 0xf6b6cf, top: 0xf4a9c6, pants: 0x141416, shoe: 0xf2a6c4, skirt: 0xe37fa7, torch: 0xe7b62c, iris: "#6b3a30", girl: true },
  qila: { cover: 0x111114, top: 0x2f9f95, pants: 0x18181c, shoe: 0x1a1a1e, torch: 0x2a2a2e, iris: "#4a3426", girl: true },
  nabila: { cover: 0xb9a2e3, top: 0xa58bd6, pants: 0x7d63b8, shoe: 0x6a51a3, pack: 0x151518, torch: 0x2a2a2e, iris: "#4a3426", girl: true },
};
const SKIN = 0xf0c6ab;
const fabricCache = new Map<number, THREE.Texture>();
function fabricTex(color: number) {
  const cached = fabricCache.get(color); if (cached) return cached;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); if (!g) return null;
  g.fillStyle = `#${color.toString(16).padStart(6, "0")}`; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(255,255,255,.045)";
  for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) g.fillRect(x + (y % 8 ? 1 : 0), y, 1, 2);
  g.strokeStyle = "rgba(0,0,0,.06)"; g.lineWidth = 1;
  for (let x = 0; x < 64; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  if (color === PAL.qila.top) { g.fillStyle = "rgba(233,251,247,.75)"; g.fillRect(0, 16, 64, 3); g.fillRect(0, 48, 64, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; fabricCache.set(color, t); return t;
}
function tagTex(name: string, color: string) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 56;
  const g = c.getContext("2d"); if (!g) return new THREE.CanvasTexture(c);
  g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  const w = Math.min(250, g.measureText(name).width + 28);
  g.fillStyle = "rgba(10,6,10,.72)"; g.beginPath(); g.roundRect((256 - w) / 2, 6, w, 44, 14); g.fill();
  g.fillStyle = color; g.fillText(name, 128, 29);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function nameTag(name: string, color = "#f4efe6") {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(name.slice(0, 16), color), transparent: true, depthWrite: false }));
  s.scale.set(1.1, 0.24, 1); return s;
}
export type Avatar = { root: THREE.Group; update: (o: { dt: number; t: number; moving: boolean; pitch: number; emote: string | null }) => void };

// Merge only rigid siblings with identical materials; joint groups remain independent.
function batchRigid(group: THREE.Group) {
  for (const child of group.children) if (child instanceof THREE.Group) batchRigid(child);
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const list = batches.get(child.material) ?? []; list.push(child); batches.set(child.material, list);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => { mesh.updateMatrix(); const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(); return part.applyMatrix4(mesh.matrix); });
    const geometry = mergeGeometries(parts); parts.forEach(p => p.dispose());
    if (!geometry) continue;
    meshes.forEach(mesh => { group.remove(mesh); mesh.geometry.dispose(); });
    const combined = new THREE.Mesh(geometry, material); combined.name = "rigid-batch"; group.add(combined);
  }
}
export function buildAvatar(id: CharId, mat: (p: THREE.MeshStandardMaterialParameters) => THREE.Material, low: boolean): Avatar {
  const P = PAL[id], seg = low ? 8 : 14;
  const materials = new Map<string, THREE.Material>();
  const m = (color: number, cloth = false) => {
    const key = `${color}:${cloth}`; const cached = materials.get(key); if (cached) return cached;
    const material = mat({ color: cloth ? 0xffffff : color, map: cloth ? fabricTex(color) : null, roughness: color === SKIN ? 0.72 : 0.9 });
    materials.set(key, material); return material;
  };
  const box = (w: number, h: number, d: number, color: number, cloth = false) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, low ? 1 : 2, Math.min(w, h, d) * 0.25), m(color, cloth));
  const cap = (r: number, l: number, color: number, cloth = false) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, low ? 3 : 5, seg), m(color, cloth));
  const limb = (top: number, bottom: number, length: number, color: number) => new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, -length - 0.018), new THREE.Vector2(bottom * 0.8, -length - 0.009),
    new THREE.Vector2(bottom, -length + 0.025), new THREE.Vector2(top * 0.94, -length * 0.44),
    new THREE.Vector2(top, -0.065), new THREE.Vector2(top * 0.86, -0.018), new THREE.Vector2(0, 0.025),
  ], seg), m(color, true));
  const oval = (parent: THREE.Group, color: number, pos: [number, number, number], scale: [number, number, number], cloth = false) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, seg, low ? 8 : 12), m(color, cloth)); mesh.position.set(...pos); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  };
  const root = new THREE.Group(); root.name = `avatar-${id}`;
  const body = new THREE.Group(); body.name = "body"; root.add(body);
  const mkLeg = (x: number, side: string) => {
    const hip = new THREE.Group(); hip.name = `hip-${side}`; hip.position.set(x, 0.87, 0); body.add(hip);
    const thigh = limb(0.087, 0.064, 0.39, P.pants); hip.add(thigh);
    const knee = new THREE.Group(); knee.name = `knee-${side}`; knee.position.y = -0.39; hip.add(knee);
    oval(knee, P.pants, [0, 0, 0], [0.064, 0.058, 0.063], true);
    const shin = limb(0.062, 0.041, 0.37, P.pants); knee.add(shin);
    const ankle = new THREE.Group(); ankle.name = `ankle-${side}`; ankle.position.y = -0.37; knee.add(ankle);
    const boot = box(0.13, 0.12, 0.25, P.shoe); boot.position.set(0, -0.045, -0.05); ankle.add(boot);
    const sole = box(0.14, 0.025, 0.27, 0x23232a); sole.position.set(0, -0.097, -0.052); ankle.add(sole);
    if (!low) for (let i = 0; i < 3; i++) { const lace = box(0.078, 0.007, 0.012, 0x9e9b9c); lace.position.set(0, 0.013, -0.025 - i * 0.028); ankle.add(lace); }
    return { hip, knee, ankle };
  };
  const left = mkLeg(-0.1, "left"), right = mkLeg(0.1, "right");
  const legL = left.hip, legR = right.hip;
  const torso = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0.86), new THREE.Vector2(0.16, 0.86), new THREE.Vector2(0.165, 0.91),
    new THREE.Vector2(0.145, 1.03), new THREE.Vector2(0.178, 1.17), new THREE.Vector2(0.219, 1.27),
    new THREE.Vector2(0.205, 1.32), new THREE.Vector2(0.095, 1.37), new THREE.Vector2(0, 1.37),
  ], seg + 4), m(P.top, true)); torso.scale.z = 0.66; body.add(torso);
  const hips = box(0.32, 0.16, 0.21, P.pants, true); hips.position.y = 0.87; body.add(hips);
  const vest = box(0.30, 0.30, 0.035, 0x303036, true); vest.position.set(0, 1.16, -0.124); body.add(vest);
  const zip = box(0.008, 0.27, 0.012, 0x9a9aa2); zip.position.set(0, 1.16, -0.148); body.add(zip);
  for (const sx of [-1, 1]) { const pocket = box(0.09, 0.082, 0.025, 0x303036, true); pocket.position.set(sx * 0.092, 1.08, -0.148); body.add(pocket); }
  const belt = box(0.325, 0.028, 0.22, 0x222227); belt.position.y = 0.935; body.add(belt);
  const buckle = box(0.035, 0.025, 0.014, 0x9a9aa2); buckle.position.set(0, 0.935, -0.117); body.add(buckle);
  if (P.skirt) { const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.25, 0.28, seg), m(P.skirt, true)); skirt.position.y = 0.77; body.add(skirt); }
  if (P.pack) { const pack = box(0.29, 0.32, 0.13, P.pack, true); pack.position.set(0, 1.16, 0.19); body.add(pack); }
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), m(0xd8ae45)); badge.position.set(-0.095, 1.25, -0.148); badge.rotation.y = Math.PI; body.add(badge);
  const mkArm = (x: number, torch: boolean, side: string) => {
    const shoulder = new THREE.Group(); shoulder.name = `shoulder-${side}`; shoulder.position.set(x, 1.31, 0); body.add(shoulder);
    const upper = limb(0.068, 0.046, 0.265, P.top); shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.name = `elbow-${side}`; elbow.position.y = -0.265; shoulder.add(elbow);
    oval(elbow, P.top, [0, 0, 0], [0.047, 0.046, 0.045], true);
    const forearm = limb(0.047, 0.032, 0.238, P.top); elbow.add(forearm);
    const cuff = box(0.082, 0.035, 0.076, 0x303036, true); cuff.position.y = -0.21; elbow.add(cuff);
    const wrist = new THREE.Group(); wrist.name = `wrist-${side}`; wrist.position.y = -0.238; elbow.add(wrist);
    const palm = box(0.066, 0.076, 0.028, SKIN); palm.position.y = -0.024; wrist.add(palm);
    for (let i = 0; i < 4; i++) {
      const finger = cap(0.0085, i === 0 || i === 3 ? 0.027 : 0.036, SKIN);
      finger.position.set(-0.025 + i * 0.017, -0.075, torch ? -0.014 : -0.004); finger.rotation.x = torch ? 0.85 : 0.17; wrist.add(finger);
    }
    const thumb = cap(0.011, 0.027, SKIN); thumb.position.set(x > 0 ? -0.039 : 0.039, -0.029, -0.009); thumb.rotation.z = x > 0 ? -0.48 : 0.48; wrist.add(thumb);
    if (torch) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.025, 0.20, seg), m(P.torch)); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, -0.055, -0.075); wrist.add(lamp);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 10), m(0xfff6d8)); lens.position.set(0, -0.055, -0.176); lens.rotation.y = Math.PI; wrist.add(lens);
    }
    return { shoulder, elbow, wrist };
  };
  const la = mkArm(-0.215, false, "left"), ra = mkArm(0.215, true, "right");
  const armL = la.shoulder, armR = ra.shoulder;
  const neck = cap(0.051, 0.045, SKIN); neck.position.y = 1.39; body.add(neck);
  const head = new THREE.Group(); head.name = "head"; head.position.y = 1.405; body.add(head);
  // An oval cranium, tapered jaw and projecting nose replace the oversized cartoon face.
  const skull = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.063, 0.025), new THREE.Vector2(0.099, 0.068),
    new THREE.Vector2(0.13, 0.12), new THREE.Vector2(0.14, 0.20), new THREE.Vector2(0.129, 0.268),
    new THREE.Vector2(0.096, 0.315), new THREE.Vector2(0.045, 0.34), new THREE.Vector2(0, 0.348),
  ], seg + 8), m(SKIN)); skull.scale.z = 0.83; head.add(skull);
  oval(head, SKIN, [0, 0.143, -0.115], [0.017, 0.045, 0.029]);
  oval(head, SKIN, [0, 0.116, -0.137], [0.023, 0.014, 0.023]);
  for (const sx of [-1, 1]) oval(head, SKIN, [sx * 0.136, 0.166, 0], [0.018, 0.039, 0.022]);
  const eyes = new THREE.Group(); eyes.name = "eyes"; eyes.position.y = 0.193; head.add(eyes);
  for (const sx of [-1, 1]) {
    oval(eyes, 0xe9e3da, [sx * 0.057, 0, -0.105], [0.033, 0.013, 0.014]);
    oval(eyes, new THREE.Color(P.iris).getHex(), [sx * 0.057, 0, -0.117], [0.010, 0.011, 0.004]);
    oval(eyes, 0x191715, [sx * 0.057, 0, -0.12], [0.0045, 0.007, 0.002]);
    if (!low) oval(eyes, 0xf5f2e8, [sx * 0.057 - 0.003, 0.004, -0.122], [0.002, 0.002, 0.001]);
    const brow = cap(0.0045, 0.05, P.hair ?? 0x39302c); brow.rotation.z = Math.PI / 2 + sx * 0.08; brow.position.set(sx * 0.057, 0.225, -0.10); head.add(brow);
  }
  oval(head, 0xb47c72, [0, 0.074, -0.084], [0.034, 0.006, 0.008]);
  oval(head, 0xc58f82, [0, 0.065, -0.083], [0.031, 0.006, 0.008]);
  const cover = new THREE.Mesh(new THREE.SphereGeometry(0.153, seg + 4, seg, Math.PI * 1.82, Math.PI * 1.36), m(P.cover, true));
  cover.scale.set(1, 1.24, 0.9); cover.position.y = 0.182; head.add(cover);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.154, seg + 4, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), m(P.cover, true)); capTop.scale.set(1, 1.24, 0.9); capTop.position.y = 0.18; head.add(capTop);
  if (P.girl) {
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.195, 0.22, seg + 4), m(P.cover, true)); drape.scale.z = 0.72; drape.position.y = -0.006; head.add(drape);
    if (!low) for (const sx of [-1, 1]) { const fold = cap(0.008, 0.12, P.cover, true); fold.position.set(sx * 0.12, -0.006, -0.078); fold.rotation.z = sx * 0.28; head.add(fold); }
  } else {
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.175, 0.09, seg), m(P.cover, true)); hood.scale.z = 0.8; hood.position.y = -0.012; head.add(hood);
    if (P.hair) for (let i = 0; i < 5; i++) { const lock = cap(0.017, 0.05, P.hair); lock.position.set(-0.08 + i * 0.04, 0.292, -0.089); lock.rotation.z = (i - 2) * 0.17; head.add(lock); }
  }
  batchRigid(body);
  let phase = 0, stride = 0, blinkAt = 2 + Math.random() * 3;
  const update: Avatar["update"] = ({ dt, t, moving, pitch, emote }) => {
    const step = Math.max(0, Math.min(0.05, dt));
    stride = THREE.MathUtils.damp(stride, moving ? 1 : 0, 10, step); phase += step * 9 * stride;
    const sw = Math.sin(phase) * stride;
    legL.rotation.set(sw * 0.46, 0, 0); legR.rotation.set(-sw * 0.46, 0, 0);
    left.knee.rotation.x = -0.06 - Math.max(0, -Math.sin(phase)) * 0.68 * stride;
    right.knee.rotation.x = -0.06 - Math.max(0, Math.sin(phase)) * 0.68 * stride;
    left.ankle.rotation.x = Math.max(0, Math.sin(phase)) * 0.12 * stride;
    right.ankle.rotation.x = Math.max(0, -Math.sin(phase)) * 0.12 * stride;
    armL.rotation.set(-sw * 0.38, 0, -0.07); armR.rotation.set(sw * 0.22 + 0.12, 0, 0.07);
    la.elbow.rotation.x = 0.12 + Math.max(0, sw) * 0.22; ra.elbow.rotation.x = 0.72 + sw * 0.10;
    la.wrist.rotation.set(0.04, 0, Math.sin(t * 1.8) * 0.025); ra.wrist.rotation.set(-0.06, 0, 0);
    body.position.set(0, Math.abs(Math.cos(phase)) * 0.022 * stride + Math.sin(t * 1.8) * 0.004 * (1 - stride), 0);
    body.rotation.set(0, sw * 0.035, sw * 0.02);
    torso.scale.x = 1 + Math.sin(t * 1.8) * 0.006 * (1 - stride);
    head.rotation.set(Math.max(-0.6, Math.min(0.6, pitch * 0.7)), 0, 0);
    const e = emote, s = (k: number) => Math.sin(t * k);
    if (e === "wave") { armL.rotation.set(0, 0, -(2.5 + s(12) * 0.2)); la.elbow.rotation.x = 0.65; }
    else if (e === "dance") { body.rotation.z = s(7) * 0.14; body.position.y = Math.abs(s(7)) * 0.055; armL.rotation.set(0, 0, -(1.8 + s(14) * 0.4)); armR.rotation.set(0, 0, 1.8 - s(14) * 0.4); la.elbow.rotation.x = ra.elbow.rotation.x = 0.5; }
    else if (e === "laugh") { body.position.y = Math.abs(s(22)) * 0.02; head.rotation.x = 0.25; armL.rotation.set(0.6, 0, 0.3); la.elbow.rotation.x = 1.1; }
    else if (e === "salute") { armL.rotation.set(1.3, 0, 0.6); la.elbow.rotation.x = 1.5; }
    else if (e === "victory") { armL.rotation.set(0, 0, -(2.8 + s(16) * 0.18)); la.elbow.rotation.x = 0.3; body.position.y = Math.abs(s(9)) * 0.10; }
    else if (e === "scared" || e === "shy") { body.position.x = e === "scared" ? s(60) * 0.012 : 0; armL.rotation.set(1.15, 0, 0.5); armR.rotation.set(1.15, 0, -0.5); la.elbow.rotation.x = ra.elbow.rotation.x = 1.5; head.rotation.x = -0.2; }
    else if (e === "hug") { const sq = Math.abs(s(3)) * 0.06; armL.rotation.set(1.15, 0.3, 0.7 + sq); armR.rotation.set(1.15, -0.3, -0.7 - sq); la.elbow.rotation.x = ra.elbow.rotation.x = 0.7; body.rotation.set(-0.08, 0, s(1.6) * 0.04); head.rotation.set(-0.1, 0.35, 0.15); }
    else if (e === "kiss") { body.rotation.x = -0.12; head.rotation.set(-0.15, 0.2, 0.18); armL.rotation.set(1.1, 0.2, 0.6); armR.rotation.set(0.8, -0.2, -0.5); la.elbow.rotation.x = 0.8; }
    blinkAt -= step; if (blinkAt < -0.13) blinkAt = 2.5 + Math.random() * 3;
    eyes.scale.y = e === "shy" || e === "kiss" || e === "laugh" || e === "hug" || blinkAt < 0 ? 0.08 : 1;
  };
  return { root, update };
}
