export function formatDateRange(
  range: string,
  timezone: string
): { start: Date; end: Date } {
  const now = new Date();
  if (!["today", "7d", "30d"].includes(range)) throw new RangeError("Invalid range");
  const date = new Date(`${toLocalDate(now, timezone)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - (range === "7d" ? 6 : range === "30d" ? 29 : 0));
  return { start: startOfLocalDay(date.toISOString().slice(0, 10), timezone), end: now };
}

export function startOfLocalDay(date: string, timezone: string): Date {
  const nominal = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(nominal.getTime()) || nominal.toISOString().slice(0, 10) !== date) {
    throw new RangeError("Invalid date");
  }
  // Find the first UTC instant of the local date, including DST midnight gaps.
  let low = nominal.getTime() - 36 * 3600000;
  let high = nominal.getTime() + 36 * 3600000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (toLocalDate(new Date(mid), timezone) < date) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}

export function localDayRange(date: string, timezone: string) {
  const start = startOfLocalDay(date, timezone);
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, end: startOfLocalDay(next.toISOString().slice(0, 10), timezone) };
}

export function escapeCsvField(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value;
  return /[,"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toLocalDate(
  utcDate: Date,
  timezone: string
): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(utcDate);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)!.value).join("-");
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "00:00";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
