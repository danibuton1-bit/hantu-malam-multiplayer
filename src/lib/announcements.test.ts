import { describe, expect, it } from "vitest";
import { markAllRead, markRead, normalizeCategory, unreadCount, validateAnnouncement } from "./announcements";

describe("announcements", () => {
  it("validates title and body limits", () => {
    expect(validateAnnouncement("", "Halo")).not.toBeNull();
    expect(validateAnnouncement("Judul", "   ")).not.toBeNull();
    expect(validateAnnouncement("a".repeat(121), "Isi")).not.toBeNull();
    expect(validateAnnouncement("Update Baru", "Map baru hadir!")).toBeNull();
  });

  it("tracks unread count accurately as items are marked read", () => {
    const items = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
    const r0 = new Set<string>();
    expect(unreadCount(items, r0)).toBe(3);
    const r1 = markRead("m1", r0);
    expect(unreadCount(items, r1)).toBe(2);
    const rAll = markAllRead(["m1", "m2", "m3"], r1);
    expect(unreadCount(items, rAll)).toBe(0);
  });

  it("normalizes unknown categories to info", () => {
    expect(normalizeCategory("update")).toBe("update");
    expect(normalizeCategory("event")).toBe("event");
    expect(normalizeCategory("lainnya")).toBe("info");
  });
});