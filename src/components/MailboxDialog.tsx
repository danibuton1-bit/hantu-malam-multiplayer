import { useCallback, useEffect, useState } from "react";
import { CheckCheck, Mail, MailOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ANNOUNCEMENT_CATS,
  fetchAnnouncements,
  formatMailDate,
  getReadIds,
  markAllRead,
  markRead,
  unreadCount,
  type Announcement,
} from "@/lib/announcements";

/** Kotak pesan masuk ala Free Fire di bar atas lobby, menampilkan pengumuman resmi dari admin. */
export function MailboxDialog() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAnnouncements();
      setItems(list);
      setSelectedId((prev) => (prev && list.some((x) => x.id === prev) ? prev : (list[0]?.id ?? null)));
    } catch { /* keep existing list on network hiccup */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setReadIds(getReadIds());
    void load();
    const ch = supabase
      .channel("mailbox-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_announcements" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const selected = items.find((x) => x.id === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    if (!open || !selected) return;
    setReadIds((prev) => (prev.has(selected.id) ? prev : markRead(selected.id, prev)));
  }, [open, selected]);

  const unread = unreadCount(items, readIds);

  function pick(item: Announcement) {
    setSelectedId(item.id);
    setReadIds((prev) => (prev.has(item.id) ? prev : markRead(item.id, prev)));
  }

  function readAll() {
    setReadIds((prev) => markAllRead(items.map((x) => x.id), prev));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button aria-label="Pesan Masuk" className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card/80">
          <Mail className="size-4" />
          {unread > 0 && <span aria-label={`${unread} pesan belum dibaca`} className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-background" />}
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[82vh] max-w-2xl flex-col gap-3 overflow-hidden p-4">
        <DialogHeader className="flex-row items-center justify-between space-y-0 pr-6">
          <DialogTitle className="flex items-center gap-2 font-horror text-2xl text-gold"><Mail className="size-5" /> PESAN MASUK</DialogTitle>
          {unread > 0 && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={readAll}>
              <CheckCheck className="mr-1 size-3.5" /> Baca Semua ({unread})
            </Button>
          )}
        </DialogHeader>

        {loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Memuat pesan...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <MailOpen className="size-8 opacity-50" />
            <p className="text-sm">Belum ada pengumuman dari admin.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-[220px_1fr]">
            <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1 sm:max-h-[56vh]">
              {items.map((item) => {
                const cat = ANNOUNCEMENT_CATS[item.category];
                const isRead = readIds.has(item.id);
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pick(item)}
                    className={`relative rounded-lg border p-2.5 text-left transition ${active ? "border-gold/70 bg-gold/10" : "border-border bg-card/70 hover:bg-card"}`}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${cat.cls}`}>{cat.label}</span>
                      {!isRead && <span className="ml-auto size-2 rounded-full bg-destructive" />}
                    </div>
                    <div className={`truncate text-xs ${isRead ? "font-medium text-foreground/80" : "font-bold text-foreground"}`}>{item.title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{formatMailDate(item.created_at)}</div>
                  </button>
                );
              })}
            </div>

            {selected && (
              <article className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-card/60 p-3.5 sm:max-h-[56vh]">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${ANNOUNCEMENT_CATS[selected.category].cls}`}>
                    {ANNOUNCEMENT_CATS[selected.category].label}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatMailDate(selected.created_at)}</span>
                </div>
                <h3 className="text-base font-bold text-foreground">{selected.title}</h3>
                <div className="mb-3 text-xs text-muted-foreground">Dari: {selected.sender_nama}</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{selected.body}</p>
              </article>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}