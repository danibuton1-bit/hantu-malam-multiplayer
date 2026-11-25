import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./account";

export type AnnouncementCategory = "info" | "update" | "event";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  sender_nama: string;
  created_at: string;
};

export const ANNOUNCEMENT_CATS: Record<AnnouncementCategory, { label: string; cls: string }> = {
  info: { label: "INFO", cls: "bg-primary/20 text-primary border-primary/40" },
  update: { label: "UPDATE", cls: "bg-gold/20 text-gold border-gold/40" },
  event: { label: "EVENT", cls: "bg-destructive/20 text-destructive border-destructive/40" },
};

const READ_KEY = "hm_read_announcements";

export function normalizeCategory(v: string): AnnouncementCategory {
  return v === "update" || v === "event" ? v : "info";
}

export function validateAnnouncement(title: string, body: string): string | null {
  const t = title.trim();
  const b = body.trim();
  if (!t) return "Judul pengumuman wajib diisi.";
  if (t.length > 120) return "Judul maksimal 120 karakter.";
  if (!b) return "Isi pesan wajib diisi.";
  if (b.length > 2000) return "Isi pesan maksimal 2000 karakter.";
  return null;
}

export function getReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): Set<string> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-200)));
    } catch { /* ignore storage quota errors */ }
  }
  return ids;
}

export function markRead(id: string, prev?: Set<string>): Set<string> {
  const next = new Set(prev ?? getReadIds());
  next.add(id);
  return saveReadIds(next);
}

export function markAllRead(ids: string[], prev?: Set<string>): Set<string> {
  const next = new Set(prev ?? getReadIds());
  for (const id of ids) next.add(id);
  return saveReadIds(next);
}

export function unreadCount(items: { id: string }[], readIds: Set<string>): number {
  let n = 0;
  for (const item of items) if (!readIds.has(item.id)) n++;
  return n;
}

export function formatMailDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("system_announcements")
    .select("id,title,body,category,sender_nama,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, category: normalizeCategory(r.category) }));
}

export async function publishAnnouncement(
  account: Pick<Profile, "id" | "kode_id">,
  input: { title: string; body: string; category: AnnouncementCategory },
): Promise<Announcement> {
  const err = validateAnnouncement(input.title, input.body);
  if (err) throw new Error(err);
  const { data, error } = await supabase.rpc("publish_announcement", {
    p_id: account.id,
    p_kode: account.kode_id,
    p_title: input.title.trim(),
    p_body: input.body.trim(),
    p_category: input.category,
  });
  if (error || !data) throw new Error(error?.message ?? "Gagal mengirim pengumuman.");
  return { ...data, category: normalizeCategory(data.category) };
}

export async function deleteAnnouncement(account: Pick<Profile, "id" | "kode_id">, id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_announcement", {
    p_id: account.id,
    p_kode: account.kode_id,
    p_announcement_id: id,
  });
  if (error) throw new Error(error.message);
}