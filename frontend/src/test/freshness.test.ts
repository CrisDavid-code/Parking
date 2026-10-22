import { describe, expect, it } from "vitest";
import { computeFreshness } from "@/lib/format";

const now = new Date("2026-01-01T12:00:00Z").getTime();
const at = (msAgo: number) => new Date(now - msAgo).toISOString();

describe("frescura de ubicación", () => {
  it("menos de 60 s es en vivo", () => expect(computeFreshness(at(59_000), now)).toBe("live"));
  it("entre 60 s y 15 min es reciente", () => expect(computeFreshness(at(14 * 60_000), now)).toBe("recent"));
  it("15 min o más es desactualizada", () => expect(computeFreshness(at(15 * 60_000), now)).toBe("stale"));
});
