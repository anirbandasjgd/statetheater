const HOUSE_TZ = "America/New_York";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function formatWallClock(clock: WallClock) {
  return `${pad2(clock.month)}/${pad2(clock.day)}/${clock.year}, ${pad2(clock.hour)}:${pad2(clock.minute)}:${pad2(clock.second)}`;
}

/** ExcelJS Date UTC fields are the naive sheet clock, not a real UTC instant. */
export function excelDateToWallClock(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}T${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}:${pad2(value.getUTCSeconds())}`;
}

export function parseWallClock(value: string): WallClock | null {
  const text = value.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      hour: Number(iso[4]),
      minute: Number(iso[5]),
      second: Number(iso[6]),
    };
  }
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return wallClockInTimeZone(date, HOUSE_TZ);
}

function tzOffsetMinutes(utcMs: number, timeZone: string) {
  const name =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      year: "numeric",
    })
      .formatToParts(new Date(utcMs))
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = name.match(/([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function wallClockToDate(clock: WallClock, timeZone: string) {
  const utcGuess = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
  const first = tzOffsetMinutes(utcGuess, timeZone);
  let instant = utcGuess - first * 60_000;
  const second = tzOffsetMinutes(instant, timeZone);
  if (second !== first) instant = utcGuess - second * 60_000;
  return new Date(instant);
}

function wallClockInTimeZone(date: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function excelRegisteredAt(value: string): Date | null {
  const clock = parseWallClock(value);
  if (!clock) return null;
  return wallClockToDate(clock, HOUSE_TZ);
}

export function formatRegisteredAt(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    if (typeof value === "string") {
      const clock = parseWallClock(value);
      return clock ? formatWallClock(clock) : value;
    }
    return "";
  }
  return formatWallClock(wallClockInTimeZone(date, HOUSE_TZ));
}
