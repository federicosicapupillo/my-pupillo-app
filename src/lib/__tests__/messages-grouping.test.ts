import { describe, it, expect } from "vitest";
import { otherColumnForRole, groupThreadsByOther } from "../messages-grouping";

describe("otherColumnForRole", () => {
  it("restaurant side groups by worker (worker_id is the 'other')", () => {
    expect(otherColumnForRole("restaurant")).toBe("worker_id");
  });

  it("worker side groups by restaurant/locale (restaurant_id is the 'other')", () => {
    expect(otherColumnForRole("worker")).toBe("restaurant_id");
  });

  it("defaults unknown/empty role to worker behavior (restaurant_id)", () => {
    expect(otherColumnForRole(null)).toBe("restaurant_id");
    expect(otherColumnForRole(undefined)).toBe("restaurant_id");
    expect(otherColumnForRole("admin")).toBe("restaurant_id");
  });
});

type T = {
  id: string;
  other: { id: string; name: string };
  lastAt: string | null;
  unread: number;
};

const mk = (id: string, otherId: string, name: string, lastAt: string | null, unread = 0): T => ({
  id,
  other: { id: otherId, name },
  lastAt,
  unread,
});

describe("groupThreadsByOther — restaurant side (other = worker)", () => {
  it("buckets multiple applications with the same worker into one group", () => {
    const threads: T[] = [
      mk("app1", "worker-A", "Mario Rossi", "2026-05-10T10:00:00Z", 1),
      mk("app2", "worker-A", "Mario Rossi", "2026-05-12T09:00:00Z", 0),
      mk("app3", "worker-B", "Luca Bianchi", "2026-05-11T12:00:00Z", 2),
    ];
    const groups = groupThreadsByOther(threads);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.id === "worker-A")!;
    expect(a.items.map((t) => t.id).sort()).toEqual(["app1", "app2"]);
    expect(a.unread).toBe(1);
    expect(a.lastAt).toBe("2026-05-12T09:00:00Z");
    expect(a.name).toBe("Mario Rossi");
  });

  it("keeps each application as a separate item (no DB merge, only visual)", () => {
    const threads: T[] = [
      mk("app1", "worker-A", "Mario", "2026-05-10T10:00:00Z"),
      mk("app2", "worker-A", "Mario", "2026-05-11T10:00:00Z"),
      mk("app3", "worker-A", "Mario", "2026-05-12T10:00:00Z"),
    ];
    const groups = groupThreadsByOther(threads);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(3);
  });

  it("sorts items within a group by most recent first", () => {
    const threads: T[] = [
      mk("old", "worker-A", "Mario", "2026-05-01T10:00:00Z"),
      mk("new", "worker-A", "Mario", "2026-05-15T10:00:00Z"),
      mk("mid", "worker-A", "Mario", "2026-05-10T10:00:00Z"),
    ];
    const [g] = groupThreadsByOther(threads);
    expect(g.items.map((t) => t.id)).toEqual(["new", "mid", "old"]);
  });

  it("sorts groups by most recent activity, then by name", () => {
    const threads: T[] = [
      mk("a", "worker-A", "Anna", "2026-05-01T10:00:00Z"),
      mk("b", "worker-B", "Bruno", "2026-05-20T10:00:00Z"),
      mk("c", "worker-C", "Carla", "2026-05-20T10:00:00Z"),
    ];
    const groups = groupThreadsByOther(threads);
    expect(groups.map((g) => g.id)).toEqual(["worker-B", "worker-C", "worker-A"]);
  });
});

describe("groupThreadsByOther — worker side (other = restaurant/locale)", () => {
  it("buckets multiple applications with the same restaurant into one group", () => {
    const threads: T[] = [
      mk("app1", "rest-X", "Trattoria da Gino", "2026-05-10T10:00:00Z", 0),
      mk("app2", "rest-X", "Trattoria da Gino", "2026-05-12T09:00:00Z", 3),
      mk("app3", "rest-Y", "Pizzeria Bella", "2026-05-11T12:00:00Z", 0),
    ];
    const groups = groupThreadsByOther(threads);
    expect(groups).toHaveLength(2);
    const x = groups.find((g) => g.id === "rest-X")!;
    expect(x.items).toHaveLength(2);
    expect(x.name).toBe("Trattoria da Gino");
    expect(x.unread).toBe(3);
  });

  it("sums unread across all applications in the group", () => {
    const threads: T[] = [
      mk("a", "rest-X", "Locale", "2026-05-10T10:00:00Z", 2),
      mk("b", "rest-X", "Locale", "2026-05-11T10:00:00Z", 5),
    ];
    const [g] = groupThreadsByOther(threads);
    expect(g.unread).toBe(7);
  });
});

describe("groupThreadsByOther — edge cases", () => {
  it("returns empty array for empty input", () => {
    expect(groupThreadsByOther([])).toEqual([]);
  });

  it("handles null lastAt without throwing", () => {
    const threads: T[] = [
      mk("a", "x", "Foo", null),
      mk("b", "x", "Foo", "2026-05-10T10:00:00Z"),
    ];
    const [g] = groupThreadsByOther(threads);
    expect(g.lastAt).toBe("2026-05-10T10:00:00Z");
    expect(g.items[0].id).toBe("b");
  });
});