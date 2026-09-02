import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { attendeeSortValue, mapExcelTier, POOL_LABEL, type AssignPool } from "./attendee-tiers";
import { tierFor } from "./pricing";
import { seatLabel } from "./seats";

const PLACEHOLDER_EMAIL = "imported@statetheatre.invalid";
const PLACEHOLDER_PHONE = "0000000";

type DbSeat = {
  id: string;
  section: string;
  block: string;
  row: string;
  number: number;
  type: string;
  status: string;
  price: number;
  x: number;
  y: number;
};

export type AssignPreviewRow = {
  name: string;
  attendeeNumber: string;
  createdAt: string;
  excelTier: string;
  assignedTier: string;
  poolLabel: string;
  seatId: string | null;
  seatLabel: string | null;
  error: string | null;
};

export type PoolSummary = {
  pool: AssignPool;
  label: string;
  tickets: number;
  assigned: number;
  remainingSeats: number;
};

export type AssignPreview = {
  existingRegistrations: number;
  warning: string | null;
  rows: AssignPreviewRow[];
  ready: number;
  failed: number;
  pools: PoolSummary[];
  imported?: number;
};

type Ticket = {
  name: string;
  attendeeNumber: string;
  createdAt: string;
  excelTier: string;
  pool: AssignPool | null;
  error: string | null;
};

function cellText(value: ExcelJS.CellValue | undefined) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  return "";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[#_/\-]+/g, " ").replace(/\s+/g, " ");
}

function headerKey(value: string) {
  const h = normalizeHeader(value);
  if (["created date", "created", "timestamp", "registration time", "registered at", "date"].includes(h)) return "createdAt";
  if (["account name", "name", "guest", "participant", "full name"].includes(h)) return "name";
  if (["tier name", "tier", "ticket tier", "registration tier"].includes(h)) return "tier";
  if (["attendee number", "attendee", "ticket", "ticket id", "ticket number"].includes(h)) return "attendeeNumber";
  return "";
}

function pickSheet(workbook: ExcelJS.Workbook) {
  const named = workbook.getWorksheet("Raw Attendees Data") ?? workbook.getWorksheet("Sheet1");
  if (named) {
    const header = named.getRow(1);
    const titles = (header.values as ExcelJS.CellValue[] | undefined)?.map((v) => normalizeHeader(cellText(v))) ?? [];
    if (titles.some((t) => t.includes("account name") || t === "name") && titles.some((t) => t.includes("tier"))) {
      return named;
    }
  }
  for (const sheet of workbook.worksheets) {
    const header = sheet.getRow(1);
    const titles = (header.values as ExcelJS.CellValue[] | undefined)?.map((v) => normalizeHeader(cellText(v))) ?? [];
    if (titles.some((t) => t.includes("account name") || t === "name") && titles.some((t) => t.includes("tier"))) {
      return sheet;
    }
  }
  return workbook.worksheets[0] ?? null;
}

export async function parseAttendeeWorkbook(buffer: Buffer): Promise<Ticket[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = pickSheet(workbook);
  if (!sheet) throw new Error("Could not find a worksheet in that Excel file.");

  const headerRow = sheet.getRow(1);
  const columns: { index: number; key: string }[] = [];
  headerRow.eachCell((cell, index) => {
    const key = headerKey(cellText(cell.value));
    if (key) columns.push({ index, key });
  });
  if (!columns.some((c) => c.key === "name") || !columns.some((c) => c.key === "tier")) {
    throw new Error("The sheet needs Created Date, Attendee Number, Account Name, and Tier Name columns.");
  }

  const tickets: Ticket[] = [];
  let lastCreatedAt = "";
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rec: Record<string, string> = {};
    for (const col of columns) rec[col.key] = cellText(row.getCell(col.index).value);
    const name = rec.name ?? "";
    const excelTier = rec.tier ?? "";
    if (!name && !excelTier && !rec.attendeeNumber) return;
    if (rec.createdAt) lastCreatedAt = rec.createdAt;
    const createdAt = rec.createdAt || lastCreatedAt;
    if (!name) {
      tickets.push({
        name: "(missing name)",
        attendeeNumber: rec.attendeeNumber ?? "",
        createdAt,
        excelTier,
        pool: null,
        error: "Missing name.",
      });
      return;
    }
    const pool = mapExcelTier(excelTier);
    tickets.push({
      name,
      attendeeNumber: rec.attendeeNumber ?? "",
      createdAt,
      excelTier,
      pool,
      error: pool ? null : `Unknown tier "${excelTier || "(blank)"}".`,
    });
  });

  tickets.sort((a, b) => {
    const timeA = Date.parse(a.createdAt) || 0;
    const timeB = Date.parse(b.createdAt) || 0;
    if (timeA !== timeB) return timeA - timeB;
    const diff = attendeeSortValue(a.attendeeNumber) - attendeeSortValue(b.attendeeNumber);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
  return tickets;
}

function formatCreatedAt(value: string) {
  if (!value) return "";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString();
}

function assignedTierLabel(seat: Pick<DbSeat, "section" | "row" | "block">) {
  const section = seat.section === "orchestra" ? "Orchestra" : "Balcony";
  return `${section} ${tierFor(seat.section, seat.row, seat.block)}`;
}

function isSpecial(type: string) {
  return type === "ada" || type === "companion";
}

function seatInPool(seat: DbSeat, pool: AssignPool) {
  if (seat.status !== "available") return false;
  if (seat.type === "hold") return false;
  const tier = tierFor(seat.section, seat.row, seat.block);
  if (tier === "VIP" || tier === "Box") return false;
  if (pool === "platinum") return seat.section === "orchestra" && tier === "Platinum";
  if (pool === "silver") return seat.section === "balcony" && tier === "Silver";
  if (pool === "student") return seat.section === "balcony" && tier === "Student";
  return tier === "Gold" && (seat.section === "orchestra" || seat.section === "balcony");
}

function medianX(seats: DbSeat[]) {
  if (seats.length === 0) return 0;
  const xs = [...seats].map((s) => s.x).sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)] ?? 0;
}

function rowKey(seat: DbSeat) {
  return `${seat.section}:${seat.block}:${seat.row}`;
}

function findContiguousRun(remaining: DbSeat[], n: number, centerX: number, layout: DbSeat[]): DbSeat[] | null {
  if (n <= 0) return [];
  const remainingByRow = new Map<string, Set<string>>();
  for (const seat of remaining) {
    const key = rowKey(seat);
    const ids = remainingByRow.get(key) ?? new Set<string>();
    ids.add(seat.id);
    remainingByRow.set(key, ids);
  }
  const remainingById = new Map(remaining.map((seat) => [seat.id, seat]));

  const layoutByRow = new Map<string, DbSeat[]>();
  for (const seat of layout) {
    const key = rowKey(seat);
    const list = layoutByRow.get(key) ?? [];
    list.push(seat);
    layoutByRow.set(key, list);
  }

  let best: { run: DbSeat[]; score: number } | null = null;
  for (const [key, ids] of remainingByRow) {
    const full = [...(layoutByRow.get(key) ?? [])].sort((a, b) => a.x - b.x);
    if (full.length < n) continue;
    for (let i = 0; i <= full.length - n; i += 1) {
      const window = full.slice(i, i + n);
      if (!window.every((seat) => ids.has(seat.id))) continue;
      const run = window.map((seat) => remainingById.get(seat.id)!);
      const mid = (run[0].x + run[n - 1].x) / 2;
      const special = run.some((seat) => isSpecial(seat.type)) ? 1 : 0;
      const sectionRank = run[0].section === "orchestra" ? 0 : 1;
      const score = sectionRank * 1e12 + special * 1e9 - run[0].y * 1e6 + Math.abs(mid - centerX);
      if (!best || score < best.score) best = { run, score };
    }
  }
  return best?.run ?? null;
}

function takeTogether(seats: DbSeat[], n: number, layout: DbSeat[]): DbSeat[] | null {
  if (n <= 0) return [];
  if (seats.length < n) return null;
  const centerX = medianX(seats);
  const preferred = seats.filter((seat) => !isSpecial(seat.type));
  const exact = findContiguousRun(preferred, n, centerX, layout) ?? findContiguousRun(seats, n, centerX, layout);
  if (exact) return exact;

  const packed: DbSeat[] = [];
  const available = new Set(seats);
  let remaining = n;
  while (remaining > 0) {
    const open = [...available];
    const openPreferred = open.filter((seat) => !isSpecial(seat.type));
    let chunk: DbSeat[] | null = null;
    for (let size = remaining; size >= 1; size -= 1) {
      chunk = findContiguousRun(openPreferred, size, centerX, layout) ?? findContiguousRun(open, size, centerX, layout);
      if (chunk) break;
    }
    if (!chunk) return null;
    packed.push(...chunk);
    remaining -= chunk.length;
    for (const seat of chunk) available.delete(seat);
  }
  return packed;
}

function takePartySeats(open: DbSeat[], n: number, pool: AssignPool, layout: DbSeat[]): DbSeat[] | null {
  if (pool === "gold") {
    const orchestra = open.filter((seat) => seat.section === "orchestra");
    const balcony = open.filter((seat) => seat.section === "balcony");
    return takeTogether(orchestra, n, layout) ?? takeTogether(balcony, n, layout);
  }
  return takeTogether(open, n, layout);
}

type Party = { name: string; pool: AssignPool; createdAt: string; tickets: Ticket[] };

function groupParties(tickets: Ticket[]): { parties: Party[]; skipped: Ticket[] } {
  const parties = new Map<string, Party>();
  const order: string[] = [];
  const skipped: Ticket[] = [];
  for (const ticket of tickets) {
    if (ticket.error || !ticket.pool) {
      skipped.push(ticket);
      continue;
    }
    const key = ticket.createdAt
      ? `${ticket.createdAt}|${ticket.pool}`
      : `${ticket.name.toLowerCase()}|${ticket.pool}`;
    const existing = parties.get(key);
    if (existing) {
      existing.tickets.push(ticket);
      continue;
    }
    parties.set(key, {
      name: ticket.name,
      pool: ticket.pool,
      createdAt: ticket.createdAt,
      tickets: [ticket],
    });
    order.push(key);
  }
  return { parties: order.map((key) => parties.get(key)!), skipped };
}

export async function previewAssignFromExcel(prisma: PrismaClient, buffer: Buffer): Promise<AssignPreview> {
  const tickets = await parseAttendeeWorkbook(buffer);
  const [seats, existingRegistrations] = await Promise.all([
    prisma.seat.findMany({
      select: {
        id: true,
        section: true,
        block: true,
        row: true,
        number: true,
        type: true,
        status: true,
        price: true,
        x: true,
        y: true,
      },
    }),
    prisma.registration.count(),
  ]);

  const remaining = new Map<AssignPool, DbSeat[]>(
    (["platinum", "gold", "silver", "student"] as AssignPool[]).map((pool) => [
      pool,
      seats.filter((seat) => seatInPool(seat, pool)),
    ]),
  );
  const starting = new Map<AssignPool, number>(
    [...remaining.entries()].map(([pool, list]) => [pool, list.length]),
  );

  const { parties, skipped } = groupParties(tickets);
  const assignedByTicket = new Map<Ticket, DbSeat>();
  const failedParties = new Map<Party, string>();

  for (const party of parties) {
    const open = remaining.get(party.pool) ?? [];
    const chosen = takePartySeats(open, party.tickets.length, party.pool, seats);
    if (!chosen || chosen.length !== party.tickets.length) {
      failedParties.set(party, `No remaining ${POOL_LABEL[party.pool]} seats together for ${party.tickets.length} tickets.`);
      continue;
    }
    const orderedSeats = [...chosen].sort((a, b) => a.x - b.x || b.y - a.y);
    party.tickets.forEach((ticket, index) => {
      assignedByTicket.set(ticket, orderedSeats[index]!);
    });
    const used = new Set(chosen.map((seat) => seat.id));
    remaining.set(
      party.pool,
      open.filter((seat) => !used.has(seat.id)),
    );
  }

  const rows: AssignPreviewRow[] = tickets.map((ticket) => {
    if (skipped.includes(ticket) || ticket.error || !ticket.pool) {
      return {
        name: ticket.name,
        attendeeNumber: ticket.attendeeNumber,
        createdAt: formatCreatedAt(ticket.createdAt),
        excelTier: ticket.excelTier,
        assignedTier: "—",
        poolLabel: ticket.excelTier || "Unknown",
        seatId: null,
        seatLabel: null,
        error: ticket.error ?? "Unknown tier.",
      };
    }
    const party = parties.find((p) => p.tickets.includes(ticket));
    const fail = party ? failedParties.get(party) : null;
    if (fail) {
      return {
        name: ticket.name,
        attendeeNumber: ticket.attendeeNumber,
        createdAt: formatCreatedAt(ticket.createdAt),
        excelTier: ticket.excelTier,
        assignedTier: "—",
        poolLabel: POOL_LABEL[ticket.pool],
        seatId: null,
        seatLabel: null,
        error: fail,
      };
    }
    const next = assignedByTicket.get(ticket);
    if (!next) {
      return {
        name: ticket.name,
        attendeeNumber: ticket.attendeeNumber,
        createdAt: formatCreatedAt(ticket.createdAt),
        excelTier: ticket.excelTier,
        assignedTier: "—",
        poolLabel: POOL_LABEL[ticket.pool],
        seatId: null,
        seatLabel: null,
        error: `No remaining ${POOL_LABEL[ticket.pool]} seats.`,
      };
    }
    return {
      name: ticket.name,
      attendeeNumber: ticket.attendeeNumber,
      createdAt: formatCreatedAt(ticket.createdAt),
      excelTier: ticket.excelTier,
      assignedTier: assignedTierLabel(next),
      poolLabel: POOL_LABEL[ticket.pool],
      seatId: next.id,
      seatLabel: seatLabel({
        section: next.section as "orchestra" | "balcony",
        block: next.block,
        row: next.row,
        number: next.number,
      }),
      error: null,
    };
  });

  const pools: PoolSummary[] = (["platinum", "gold", "silver", "student"] as AssignPool[]).map((pool) => {
    let assigned = 0;
    tickets.forEach((ticket, index) => {
      if (ticket.pool === pool && !rows[index]?.error) assigned += 1;
    });
    return {
      pool,
      label: POOL_LABEL[pool],
      tickets: tickets.filter((ticket) => ticket.pool === pool).length,
      assigned,
      remainingSeats: (starting.get(pool) ?? 0) - assigned,
    };
  });

  return {
    existingRegistrations,
    warning:
      existingRegistrations > 0
        ? `${existingRegistrations} registration${existingRegistrations === 1 ? "" : "s"} already exist. New seats will be taken from what is still available. Re-uploading can assign extra seats to the same names.`
        : null,
    rows,
    ready: rows.filter((row) => !row.error).length,
    failed: rows.filter((row) => row.error).length,
    pools,
  };
}

export async function applyAssignFromExcel(prisma: PrismaClient, buffer: Buffer) {
  const preview = await previewAssignFromExcel(prisma, buffer);
  const ready = preview.rows.filter((row) => !row.error && row.seatId);
  if (ready.length === 0) return { ...preview, imported: 0 };

  const byName = new Map<string, { name: string; seatIds: string[] }>();
  for (const row of ready) {
    const cur = byName.get(row.name) ?? { name: row.name, seatIds: [] };
    cur.seatIds.push(row.seatId!);
    byName.set(row.name, cur);
  }

  await prisma.$transaction(async (tx) => {
    for (const guest of byName.values()) {
      const seats = await tx.seat.findMany({ where: { id: { in: guest.seatIds } } });
      const taken = seats.filter((seat) => seat.status === "sold" || seat.status === "blocked");
      if (taken.length) {
        throw new Error(
          `${guest.name}: ${taken.map((seat) => `${seat.row}-${seat.number}`).join(", ")} is no longer available.`,
        );
      }
      await tx.registration.create({
        data: {
          name: guest.name,
          email: PLACEHOLDER_EMAIL,
          phone: PLACEHOLDER_PHONE,
          seats: { create: guest.seatIds.map((seatId) => ({ seatId })) },
        },
      });
      await tx.seat.updateMany({
        where: { id: { in: guest.seatIds } },
        data: { status: "sold", holdUntil: null },
      });
    }
  });

  return { ...preview, imported: byName.size };
}
