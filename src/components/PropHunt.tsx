import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Lock, LogOut, Package, Unlock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { audio } from "@/lib/audio";
import { applyMap, BOT_PATROL, circleHitsRect, DOORS, move, setDoorOpen, WALLS } from "@/lib/game";
import { BLOCKING, firstHunter, hiderTarget, HIDE_MS, nearestProp, nextHunter, phaseAt, PROPS, PROP_DEFS, RESULT_MS, ROLL_MS, shoot, squadNumbers, START_SPOTS, EYE_CROUCH, EYE_STAND, type Phase, type PropKind } from "@/lib/prophunt";
import { createPropScene } from "@/lib/prophunt3d";
import { LOW_END } from "@/lib/scene3d";
import { speaking } from "@/lib/voice";
import { toContent } from "@/lib/orient";
import { BOT_MATE_PREFIX, squadBots, type GamePlayer } from "./Game";
import { Joystick } from "./Joystick";
import { MicButton } from "./MicButton";
import { MuteButton } from "./MuteButton";
import { Button } from "./ui/button";

type Live = { x: number; y: number; tx: number; ty: number; yaw: number; pitch: number; moving: boolean; disguise: PropKind | null; crouch: boolean; dead: boolean; locked: boolean };
type Round = { n: number; hunter: string; t0: number };
const SPEED = 150;
const START_DOORS = DOORS.map((d, i) => ({ d, i })).filter(({ d }) => (d.x === 500 && d.y === 250) || (d.x === 250 && d.y === 500)).map((o) => o.i);
const freeAt = (x: number, y: number) => ![...WALLS, ...BLOCKING].some((w) => circleHitsRect(x, y, 16, w));

export function PropHunt({ code, me, players, startedAt, isHost, onBackToLobby, onLeave, bots = false }: {
  code: string; me: string; players: GamePlayer[]; startedAt: number; isHost: boolean; onBackToLobby: () => void; onLeave: () => void; bots?: boolean;
}) {
  applyMap("rumah");
  const all = useMemo(() => [...players, ...squadBots(players, bots)], [players, bots]);
  const nums = useMemo(() => squadNumbers(all.map((p) => p.id), startedAt), [all, startedAt]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joy = useRef({ x: 0, y: 0 });
  const keys = useRef<Record<string, boolean>>({});
  const act = useRef({ shoot: () => {}, crouch: () => {}, copy: () => {}, uncopy: () => {}, lock: () => {} });
  const [isTouch, setIsTouch] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hud, setHud] = useState({ phase: "roll" as Phase, left: 0, n: 1, hunter: "", dead: {} as Record<string, boolean>, talk: {} as Record<string, boolean>, crouch: false, disguise: null as PropKind | null, locked: false, near: "" });
  const [result, setResult] = useState<{ winner: "hunter" | "hiders"; next: string } | null>(null);
  useEffect(() => { setIsTouch(window.matchMedia("(pointer: coarse)").matches); }, []);
  const nama = (id: string) => (id === me ? "Kamu" : all.find((p) => p.id === id)?.nama ?? "?");

  useEffect(() => {
    audio.init();
    const sc = createPropScene(canvasRef.current!, all.find((p) => p.id === me)?.karakter ?? "raka");
    all.forEach((p) => { if (p.id !== me) sc.ensure(p.id, p.karakter); });
    sc.resize(); const onResize = () => sc.resize(); window.addEventListener("resize", onResize);
    const live: Record<string, Live> = {};
    all.forEach((p) => { live[p.id] = { x: 0, y: 0, tx: 0, ty: 0, yaw: Math.PI, pitch: 0, moving: false, disguise: null, crouch: false, dead: false, locked: false }; });
    const meL = live[me]!;
    let round: Round = { n: 1, hunter: firstHunter(all.map((p) => p.id), startedAt), t0: startedAt };
    let elimOrder: string[] = [], ended = false, endAt = 0, lastPhase: Phase | "" = "", roundKey = "";
    let toastT = 0; const notify = (m: string) => { setToast(m); clearTimeout(toastT); toastT = window.setTimeout(() => setToast(null), 2600); };
    const ch = supabase.channel(`game-${code}`, { config: { broadcast: { self: false } } });
    const send = (event: string, payload: object) => void ch.send({ type: "broadcast", event, payload });

    const startRound = (r: Round) => {
      round = r; elimOrder = []; ended = false; roundKey = `${r.n}`; setResult(null);
      all.forEach((p, i) => { const s = START_SPOTS[i % START_SPOTS.length]!; Object.assign(live[p.id]!, { x: s.x, y: s.y, tx: s.x, ty: s.y, yaw: Math.PI, disguise: null, crouch: false, dead: false, locked: false }); });
      // all doors stay open in this mode, except the start room's automatic doors which open when hiding begins
      DOORS.forEach((_, i) => setDoorOpen(i, !START_DOORS.includes(i)));
      sc.setVision(r.hunter === me); lastPhase = "";
    };
    startRound(round);
    const elim = (id: string, by: string, broadcast: boolean) => {
      const l = live[id]; if (!l || l.dead || ended) return;
      l.dead = true; l.disguise = null; elimOrder.push(id); audio.scream();
      notify(id === me ? "KAMU TERTEMBAK! Kamu jadi penonton." : `${nama(by)} menembak ${nama(id)}!`);
      if (id === me) sc.setVision(false);
      if (broadcast) send("elim", { id, by, n: round.n });
    };
    ch.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id: string; x: number; y: number; a: number; p: number; m: boolean; d: string; c: number; n: number };
      const l = live[p.id]; if (!l || p.id === me || p.n !== round.n) return;
      l.tx = p.x; l.ty = p.y; l.yaw = p.a; l.pitch = p.p; l.moving = p.m; l.disguise = (p.d || null) as PropKind | null; l.crouch = !!p.c;
    });
    ch.on("broadcast", { event: "shot" }, ({ payload }) => {
      const p = payload as { x: number; y: number; ix: number; iy: number; ih: number };
      sc.remoteShot(p.x, p.y); sc.impact(p.ix, p.iy, p.ih); audio.gunshot(Math.hypot(p.x - meL.x, p.y - meL.y));
    });
    ch.on("broadcast", { event: "elim" }, ({ payload }) => { const p = payload as { id: string; by: string; n: number }; if (p.n === round.n) elim(p.id, p.by, false); });
    ch.on("broadcast", { event: "round" }, ({ payload }) => { const r = payload as Round; if (r.n > round.n) startRound(r); });
    ch.subscribe();

    // ---- actions
    let shotCd = 0;
    const fireFrom = (id: string, l: Live, yaw: number, pitch: number) => {
      const eye = l.crouch ? EYE_CROUCH : EYE_STAND;
      const targets = all.filter((p) => p.id !== round.hunter && !live[p.id]!.dead).map((p) => { const o = live[p.id]!; return hiderTarget(p.id, o.x, o.y, o.disguise, o.crouch); });
      const r = shoot(l.x, l.y, eye, yaw, pitch, targets);
      send("shot", { id, x: Math.round(l.x), y: Math.round(l.y), ix: Math.round(r.x), iy: Math.round(r.y), ih: Math.round(r.h * 100) / 100 });
      sc.impact(r.x, r.y, r.h);
      if (id === me) { sc.fire(); audio.gunshot(); } else { sc.remoteShot(l.x, l.y); audio.gunshot(Math.hypot(l.x - meL.x, l.y - meL.y)); }
      if (r.id) elim(r.id, id, true);
    };
    const amHunter = () => round.hunter === me;
    act.current.shoot = () => {
      const n = performance.now(); if (!amHunter() || meL.dead || ended || n < shotCd || phaseAt(round.t0, Date.now()).phase !== "hunt") return;
      shotCd = n + 380; fireFrom(me, meL, meL.yaw, pitch);
    };
    act.current.crouch = () => { if (!meL.disguise) meL.crouch = !meL.crouch; };
    act.current.copy = () => {
      if (amHunter() || meL.dead) return;
      const ai = sc.aimProp(); const p = ai !== null ? PROPS[ai] : nearestProp(meL.x, meL.y);
      if (!p) { notify("Dekati sebuah objek dulu."); return; }
      meL.disguise = p.kind; meL.crouch = false; audio.pickup(); notify(`Kamu menjadi ${PROP_DEFS[p.kind].nama}`);
    };
    act.current.uncopy = () => { meL.disguise = null; meL.locked = false; };
    act.current.lock = () => { if (amHunter() || meL.dead) return; meL.locked = !meL.locked; audio.click(); notify(meL.locked ? "Posisi dikunci. Kamu masih bisa melihat sekeliling." : "Kunci dilepas."); };

    // ---- look controls
    let pitch = 0; const cv = canvasRef.current!;
    const look = (dx: number, dy: number) => { meL.yaw -= dx * 0.0042; pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.0042)); };
    const onMouse = (e: MouseEvent) => { if (document.pointerLockElement === cv) look(e.movementX * 0.6, e.movementY * 0.6); };
    const onClick = () => { if (window.matchMedia("(pointer: coarse)").matches) return; if (document.pointerLockElement === cv) act.current.shoot(); else void cv.requestPointerLock?.(); };
    let touchId: number | null = null, tx0 = 0, ty0 = 0;
    const onPD = (e: PointerEvent) => { if (e.pointerType === "mouse") return; touchId = e.pointerId; tx0 = e.clientX; ty0 = e.clientY; };
    const onPM = (e: PointerEvent) => { if (e.pointerId !== touchId) return; const d = toContent(e.clientX - tx0, e.clientY - ty0); look(d.x * 1.4, d.y * 1.4); tx0 = e.clientX; ty0 = e.clientY; };
    const onPU = (e: PointerEvent) => { if (e.pointerId === touchId) touchId = null; };
    cv.addEventListener("pointerdown", onPD); window.addEventListener("pointermove", onPM); window.addEventListener("pointerup", onPU);
    document.addEventListener("mousemove", onMouse); cv.addEventListener("click", onClick);
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); keys.current[k] = true;
      if (k === "c" || k === "control") act.current.crouch();
      if (k === "f") { if (meL.disguise) act.current.uncopy(); else act.current.copy(); }
      if (k === "x" || k === "l") act.current.lock();
      if (k === " ") act.current.shoot();
      if (k.startsWith("arrow")) e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

    // ---- bots (host only): hiders copy a prop next to a real one; a bot hunter patrols and shoots
    const bots = all.filter((p) => p.id.startsWith(BOT_MATE_PREFIX)).map((p, i) => ({ id: p.id, wp: (i * 4) % BOT_PATROL.length, hidden: "", shot: 0, send: 0, dir: 0, stuck: 0 }));
    const runBots = (now: number, dt: number, ph: Phase) => {
      for (const b of bots) {
        const l = live[b.id]!;
        if (!l.dead && b.id !== round.hunter && ph !== "roll" && b.hidden !== roundKey && now - round.t0 > ROLL_MS + 2500 + bots.indexOf(b) * 1500) {
          b.hidden = roundKey;
          for (let tries = 0; tries < 40; tries++) {
            const p = PROPS[Math.floor(Math.random() * PROPS.length)]!; const d = PROP_DEFS[p.kind];
            if (p.e > 0 || d.w > 40 || p.x < 520 && p.y < 520) continue;
            const a = Math.random() * 6.28, x = p.x + Math.cos(a) * (d.w + 20), y = p.y + Math.sin(a) * (d.w + 20);
            if (!freeAt(x, y)) continue;
            Object.assign(l, { x, y, tx: x, ty: y, disguise: p.kind, locked: true, yaw: p.rot }); break;
          }
        }
        if (!l.dead && b.id === round.hunter && ph === "hunt") {
          const w = BOT_PATROL[b.wp]!; if (Math.hypot(w[0] - l.x, w[1] - l.y) < 40) b.wp = (b.wp + 1) % BOT_PATROL.length;
          let ang = Math.atan2(w[1] - l.y, w[0] - l.x) + b.dir; const sp = SPEED * 0.7 * dt;
          const p = move(l.x, l.y, Math.cos(ang) * sp, Math.sin(ang) * sp);
          if (Math.hypot(p.x - l.x, p.y - l.y) < sp * 0.3) { b.stuck += dt; if (b.stuck > 0.3) { b.dir = b.dir ? -b.dir : Math.PI / 2; b.stuck = 0; } } else if (b.dir && Math.random() < dt) b.dir = 0;
          ang = Math.atan2(p.y - l.y, p.x - l.x); l.x = l.tx = p.x; l.y = l.ty = p.y; l.moving = true; l.yaw = -ang - Math.PI / 2;
          if (now > b.shot) {
            b.shot = now + 1300;
            const prey = all.filter((q) => q.id !== b.id && !live[q.id]!.dead).map((q) => ({ id: q.id, o: live[q.id]!, d: Math.hypot(live[q.id]!.x - l.x, live[q.id]!.y - l.y) })).filter((q) => q.d < 260).sort((a, c) => a.d - c.d)[0];
            if (prey) {
              const yaw = Math.atan2(-(prey.o.x - l.x), -(prey.o.y - l.y)); const hh = prey.o.disguise ? PROP_DEFS[prey.o.disguise].h / 2 : 1.1;
              const aim = Math.atan((hh - EYE_STAND) / (prey.d / 50));
              const chance = prey.o.disguise ? (prey.o.moving ? 0.6 : 0.3) : 0.75;
              const miss = Math.random() > chance ? (Math.random() - 0.5) * 0.5 : 0;
              l.yaw = yaw; fireFrom(b.id, l, yaw + miss, aim);
            } else if (Math.random() < 0.15) fireFrom(b.id, l, l.yaw + (Math.random() - 0.5), -0.3);
          }
        } else l.moving = false;
        if (now - b.send > 100) { b.send = now; send("pos", { id: b.id, x: Math.round(l.x), y: Math.round(l.y), a: Math.round(l.yaw * 100) / 100, p: 0, m: l.moving, d: l.disguise ?? "", c: 0, n: round.n }); }
      }
    };

    let raf = 0, last = performance.now(), hudT = 0, sendT = 0, stepT = 0, roundT = 0, rollT = 0, rollI = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (LOW_END && now - last < 30) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { phase, left } = phaseAt(round.t0, Date.now());
      const iHunt = amHunter();
      if (phase !== lastPhase) {
        if (phase === "hide") { START_DOORS.forEach((i) => setDoorOpen(i, true)); audio.creak(); notify(iHunt ? "Tunggu 20 detik! Para pemain sedang bersembunyi..." : "PINTU TERBUKA! Cepat sembunyi dan tiru objek!"); }
        if (phase === "hunt") { audio.matchStart(); notify(iHunt ? "BURU MEREKA! Tembak objek yang mencurigakan." : "Pemburu datang! Jangan bergerak."); }
        lastPhase = phase;
      }
      // layar tancap: shuffle names, then reveal who hunts
      if (phase === "roll" && now > rollT) {
        const e = Date.now() - round.t0;
        if (e < ROLL_MS - 2200) { rollT = now + 110; rollI++; const p = all[rollI % all.length]!; sc.setScreen([`RONDE ${round.n} · SIAPA PEMBURUNYA?`, p.nama.toUpperCase(), round.n === 1 ? "Diacak oleh layar tancap..." : "Yang kalah jadi pemburu"], "#f2f2f2"); audio.tick(); }
        else { rollT = now + 500; sc.setScreen([`RONDE ${round.n} · PEMBURU`, nama(round.hunter).toUpperCase(), "Yang lain: SEMBUNYI & TIRU OBJEK!"], "#e04040"); }
      } else if (phase === "hide" && now > rollT) { rollT = now + 500; sc.setScreen(["WAKTU SEMBUNYI", `${Math.ceil(left / 1000)} detik`, `Pemburu: ${nama(round.hunter)}`], "#f2c230"); }
      // movement
      const k = keys.current;
      let ix = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0) + joy.current.x;
      let iy = (k["s"] || k["arrowdown"] ? 1 : 0) - (k["w"] || k["arrowup"] ? 1 : 0) + joy.current.y;
      const mag = Math.hypot(ix, iy); if (mag > 1) { ix /= mag; iy /= mag; }
      const canMove = !meL.dead && !ended && !meL.locked && !(iHunt && phase !== "hunt") && phase !== "done";
      meL.moving = canMove && mag > 0.1;
      if (meL.moving) {
        const sp = SPEED * (meL.crouch ? 0.5 : 1) * dt, fw = -iy, sy = Math.sin(meL.yaw), cy = Math.cos(meL.yaw);
        const p = move(meL.x, meL.y, (fw * -sy + ix * cy) * sp, (fw * -cy - ix * sy) * sp); meL.x = meL.tx = p.x; meL.y = meL.ty = p.y;
        if (now - stepT > (meL.crouch ? 600 : 360)) { stepT = now; audio.step(); }
      }
      for (const [id, l] of Object.entries(live)) if (id !== me && !id.startsWith(BOT_MATE_PREFIX)) { l.x += (l.tx - l.x) * Math.min(1, dt * 12); l.y += (l.ty - l.y) * Math.min(1, dt * 12); }
      if (isHost && !ended) runBots(now, dt, phase);
      if (now - sendT > 100) { sendT = now; send("pos", { id: me, x: Math.round(meL.x), y: Math.round(meL.y), a: Math.round(meL.yaw * 100) / 100, p: Math.round(pitch * 100) / 100, m: meL.moving, d: meL.disguise ?? "", c: meL.crouch ? 1 : 0, n: round.n }); }
      // round end: every hider shot, or the hunt timer ran out
      const hiders = all.filter((p) => p.id !== round.hunter);
      if (!ended && ((phase === "hunt" && hiders.every((p) => live[p.id]!.dead)) || phase === "done")) {
        ended = true; endAt = now;
        const winner = hiders.every((p) => live[p.id]!.dead) ? "hunter" as const : "hiders" as const;
        setResult({ winner, next: nextHunter(round.hunter, elimOrder) }); audio.creak();
      }
      if (ended && isHost && now - endAt > RESULT_MS && endAt > 0) { endAt = -1; const r = { n: round.n + 1, hunter: nextHunter(round.hunter, elimOrder), t0: Date.now() + 400 }; send("round", r); startRound(r); }
      if (isHost && now - roundT > 3000) { roundT = now; send("round", round); }
      const eye = meL.disguise ? Math.max(0.22, PROP_DEFS[meL.disguise].h * 0.85 + 0.08) : meL.crouch ? EYE_CROUCH : EYE_STAND;
      sc.frame({ dt, x: meL.x, y: meL.y, yaw: meL.yaw, pitch, eye, moving: meL.moving, gun: iHunt && !meL.dead, screen: phase === "roll" || phase === "hide",
        others: all.filter((p) => p.id !== me).map((p) => { const l = live[p.id]!; return { id: p.id, x: l.x, y: l.y, yaw: l.yaw, pitch: l.pitch, moving: l.moving, visible: !l.dead, disguise: l.disguise, crouch: l.crouch, hunter: p.id === round.hunter, dead: l.dead, num: nums[p.id] ?? 1, name: p.nama, talking: !!speaking[p.id] }; }) });
      if (now - hudT > 200) {
        hudT = now;
        const np = !iHunt && !meL.disguise ? nearestProp(meL.x, meL.y) : null;
        setHud({ phase, left: Math.ceil(left / 1000), n: round.n, hunter: round.hunter, dead: Object.fromEntries(Object.entries(live).map(([id, l]) => [id, l.dead])), talk: Object.fromEntries(all.map((p) => [p.id, !!speaking[p.id]])), crouch: meL.crouch, disguise: meL.disguise, locked: meL.locked, near: np ? PROP_DEFS[np.kind].nama : "" });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(toastT); sc.dispose();
      window.removeEventListener("resize", onResize); document.removeEventListener("mousemove", onMouse); cv.removeEventListener("click", onClick);
      cv.removeEventListener("pointerdown", onPD); window.removeEventListener("pointermove", onPM); window.removeEventListener("pointerup", onPU);
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      if (document.pointerLockElement) void document.exitPointerLock();
      void supabase.removeChannel(ch); audio.stopAll();
    };
  }, [code, me, players.map((p) => p.id).join(), startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const iHunt = hud.hunter === me, iDead = !!hud.dead[me];
  const phaseName = hud.phase === "roll" ? "PENGACAKAN" : hud.phase === "hide" ? "WAKTU SEMBUNYI" : hud.phase === "hunt" ? "PERBURUAN" : "SELESAI";
  const bars = (on: boolean) => <span className="flex h-3 items-end gap-px">{[0, 1, 2, 3].map((i) => <span key={i} className={`w-0.5 rounded-sm ${on ? "animate-pulse bg-chart-4" : "bg-muted-foreground/40"}`} style={{ height: on ? `${40 + ((i * 37) % 60)}%` : "25%", animationDelay: `${i * 90}ms` }} />)}</span>;
  const btn = "pointer-events-auto flex flex-col items-center justify-center rounded-full border-2 text-[10px] font-bold";
  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void">
      <canvas ref={canvasRef} className="h-full w-full touch-none" style={{ filter: iDead ? "grayscale(1)" : undefined }} />
      {iHunt && hud.phase !== "hunt" && hud.phase !== "done" && hud.phase === "hide" && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-void/95 text-center"><div className="font-horror text-3xl text-primary">KAMU PEMBURU</div><div className="mt-2 font-horror text-8xl text-gold">{hud.left}</div><p className="mt-2 text-sm text-muted-foreground">Mata ditutup. Para pemain sedang bersembunyi...</p></div>}
      <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-2">
        <div className="rounded-lg bg-card/85 px-3 py-1.5 text-xs">
          <div className="font-bold text-gold">PETAK UMPET · RONDE {hud.n}</div>
          <div>{phaseName}{hud.phase !== "done" && hud.phase !== "roll" ? ` · ${Math.floor(hud.left / 60)}:${String(hud.left % 60).padStart(2, "0")}` : ""}</div>
          <div className={iHunt ? "text-primary" : "text-chart-4"}>{iDead ? "PENONTON" : iHunt ? "PEMBURU · senter kepala & Desert Eagle ∞" : hud.disguise ? `BERSEMBUNYI · ${PROP_DEFS[hud.disguise].nama}` : "BERSEMBUNYI"}</div>
        </div>
        <div className="flex flex-1 flex-wrap justify-center gap-1">
          {all.map((p) => (
            <div key={p.id} className={`flex items-center gap-1 rounded bg-card/85 px-1.5 py-0.5 text-[11px] ${hud.dead[p.id] ? "opacity-40 line-through" : ""}`}>
              <span className={`flex size-4 items-center justify-center rounded text-[10px] font-black text-background ${["bg-gold", "bg-chart-2", "bg-chart-4", "bg-primary"][((nums[p.id] ?? 1) - 1) % 4]}`}>{nums[p.id]}</span>
              <span className="max-w-16 truncate">{p.id === me ? `${p.nama} (kamu)` : p.nama}</span>
              {p.id === hud.hunter && <Crosshair className="size-3 text-primary" />}
              {bars(!!hud.talk[p.id])}
            </div>
          ))}
        </div>
        <MicButton code={code} me={me} className="pointer-events-auto" />
        <MuteButton className="pointer-events-auto" />
        <button onClick={isHost ? onBackToLobby : onLeave} aria-label="Keluar" className="flex size-9 items-center justify-center rounded-full border border-border bg-card/80"><LogOut className="size-4" /></button>
      </div>
      {iHunt && !iDead ? <Crosshair className="pointer-events-none absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-foreground/70" /> : <div className="pointer-events-none absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/60" />}
      {toast && <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-lg border border-gold bg-card/90 px-4 py-2 text-center text-sm font-bold text-gold">{toast}</div>}
      {!iHunt && !iDead && hud.phase !== "roll" && !hud.disguise && hud.near && <div className="pointer-events-none absolute bottom-44 left-1/2 -translate-x-1/2 rounded bg-void/70 px-2 py-1 text-xs text-gold">Dekat: {hud.near} · tekan TIRU OBJEK{isTouch ? "" : " (F)"}</div>}
      {!iDead && !result && (
        <div className="absolute bottom-6 right-4 flex items-end gap-2">
          {!hud.disguise && <button onPointerDown={(e) => { e.stopPropagation(); act.current.crouch(); }} className={`${btn} size-14 ${hud.crouch ? "border-gold bg-gold/30 text-gold" : "border-border bg-card/80 text-foreground"}`}>⌄<span>JONGKOK</span></button>}
          {!iHunt && hud.phase !== "roll" && (hud.disguise ? <>
            <button onPointerDown={(e) => { e.stopPropagation(); act.current.lock(); }} className={`${btn} size-14 ${hud.locked ? "border-gold bg-gold/30 text-gold" : "border-border bg-card/80 text-foreground"}`}>{hud.locked ? <Lock className="size-5" /> : <Unlock className="size-5" />}{hud.locked ? "TERKUNCI" : "KUNCI"}</button>
            <button onPointerDown={(e) => { e.stopPropagation(); act.current.uncopy(); }} className={`${btn} size-14 border-border bg-card/80 text-foreground`}><X className="size-5" />BATAL</button>
          </> : <button onPointerDown={(e) => { e.stopPropagation(); act.current.copy(); }} className={`${btn} size-20 border-chart-4 bg-chart-4/30 text-foreground`}><Package className="size-6" />TIRU OBJEK</button>)}
          {iHunt && hud.phase === "hunt" && <button onPointerDown={(e) => { e.stopPropagation(); act.current.shoot(); }} className={`${btn} size-20 border-primary bg-blood/80 text-primary-foreground glow-blood`}><Crosshair className="size-7" />TEMBAK</button>}
        </div>
      )}
      {isTouch && <div className="absolute bottom-6 left-6"><Joystick vec={joy} /></div>}
      {!isTouch && <div className="absolute bottom-3 left-3 text-xs text-muted-foreground">WASD jalan · mouse lihat · klik/Spasi tembak · C jongkok · F tiru objek · X kunci posisi</div>}
      {result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void/85 p-6 text-center">
          <h1 className={`font-horror text-5xl ${result.winner === "hunter" ? "text-primary" : "text-gold"}`}>{result.winner === "hunter" ? "PEMBURU MENANG!" : "YANG BERSEMBUNYI MENANG!"}</h1>
          <p className="text-muted-foreground">Ronde berikutnya pemburunya: <b className="text-foreground">{nama(result.next)}</b></p>
          <p className="text-xs text-muted-foreground">Ronde baru dimulai sebentar lagi...</p>
          <div className="flex gap-2">{isHost && <Button variant="secondary" onClick={onBackToLobby}>Kembali ke Lobby</Button>}<Button variant="secondary" onClick={onLeave}>Keluar</Button></div>
        </div>
      )}
    </div>
  );
}
