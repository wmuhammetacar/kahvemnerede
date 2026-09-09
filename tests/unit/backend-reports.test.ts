import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $queryRawUnsafe: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { escapeCsvField, formatDateRange, localDayRange } from "@/lib/reports";
import { getDailyDistribution, getHourlyDistribution } from "@/lib/reports-query";

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("report calendar boundaries", () => {
  it("converts Istanbul midnight to UTC rather than host-local midnight", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-08T12:00:00Z"));
    expect(formatDateRange("today", "Europe/Istanbul").start.toISOString()).toBe("2026-09-07T21:00:00.000Z");
    expect(formatDateRange("7d", "Europe/Istanbul").start.toISOString()).toBe("2026-09-01T21:00:00.000Z");
  });

  it.each([
    ["2026-03-08", 23], ["2026-11-01", 25],
  ])("handles DST on %s", (date, hours) => {
    const { start, end } = localDayRange(date, "America/New_York");
    expect((end.getTime() - start.getTime()) / 3600000).toBe(hours);
  });

  it("handles fractional timezone offsets", () => {
    expect(localDayRange("2026-09-08", "Asia/Kathmandu").start.toISOString()).toBe("2026-09-07T18:15:00.000Z");
  });

  it.each(["2026-02-30", "2026-13-01", "invalid", "2026-9-8", "2026-09-08T12:00:00Z"])("rejects invalid date %s", (date) => {
    expect(() => localDayRange(date, "UTC")).toThrow(RangeError);
  });

  it("rejects unknown ranges and timezones", () => {
    expect(() => formatDateRange("anything", "UTC")).toThrow(RangeError);
    expect(() => formatDateRange("today", "invalid")).toThrow(RangeError);
  });

  it("interprets Prisma timestamps as UTC before SQL timezone conversion", async () => {
    db.$queryRawUnsafe.mockResolvedValue([]);
    const start = new Date("2026-09-07T21:00:00Z");
    const end = new Date("2026-09-08T21:00:00Z");
    await getHourlyDistribution(["branch"], start, end, "Europe/Istanbul");
    expect(db.$queryRawUnsafe.mock.calls[0][0]).toContain("AT TIME ZONE 'UTC' AT TIME ZONE $4");
    expect(db.$queryRawUnsafe.mock.calls[0][4]).toBe("Europe/Istanbul");
    await getDailyDistribution(["branch"], start, end, "Asia/Tokyo");
    expect(db.$queryRawUnsafe.mock.calls[1][0]).toContain("AT TIME ZONE 'UTC' AT TIME ZONE $1");
    expect(db.$queryRawUnsafe.mock.calls[1][1]).toBe("Asia/Tokyo");
  });
});

describe("CSV escaping", () => {
  it.each([
    ["normal", "normal"],
    ["a,b", '"a,b"'],
    ['a"b', '"a""b"'],
    ["a\rb", '"a\rb"'],
    ['=HYPERLINK("x","y")', '"\'=HYPERLINK(""x"",""y"")"'],
    [" +1", "' +1"],
    ["@SUM(1)", "'@SUM(1)"],
    ["\t=1", "'\t=1"],
    ["-1\nnext", '"\'-1\nnext"'],
  ])("sanitizes then quotes %j", (input, output) => {
    expect(escapeCsvField(input)).toBe(output);
  });
});
