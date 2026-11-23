// 3D renderer for Petak Umpet: house, props, layar tancap, headlamp + Desert Eagle, disguised players.
import * as THREE from "three";
import { DOORS, DOOR_W, ROOMS, WALLS, doorOpen } from "./game";
import { buildAvatar, type Avatar } from "./avatar3d";
import { isChar, type CharId } from "./art";
import { PROPS, PROP_DEFS, type PropKind } from "./prophunt";
import { LOW_END } from "./scene3d";
import { getGfx, pixelRatioFor } from "./graphics";

const U = 1 / 50, WALL_H = 3.2;
const MOBILE = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const Mat = (p: THREE.MeshStandardMaterialParameters) => (LOW_END ? (new THREE.MeshLambertMaterial({ color: p.color ?? 0xffffff, map: p.map ?? null, emissive: p.emissive ?? 0 }) as unknown as THREE.MeshStandardMaterial) : new THREE.MeshStandardMaterial(p));
const mats: Record<number, THREE.Material> = {};
const M = (c: number) => (mats[c] ??= Mat({ color: c, roughness: 0.8 }));
const box = (w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); return m; };
const cyl = (rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c)); m.position.set(x, y, z); return m; };

function tex(draw: (g: CanvasRenderingContext2D, s: number) => void, rep: number) {
  const c = document.createElement("canvas"); c.width = c.height = 256; draw(c.getContext("2d")!, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Procedural prop model, origin at the floor centre, sized from PROP_DEFS. */
export function buildProp(kind: PropKind): THREE.Group {
  const g = new THREE.Group(); const d = PROP_DEFS[kind]; const w = d.w * U, dp = d.d * U, h = d.h;
  switch (kind) {
    case "cangkir": g.add(cyl(0.045, 0.038, h, 0xf2efe6, 0, h / 2), cyl(0.04, 0.04, 0.01, 0x3a2010, 0, h - 0.008)); { const t = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12), M(0xf2efe6)); t.position.set(0.05, h / 2, 0); t.rotation.y = Math.PI / 2; g.add(t); } break;
    case "botol": g.add(cyl(0.045, 0.045, h * 0.7, 0x8a1020, 0, h * 0.35), cyl(0.015, 0.03, h * 0.3, 0x8a1020, 0, h * 0.85), cyl(0.017, 0.017, 0.02, 0xd0b040, 0, h)); break;
    case "kaleng": g.add(cyl(0.033, 0.033, h, 0xc02020, 0, h / 2), cyl(0.03, 0.03, 0.005, 0xcccccc, 0, h)); break;
    case "vas": g.add(cyl(0.035, 0.06, h * 0.75, 0x2c6c8a, 0, h * 0.37)); for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), M([0xe04060, 0xf0d040, 0xf0f0f0][i]!)); f.position.set((i - 1) * 0.03, h + 0.02, 0); g.add(f, cyl(0.004, 0.004, h * 0.3, 0x2a6a20, (i - 1) * 0.03, h * 0.85)); } break;
    case "buku": g.add(box(w, h, dp, 0x6a1a12, 0, h / 2), box(w * 0.94, h * 0.8, dp * 1.01, 0xe8e0c8, 0.005, h / 2)); break;
    case "lilin": g.add(cyl(0.02, 0.02, h * 0.8, 0xf4ecd0, 0, h * 0.4)); { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 6), new THREE.MeshBasicMaterial({ color: 0xffb040 })); fl.position.y = h * 0.9; g.add(fl); } break;
    case "apel": g.add(cyl(0.1, 0.08, 0.015, 0xe8e8e0, 0, 0.008)); for (const [x, z] of [[-0.03, 0], [0.035, 0.02], [0, -0.035]]) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M(0xb01818)); a.position.set(x!, 0.045, z!); g.add(a); } break;
    case "kardus": g.add(box(w, h, dp, 0xa07a48, 0, h / 2), box(w * 1.01, 0.04, 0.06, 0xc8b080, 0, h - 0.02)); break;
    case "kursi": g.add(box(w, 0.05, dp, 0x5a3418, 0, 0.45), box(w, 0.45, 0.05, 0x5a3418, 0, 0.7, -dp / 2 + 0.025)); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.04, 0.45, 0.04, 0x4a2a12, x! * (w / 2 - 0.03), 0.225, z! * (dp / 2 - 0.03))); break;
    case "ember": g.add(cyl(0.16, 0.12, h, 0x2060b0, 0, h / 2)); { const t = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 4, 16, Math.PI), M(0x888888)); t.position.y = h; g.add(t); } g.add(cyl(0.012, 0.012, 1.1, 0x8a6a40, 0.05, 0.6), cyl(0.06, 0.04, 0.12, 0xd8d0c0, 0.05, 0.08)); break;
    case "koper": g.add(box(w, h, dp, 0x5a3a20, 0, h / 2), box(w * 1.02, 0.03, dp * 1.02, 0x2a1a0e, 0, h * 0.5), box(0.14, 0.03, 0.03, 0x1a1a1a, 0, h + 0.03)); break;
    case "radio": g.add(box(w, h, dp, 0x7a5030, 0, h / 2)); { const sp = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), M(0x222222)); sp.position.set(-0.07, h / 2, dp / 2 + 0.002); g.add(sp, box(0.1, 0.04, 0.01, 0xe8d090, 0.08, h * 0.65, dp / 2), cyl(0.004, 0.004, 0.35, 0xaaaaaa, 0.1, h + 0.17)); } break;
    case "catkaleng": g.add(cyl(0.14, 0.14, h, 0xbfbfbf, 0, h / 2), cyl(0.141, 0.141, h * 0.5, 0x2a8a3a, 0, h * 0.45)); break;
    case "ban": { const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.1, 10, 20), M(0x1a1a1a)); t.rotation.x = Math.PI / 2; t.position.y = 0.1; g.add(t); } break;
    case "lemari": g.add(box(w, h, dp, 0x4a2a14, 0, h / 2), box(0.01, h * 0.9, 0.01, 0x1a0a04, 0, h / 2, dp / 2 + 0.005), box(0.03, 0.12, 0.03, 0xc9a040, -0.06, h * 0.55, dp / 2 + 0.02), box(0.03, 0.12, 0.03, 0xc9a040, 0.06, h * 0.55, dp / 2 + 0.02), box(w * 1.05, 0.06, dp * 1.05, 0x3a1e0c, 0, h)); break;
    case "kulkas": g.add(box(w, h, dp, 0xe8ece8, 0, h / 2), box(w * 1.001, 0.015, dp * 1.01, 0x9aa0a0, 0, h * 0.68), box(0.03, 0.3, 0.03, 0x9aa0a0, w / 2 - 0.08, h * 0.8, dp / 2 + 0.02), box(0.03, 0.5, 0.03, 0x9aa0a0, w / 2 - 0.08, h * 0.35, dp / 2 + 0.02)); break;
    case "sofa": g.add(box(w, 0.4, dp, 0x6a2030, 0, 0.2), box(w, 0.45, 0.18, 0x6a2030, 0, 0.6, -dp / 2 + 0.09), box(0.18, 0.3, dp, 0x5a1828, -w / 2 + 0.09, 0.5), box(0.18, 0.3, dp, 0x5a1828, w / 2 - 0.09, 0.5), box(w * 0.42, 0.1, dp * 0.7, 0x7a2838, -w * 0.22, 0.45, 0.04), box(w * 0.42, 0.1, dp * 0.7, 0x7a2838, w * 0.22, 0.45, 0.04)); break;
    case "drum": g.add(cyl(0.3, 0.3, h, 0x1f4a7a, 0, h / 2, 0, 18)); for (const y of [0.2, 0.45, 0.7]) g.add(cyl(0.305, 0.305, 0.03, 0x163556, 0, y * h / 0.9, 0, 18)); break;
    case "rak": g.add(box(w, h, 0.03, 0x4a2a14, 0, h / 2, -dp / 2), box(0.04, h, dp, 0x4a2a14, -w / 2, h / 2), box(0.04, h, dp, 0x4a2a14, w / 2, h / 2)); for (let i = 0; i < 5; i++) { const y = 0.05 + i * (h - 0.1) / 4; g.add(box(w, 0.03, dp, 0x5a3418, 0, y)); if (i < 4) for (let k = 0; k < 6; k++) g.add(box(0.05, 0.28, dp * 0.75, [0x8a1a1a, 0x1a4a8a, 0x2a6a2a, 0xa08020][k % 4]!, -w / 2 + 0.1 + k * 0.14, y + 0.16)); } break;
    case "meja": g.add(cyl(w / 2, w / 2, 0.05, 0x5a3418, 0, h - 0.025, 0, 20), cyl(0.05, 0.05, h, 0x4a2a12, 0, h / 2), cyl(0.25, 0.25, 0.03, 0x4a2a12, 0, 0.015)); break;
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData["prop"] = kind; });
  return g;
}

const BADGE = ["#f2c230", "#3a8ef0", "#3ac060", "#e04040"];
function drawTag(g: CanvasRenderingContext2D, num: number, name: string, talk: number, hunter: boolean, dead: boolean) {
  g.clearRect(0, 0, 320, 64); g.font = "bold 28px sans-serif"; g.textBaseline = "middle";
  const nw = Math.min(180, g.measureText(name).width);
  const w = 52 + nw + 16 + 52; const x0 = (320 - w) / 2;
  g.fillStyle = "rgba(10,6,10,.75)"; g.beginPath(); g.roundRect(x0, 8, w, 48, 14); g.fill();
  g.fillStyle = BADGE[(num - 1) % 4]!; g.beginPath(); g.roundRect(x0 + 6, 13, 38, 38, 8); g.fill();
  g.fillStyle = "#111"; g.textAlign = "center"; g.fillText(String(num), x0 + 25, 33);
  g.fillStyle = dead ? "#777" : hunter ? "#ff7060" : "#f4efe6"; g.textAlign = "left"; g.fillText(name, x0 + 52, 33, 180);
  // voice wave bars: flat & dim when quiet, dancing green when on mic
  const bx = x0 + 52 + nw + 14;
  for (let i = 0; i < 5; i++) {
    const hgt = talk ? 8 + Math.abs(Math.sin(talk * 9 + i * 1.7)) * 28 : 5;
    g.fillStyle = talk ? "#5df08a" : "rgba(255,255,255,.25)"; g.fillRect(bx + i * 8, 33 - hgt / 2, 5, hgt);
  }
}

export type PHOther = { id: string; x: number; y: number; yaw: number; pitch: number; moving: boolean; visible: boolean; disguise: PropKind | null; crouch: boolean; hunter: boolean; dead: boolean; num: number; name: string; talking: boolean };

export function createPropScene(canvas: HTMLCanvasElement, me: CharId) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE && !LOW_END });
  renderer.setPixelRatio(pixelRatioFor(getGfx(), window.devicePixelRatio || 1, !!MOBILE, LOW_END));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = LOW_END ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, 0.09);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.03, 70); camera.rotation.order = "YXZ"; scene.add(camera);
  const hemi = new THREE.HemisphereLight(0x2a2440, 0x080404, 0.25); scene.add(hemi);
  const amb = new THREE.AmbientLight(0xfff4e0, 0); scene.add(amb);
  // house
  const wood = tex((g, s) => { g.fillStyle = "#4a2e1e"; g.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(0, i * 32, s, 2); } }, 1);
  for (const r of ROOMS) {
    const t = wood.clone(); t.repeat.set(r.w * U / 2, r.h * U / 2); t.needsUpdate = true;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(r.w * U, r.h * U), Mat({ map: t, roughness: 0.9 })); f.rotation.x = -Math.PI / 2; f.position.set((r.x + r.w / 2) * U, 0, (r.y + r.h / 2) * U); scene.add(f);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(r.w * U, r.h * U), M(0x1a1414)); c.rotation.x = Math.PI / 2; c.position.set(f.position.x, WALL_H, f.position.z); scene.add(c);
    const bulb = new THREE.PointLight(0xffc080, LOW_END ? 1.2 : 1.6, 9, 1.8); bulb.position.set(f.position.x, WALL_H - 0.4, f.position.z); scene.add(bulb);
  }
  const wallMat = Mat({ map: tex((g, s) => { g.fillStyle = "#5a4a40"; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 32) { g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(x, 0, 3, s); } g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, s - 30, s, 30); }, 1), roughness: 0.95 });
  for (const w of WALLS) {
    const isWall = Math.min(w.w, w.h) <= 20; const h = isWall ? WALL_H : 0.9;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w * U, h, w.h * U), isWall ? wallMat : M(0x3a2214)); m.position.set((w.x + w.w / 2) * U, h / 2, (w.y + w.h / 2) * U); scene.add(m);
  }
  const doors = DOORS.map((d, i) => {
    const pivot = new THREE.Group(); const w = DOOR_W * U * 0.96, h = WALL_H * 0.85;
    pivot.add(box(w, h, 0.08, 0x4a2c18, w / 2, h / 2, 0));
    if (d.v) { pivot.position.set(d.x * U, 0, (d.y - DOOR_W / 2 + 1) * U); pivot.rotation.y = -Math.PI / 2; } else pivot.position.set((d.x - DOOR_W / 2) * U, 0, d.y * U);
    scene.add(pivot); return { i, pivot, base: pivot.rotation.y, open: 0 };
  });
  // props
  const propMeshes: THREE.Object3D[] = [];
  for (const p of PROPS) { const g = buildProp(p.kind); g.position.set(p.x * U, p.e, p.y * U); g.rotation.y = p.rot; g.userData["pi"] = p.i; g.traverse((o) => { o.userData["pi"] = p.i; }); scene.add(g); propMeshes.push(g); }
  // layar tancap: white cloth stretched between two bamboo poles on the start room's north wall
  const sc = document.createElement("canvas"); sc.width = 512; sc.height = 288; const sg = sc.getContext("2d")!;
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), new THREE.MeshBasicMaterial({ map: stex, fog: false })); screen.position.set(250 * U, 1.75, 21 * U + 0.15); scene.add(screen);
  for (const sx of [-1, 1]) scene.add(cyl(0.05, 0.06, 3.0, 0x9a7a3a, 250 * U + sx * 1.8, 1.5, 21 * U + 0.18, 8));
  scene.add(box(3.7, 0.05, 0.05, 0x9a7a3a, 250 * U, 2.75, 21 * U + 0.18));
  const glow = new THREE.PointLight(0xc8d8ff, 3, 7); glow.position.set(250 * U, 1.8, 1.6); scene.add(glow);
  // headlamp (unlimited battery) + Desert Eagle in the right hand
  const lamp = new THREE.SpotLight(0xfff1d0, 0, 26, 0.5, 0.45, 1.4); lamp.position.set(0, 0.12, 0); camera.add(lamp);
  const lt = new THREE.Object3D(); lt.position.set(0, 0.05, -5); camera.add(lt); lamp.target = lt;
  const gun = new THREE.Group(); camera.add(gun);
  const steel = Mat({ color: 0x9aa0a8, metalness: 0.85, roughness: 0.3 }), dark = Mat({ color: 0x1c1c20, metalness: 0.5, roughness: 0.5 }), skin = Mat({ color: 0xd9a77e, roughness: 0.7 });
  const gm = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); gun.add(o); return o; };
  gm(new THREE.BoxGeometry(0.045, 0.05, 0.26), steel, 0, 0.03, -0.13); // slide
  gm(new THREE.BoxGeometry(0.04, 0.03, 0.2), dark, 0, -0.005, -0.1);
  gm(new THREE.BoxGeometry(0.038, 0.12, 0.055), dark, 0, -0.07, 0.0).rotation.x = -0.25; // grip
  gm(new THREE.BoxGeometry(0.01, 0.015, 0.01), dark, 0, 0.062, -0.24);
  const fist = gm(new THREE.BoxGeometry(0.07, 0.075, 0.08), skin, 0, -0.07, 0.01); fist.rotation.x = -0.25;
  gm(new THREE.CapsuleGeometry(0.045, 0.3, 4, 10), Mat({ color: 0x1b1b20, roughness: 0.9 }), 0, -0.1, 0.22).rotation.x = Math.PI / 2 - 0.25;
  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95 })); flash.rotation.x = -Math.PI / 2; flash.position.set(0, 0.03, -0.34); flash.visible = false; gun.add(flash);
  const flashL = new THREE.PointLight(0xffa040, 0, 7); flashL.position.set(0, 0.03, -0.4); gun.add(flashL);
  const GUN_POS = new THREE.Vector3(0.2, -0.2, -0.38);
  gun.position.copy(GUN_POS);
  gun.traverse((o) => { o.renderOrder = 10; const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { m.depthTest = false; (m as THREE.MeshStandardMaterial).fog = false; } });
  let kick = 0, flashUntil = 0;
  // impact sparks + remote muzzle flashes
  const sparks: { m: THREE.Mesh; until: number }[] = [];
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd080 });
  const remoteFlash = new THREE.PointLight(0xffa040, 0, 8); scene.add(remoteFlash); let remoteUntil = 0;
  // players
  const ps: Record<string, { av: Avatar | null; props: Partial<Record<PropKind, THREE.Group>>; tag: THREE.Sprite; tagCtx: CanvasRenderingContext2D; tagTex: THREE.CanvasTexture; tagKey: string; light: THREE.SpotLight; target: THREE.Object3D }> = {};
  const raycaster = new THREE.Raycaster(); raycaster.far = 3;
  let bright = false, t = 0;
  return {
    resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); gun.scale.setScalar(w < h ? 0.8 : 1); },
    /** Hiders (and spectators) see the dark house clearly; the hunter only has the headlamp. */
    setVision(isHunter: boolean) {
      bright = !isHunter;
      hemi.intensity = bright ? 1.3 : 0.25; hemi.color.set(bright ? 0xdde6ff : 0x2a2440); amb.intensity = bright ? 0.9 : 0;
      (scene.fog as THREE.FogExp2).density = bright ? 0.02 : 0.09; lamp.intensity = isHunter ? 55 : 0;
    },
    ensure(id: string, k: string) {
      if (ps[id]) return;
      const av = isChar(k) ? buildAvatar(k, Mat as unknown as (p: THREE.MeshStandardMaterialParameters) => THREE.Material, LOW_END) : null; if (av) scene.add(av.root);
      const c = document.createElement("canvas"); c.width = 320; c.height = 64; const ctx = c.getContext("2d")!; const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tt, transparent: true, depthWrite: false, depthTest: false })); tag.scale.set(1.5, 0.3, 1); tag.renderOrder = 5; scene.add(tag);
      const light = new THREE.SpotLight(0xfff1d0, 0, 18, 0.45, 0.5, 1.5); const target = new THREE.Object3D(); scene.add(light, target); light.target = target;
      ps[id] = { av, props: {}, tag, tagCtx: ctx, tagTex: tt, tagKey: "", light, target };
    },
    setScreen(lines: string[], accent = "#f2c230") {
      sg.fillStyle = "#e8e4d8"; sg.fillRect(0, 0, 512, 288); sg.fillStyle = "rgba(0,0,0,.08)"; for (let y = 0; y < 288; y += 6) sg.fillRect(0, y, 512, 2);
      sg.textAlign = "center"; sg.fillStyle = "#1a1014"; sg.font = "bold 30px sans-serif"; sg.fillText(lines[0] ?? "", 256, 60);
      sg.fillStyle = accent; sg.strokeStyle = "#1a1014"; sg.lineWidth = 6; sg.font = "bold 64px sans-serif"; sg.strokeText(lines[1] ?? "", 256, 160, 490); sg.fillText(lines[1] ?? "", 256, 160, 490);
      sg.fillStyle = "#3a2a2a"; sg.font = "bold 26px sans-serif"; sg.fillText(lines[2] ?? "", 256, 235, 490);
      stex.needsUpdate = true;
    },
    fire() { kick = 1; flashUntil = t + 0.06; },
    impact(x: number, y: number, h: number) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), sparkMat); m.position.set(x * U, Math.max(0.03, h), y * U); scene.add(m); sparks.push({ m, until: t + 0.25 }); },
    remoteShot(x: number, y: number) { remoteFlash.position.set(x * U, 1.5, y * U); remoteFlash.intensity = 12; remoteUntil = t + 0.07; },
    /** Prop index under the crosshair within reach (for TIRU OBJEK). */
    aimProp(): number | null { raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); const h = raycaster.intersectObjects(propMeshes, true)[0]; return (h?.object.userData["pi"] as number | undefined) ?? null; },
    frame(st: { dt: number; x: number; y: number; yaw: number; pitch: number; eye: number; moving: boolean; gun: boolean; others: PHOther[]; screen: boolean }) {
      t += st.dt;
      doors.forEach((d) => { d.open += ((doorOpen[d.i] ? 1 : 0) - d.open) * Math.min(1, st.dt * 4); d.pivot.rotation.y = d.base + d.open * 1.6; });
      const bob = st.moving ? Math.sin(t * 9) * 0.03 : 0;
      camera.position.set(st.x * U, st.eye + Math.abs(bob) * (st.eye > 1 ? 1 : 0.2), st.y * U);
      camera.rotation.set(st.pitch + kick * 0.05, st.yaw, 0);
      // recoil: hand + barrel kick up and back, then ease back to aim
      kick = Math.max(0, kick - st.dt * 7);
      gun.visible = st.gun; gun.position.set(GUN_POS.x, GUN_POS.y + kick * 0.03 + bob * 0.3, GUN_POS.z + kick * 0.09); gun.rotation.x = kick * 0.45;
      const fl = t < flashUntil; flash.visible = fl; flash.scale.setScalar(0.8 + Math.random() * 0.6); flashL.intensity = fl ? 14 : 0;
      if (t > remoteUntil) remoteFlash.intensity = 0;
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]!; if (t > s.until) { scene.remove(s.m); sparks.splice(i, 1); } else s.m.scale.setScalar(1 + (s.until - t) * 4); }
      glow.intensity = st.screen ? 3 + Math.sin(t * 20) * 0.6 : 1;
      for (const o of st.others) {
        const p = ps[o.id]; if (!p) continue;
        const ox = o.x * U, oz = o.y * U;
        const showAv = o.visible && !o.disguise;
        if (p.av) { p.av.root.visible = showAv; p.av.root.position.set(ox, 0, oz); p.av.root.rotation.y = o.yaw; p.av.root.scale.set(1, o.crouch ? 0.68 : 1, 1); if (showAv) p.av.update({ dt: st.dt, t, moving: o.moving, pitch: o.pitch, emote: null }); }
        for (const [k, g] of Object.entries(p.props)) g!.visible = o.visible && o.disguise === k;
        if (o.visible && o.disguise) { let g = p.props[o.disguise]; if (!g) { g = p.props[o.disguise] = buildProp(o.disguise); scene.add(g); } g.visible = true; g.position.set(ox, 0, oz); g.rotation.y = o.yaw; }
        // name tag is only shown for undisguised players (a tag over a cup would give it away)
        p.tag.visible = o.visible && !o.disguise;
        if (p.tag.visible) {
          p.tag.position.set(ox, (o.crouch ? 1.3 : 1.95), oz);
          const key = `${o.num}|${o.name}|${o.talking ? Math.floor(t * 8) : 0}|${o.hunter}|${o.dead}`;
          if (key !== p.tagKey) { p.tagKey = key; drawTag(p.tagCtx, o.num, o.name, o.talking ? t : 0, o.hunter, o.dead); p.tagTex.needsUpdate = true; }
        }
        p.light.intensity = o.visible && o.hunter ? 30 : 0;
        p.light.position.set(ox, 1.7, oz); p.target.position.set(ox - Math.sin(o.yaw) * 5, 1.2 + Math.sin(o.pitch) * 5, oz - Math.cos(o.yaw) * 5);
      }
      renderer.render(scene, camera);
    },
    get bright() { return bright; },
    dispose() { renderer.dispose(); },
  };
}
export type PropScene = ReturnType<typeof createPropScene>;
