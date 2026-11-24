import { useState } from "react";
import { Bot, Gamepad2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MAPS } from "@/lib/game";
import { PETAK } from "@/lib/prophunt";
import { TEAM_MODES, type TeamMode } from "@/lib/team-mode";

export type ModeChoice = { map: string; team: TeamMode; bots: boolean };

export function mapLabel(map?: string) { return map === PETAK ? "Petak Umpet" : `Klasik: ${MAPS.find((m) => m.id === map)?.nama ?? "Rumah Tua"}`; }
export function teamLabel(team: TeamMode, bots: boolean) { return team === "solo" ? `SOLO (${bots ? "Bot Aktif" : "Tanpa Bot"})` : team.toUpperCase(); }

/** Free Fire-style single mode card: tap it to open the mode / map / team-size picker. */
export function ModePicker({ value, isHost, disabled, humans, onConfirm }: { value: ModeChoice; isHost: boolean; disabled: boolean; humans: number; onConfirm: (v: ModeChoice) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const opt = (on: boolean) => `rounded-lg border-2 p-2 text-left text-xs font-bold transition ${on ? "border-gold bg-gold/20 text-gold" : "border-border bg-background/40 hover:border-primary/60"}`;
  return (
    <>
      <button disabled={!isHost || disabled} onClick={() => { setDraft(value); setOpen(true); }} className="game-panel w-full rounded-lg p-2 text-left disabled:opacity-90">
        <div className="flex items-center justify-between text-[10px] font-bold text-gold"><span className="flex items-center gap-1"><Gamepad2 className="size-3.5" />MODE PERMAINAN</span>{isHost ? <span className="rounded border border-gold/60 px-1.5">UBAH</span> : <span className="text-muted-foreground">dipilih kapten</span>}</div>
        <div className="mt-1 truncate text-xs font-bold">{mapLabel(value.map)}</div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users className="size-3" />{teamLabel(value.team, value.bots)}</div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle className="font-horror text-2xl tracking-wider text-gold">PILIH MODE</DialogTitle></DialogHeader>
          <div className="text-[11px] font-bold text-muted-foreground">KLASIK — BERBURU HANTU</div>
          <div className="grid grid-cols-2 gap-1.5">
            {MAPS.map((m) => <button key={m.id} onClick={() => setDraft({ ...draft, map: m.id })} className={opt(draft.map === m.id)}>{m.nama}<div className="text-[9px] font-normal text-muted-foreground">{m.desc}</div></button>)}
          </div>
          <div className="text-[11px] font-bold text-muted-foreground">MODE SPESIAL</div>
          <button onClick={() => setDraft({ ...draft, map: PETAK })} className={opt(draft.map === PETAK)}>PETAK UMPET<div className="text-[9px] font-normal text-muted-foreground">Sembunyi jadi objek, pemburu bawa pistol & senter kepala.</div></button>
          <div className="text-[11px] font-bold text-muted-foreground">FORMAT TIM</div>
          <div className="grid grid-cols-3 gap-1.5">
            {TEAM_MODES.map((t) => {
              const tooSmall = humans > t.max;
              return <button key={t.id} disabled={tooSmall} onClick={() => setDraft({ ...draft, team: t.id })} className={`${opt(draft.team === t.id)} disabled:opacity-40`}>{t.nama}<div className="text-[9px] font-normal text-muted-foreground">{tooSmall ? `Squad sudah ${humans} orang` : t.desc}</div></button>;
            })}
          </div>
          {draft.team === "solo" && (
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setDraft({ ...draft, bots: true })} className={opt(draft.bots)}><Bot className="mb-0.5 size-4" />IZINKAN BOT<div className="text-[9px] font-normal text-muted-foreground">Ditemani 3 bot.</div></button>
              <button onClick={() => setDraft({ ...draft, bots: false })} className={opt(!draft.bots)}><Bot className="mb-0.5 size-4 opacity-40" />TANPA BOT<div className="text-[9px] font-normal text-muted-foreground">Benar-benar sendirian.</div></button>
            </div>
          )}
          <Button size="lg" className="font-horror text-xl" onClick={() => { onConfirm(draft); setOpen(false); }}>KONFIRMASI</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
