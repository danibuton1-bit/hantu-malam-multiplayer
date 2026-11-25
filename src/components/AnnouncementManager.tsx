import { useCallback, useEffect, useState } from "react";
import { Mail, Send, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import type { Profile } from "@/lib/account";
import {
  ANNOUNCEMENT_CATS,
  deleteAnnouncement,
  fetchAnnouncements,
  formatMailDate,
  publishAnnouncement,
  type Announcement,
  type AnnouncementCategory,
} from "@/lib/announcements";

const CATS: AnnouncementCategory[] = ["info", "update", "event"];

/** Panel admin untuk mengirim dan menghapus pengumuman ke kotak pesan masuk semua pemain. */
export function AnnouncementManager({ account }: { account: Profile }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("info");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    try { setItems(await fetchAnnouncements()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Gagal memuat pengumuman."); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOk("");
    setBusy(true);
    try {
      const created = await publishAnnouncement(account, { title, body, category });
      setItems((prev) => [created, ...prev]);
      setTitle(""); setBody(""); setCategory("info");
      setOk("Pengumuman terkirim ke semua pemain.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gagal mengirim pengumuman.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setErr(""); setOk("");
    try {
      await deleteAnnouncement(account, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setOk("Pengumuman dihapus.");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gagal menghapus pengumuman.");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-gold"><Mail className="size-4" /> PUSAT PENGUMUMAN (PESAN MASUK)</h2>
      <form onSubmit={(e) => void submit(e)} className="space-y-2.5">
        <div className="flex gap-1.5">
          {CATS.map((c) => (
            <Button key={c} type="button" size="sm" variant={category === c ? "default" : "secondary"} className="h-7 text-xs" onClick={() => setCategory(c)}>
              {ANNOUNCEMENT_CATS[c].label}
            </Button>
          ))}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Judul pengumuman (misal: Update Map Baru)"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Tulis informasi yang akan tampil di kotak pesan masuk semua pemain..."
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
        {ok && <p className="text-xs text-chart-4">{ok}</p>}
        <Button type="submit" size="sm" disabled={busy || !title.trim() || !body.trim()}>
          <Send className="mr-1.5 size-3.5" /> {busy ? "Mengirim..." : "Kirim ke Semua Pemain"}
        </Button>
      </form>

      <div className="space-y-2 pt-1">
        <div className="text-xs font-bold text-muted-foreground">RIWAYAT PENGUMUMAN ({items.length})</div>
        {items.length === 0 && <p className="text-xs text-muted-foreground">Belum ada pengumuman yang dikirim.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${ANNOUNCEMENT_CATS[item.category].cls}`}>
                  {ANNOUNCEMENT_CATS[item.category].label}
                </span>
                <span className="truncate text-xs font-bold">{item.title}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
              <div className="mt-1 text-[10px] text-muted-foreground">{formatMailDate(item.created_at)}</div>
            </div>
            <Button type="button" size="sm" variant="ghost" aria-label={`Hapus ${item.title}`} onClick={() => void remove(item.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}