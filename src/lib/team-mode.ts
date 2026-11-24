export type TeamMode = "solo" | "duo" | "squad";
export const TEAM_MODES: { id: TeamMode; nama: string; max: number; desc: string }[] = [
  { id: "solo", nama: "SOLO", max: 1, desc: "Main sendiri. Bisa ditemani bot." },
  { id: "duo", nama: "DUO", max: 2, desc: "Berdua dengan teman. Tanpa bot." },
  { id: "squad", nama: "SQUAD", max: 4, desc: "Sampai 4 pemain. Tanpa bot." },
];
export const isTeamMode = (v: unknown): v is TeamMode => TEAM_MODES.some((m) => m.id === v);
export const teamMax = (m: unknown) => TEAM_MODES.find((t) => t.id === m)?.max ?? 4;
/** Bots only in SOLO, only with exactly one human, and only when the captain allows them. */
export const botsActive = (mode: unknown, allowed: boolean, humans: number) => mode === "solo" && allowed && humans === 1;
