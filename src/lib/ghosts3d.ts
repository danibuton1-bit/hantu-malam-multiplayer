// 3D Kuntilanak and Pocong. Same shape as Kuyang: { root, update }. Origin at the feet, face ~1.55 m.
import * as THREE from "three";
import type { Kuyang } from "./kuyang3d";

const eyeGlow = (c: number) => new THREE.MeshBasicMaterial({ color: c });

export function buildKuntilanak(low = false): Kuyang {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const seg = low ? 8 : 16;
  const dress = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.9, emissive: 0x262626, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9d6dc, roughness: 0.7, emissive: 0x1a1a20, emissiveIntensity: 0.4 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x040405, roughness: 0.85 });
  // long dress, wider at the hem, tattered strips trailing below
  const gown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.42, 1.25, seg, 1, true), dress); gown.position.y = 0.72; body.add(gown);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19, seg, seg), dress); chest.scale.set(1, 1.1, 0.8); chest.position.y = 1.3; body.add(chest);
  const rags: THREE.Mesh[] = [];
  for (let i = 0; i < (low ? 6 : 12); i++) {
    const a = (i / (low ? 6 : 12)) * Math.PI * 2, len = 0.25 + ((i * 7) % 5) * 0.06;
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.16, len), dress); r.geometry.translate(0, -len / 2, 0);
    r.position.set(Math.sin(a) * 0.4, 0.1, Math.cos(a) * 0.4); r.rotation.y = a; body.add(r); rags.push(r);
  }
  // arms reaching forward
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * 0.2, 1.38, 0);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 6), dress); sl.rotation.x = Math.PI / 2; sl.position.z = 0.27; g.add(sl);
    const hand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.22, 5), skin); hand.rotation.x = Math.PI / 2; hand.position.z = 0.62; g.add(hand);
    body.add(g); arms.push(g);
  }
  // pale head, black hair falling over the face, red eyes peeking through
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, seg, seg), skin); head.scale.set(0.9, 1.1, 0.95); head.position.y = 1.58; body.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.155, seg, seg, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM); cap.position.y = 1.6; body.add(cap);
  const hairs: THREE.Mesh[] = [];
  for (let i = 0; i < (low ? 10 : 22); i++) {
    const a = (i / (low ? 10 : 22)) * Math.PI * 2, len = 0.9 + ((i * 13) % 6) * 0.1;
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.015), hairM); h.geometry.translate(0, -len / 2, 0);
    h.position.set(Math.sin(a) * 0.13, 1.7, Math.cos(a) * 0.13); h.rotation.y = a; body.add(h); hairs.push(h);
  }
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeGlow(0xff1010)); e.position.set(sx * 0.05, 1.6, 0.15); body.add(e); }
  const glow = new THREE.PointLight(0xc8d0ff, 1.1, 3.5); glow.position.set(0, 1.4, 0.4); body.add(glow);
  return {
    root,
    update({ t, moving }) {
      root.position.y = 0.35 + Math.sin(t * 1.8) * 0.08; // floats above the ground
      body.rotation.x = moving ? 0.18 : 0.05;
      rags.forEach((r, i) => { r.rotation.x = 0.3 + Math.sin(t * 4 + i) * 0.25 + (moving ? 0.4 : 0); });
      hairs.forEach((h, i) => { h.rotation.x = Math.sin(t * 2 + i) * 0.06 + (moving ? 0.2 : 0); });
      arms.forEach((a, i) => { a.rotation.x = -0.15 + Math.sin(t * 3 + i * 2) * 0.12; });
      glow.intensity = 0.9 + Math.sin(t * 5) * 0.25;
    },
  };
}

export function buildPocong(low = false): Kuyang {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const seg = low ? 8 : 16;
  const kafan = new THREE.MeshStandardMaterial({ color: 0xf0ede4, roughness: 0.95, emissive: 0x2a2a26, emissiveIntensity: 0.45 });
  const tie = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 1 });
  const face = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 1 });
  // wrapped body: tall capsule narrowing to the feet
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.05, 4, seg), kafan); torso.scale.set(1, 1, 0.85); torso.position.y = 0.8; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, seg, seg), kafan); head.scale.set(1, 1.15, 1); head.position.y = 1.62; body.add(head);
  // ties at the top of the head, the neck and the feet
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), kafan); knot.position.y = 1.9; body.add(knot);
  for (const [y, r] of [[1.84, 0.05], [1.42, 0.17], [0.18, 0.15]] as const) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, seg), tie); t.rotation.x = Math.PI / 2; t.position.y = y; body.add(t); }
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), kafan); f.position.set(sx * 0.06, 2.02, 0); f.rotation.z = sx * 0.6; body.add(f); }
  // dark rotting face with hollow glowing eyes
  const fc = new THREE.Mesh(new THREE.SphereGeometry(0.13, seg, seg), face); fc.scale.set(1, 1.15, 0.5); fc.position.set(0, 1.6, 0.13); body.add(fc);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeGlow(0xfff2a0)); e.position.set(sx * 0.05, 1.64, 0.19); body.add(e); }
  const glow = new THREE.PointLight(0xfff0c0, 0.9, 3); glow.position.set(0, 1.5, 0.5); body.add(glow);
  return {
    root,
    update({ t, moving }) {
      const hop = Math.abs(Math.sin(t * (moving ? 6 : 2)));
      root.position.y = hop * (moving ? 0.35 : 0.08); // hops on bound feet
      body.scale.y = 1 - (1 - hop) * 0.06; body.rotation.z = Math.sin(t * 3) * 0.05;
    },
  };
}
