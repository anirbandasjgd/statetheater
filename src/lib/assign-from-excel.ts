import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { attendeeSortValue, mapExcelTier, POOL_LABEL, type AssignPool } from "./attendee-tiers";
import { excelDateToWallClock, excelRegisteredAt, formatWallClock, parseWallClock } from "./datetime";
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
  registeredAt: string;
  excelTier: string;
  assignedTier: string;
  poolLabel: string;
  partyKey: string;
  seatIds: string[];
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
  skippedExisting: number;
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
  if (value instanceof Date) return excelDateToWallClock(value);
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
  const clock = parseWallClock(value);
  if (!clock) return value;
  return formatWallClock(clock);
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
  if (seat.type === "hold" || seat.type === "ada" || seat.type === "companion") return false;
  const tier = tierFor(seat.section, seat.row, seat.block);
  if (tier === "VIP" || tier === "Box") return false;
  if (pool === "platinum") return tier === "Platinum";
  if (pool === "silver") return seat.section === "balcony" && tier === "Silver";
  if (pool === "student") return seat.section === "balcony" && tier === "Student";
  return tier === "Gold";
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
  const preferred = seats.filter((seat) => !isSpecial(seat.type));
  if (preferred.length < n) return null;
  const centerX = medianX(preferred);
  const exact = findContiguousRun(preferred, n, centerX, layout);
  if (exact) return exact;

  const packed: DbSeat[] = [];
  const available = new Set(preferred);
  let remaining = n;
  while (remaining > 0) {
    const open = [...available];
    let chunk: DbSeat[] | null = null;
    for (let size = remaining; size >= 1; size -= 1) {
      chunk = findContiguousRun(open, size, centerX, layout);
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
  if (pool === "platinum" || pool === "gold") {
    const orchestra = open.filter((seat) => seat.section === "orchestra");
    const balcony = open.filter((seat) => seat.section === "balcony");
    return takeTogether(orchestra, n, layout) ?? takeTogether(balcony, n, layout);
  }
  return takeTogether(open, n, layout);
}

type Party = { name: string; pool: AssignPool; createdAt: string; tickets: Ticket[] };

function partyKeyFor(ticket: Pick<Ticket, "createdAt" | "name" | "pool">) {
  if (!ticket.pool) return "";
  return ticket.createdAt
    ? `${ticket.createdAt}|${ticket.pool}`
    : `${ticket.name.toLowerCase()}|${ticket.pool}`;
}

function uniqueGuestNames(names: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(name);
  }
  return ordered.join(", ");
}

function previewRowForTickets(
  tickets: Ticket[],
  assigned: DbSeat[],
  error: string | null,
  poolLabel: string,
): AssignPreviewRow {
  const first = tickets[0]!;
  return {
    name: uniqueGuestNames(tickets.map((ticket) => ticket.name)),
    attendeeNumber: tickets.map((ticket) => ticket.attendeeNumber).filter(Boolean).join(", "),
    createdAt: formatCreatedAt(first.createdAt),
    registeredAt: first.createdAt,
    excelTier: uniqueGuestNames(tickets.map((ticket) => ticket.excelTier)),
    assignedTier: assigned.length ? uniqueGuestNames(assigned.map((seat) => assignedTierLabel(seat))) : "—",
    poolLabel,
    partyKey: partyKeyFor(first) || `${first.createdAt}|${first.name}|${first.attendeeNumber}`,
    seatIds: assigned.map((seat) => seat.id),
    seatLabel: assigned.length
      ? assigned
          .map((seat) =>
            seatLabel({
              section: seat.section as "orchestra" | "balcony",
              block: seat.block,
              row: seat.row,
              number: seat.number,
            }),
          )
          .join(", ")
      : null,
    error,
  };
}

function namesIn(value: string) {
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function registrationMatchesParty(registrationName: string, partyName: string) {
  const existing = new Set(namesIn(registrationName));
  return namesIn(partyName).some((name) => existing.has(name));
}

type ExistingGuest = { name: string; seats: { seat: DbSeat }[] };

function claimedSeatCounts(existing: ExistingGuest[]) {
  const claimed = new Map<string, number>();
  for (const row of existing) {
    const names = namesIn(row.name);
    let seatsLeft = row.seats.length;
    for (const name of names) {
      if (seatsLeft <= 0) break;
      claimed.set(name, (claimed.get(name) ?? 0) + 1);
      seatsLeft -= 1;
    }
    if (seatsLeft > 0 && names[0]) {
      claimed.set(names[0], (claimed.get(names[0]) ?? 0) + seatsLeft);
    }
  }
  return claimed;
}

function existingSeatsForParty(partyName: string, existing: ExistingGuest[]) {
  const out: DbSeat[] = [];
  const seen = new Set<string>();
  for (const guest of existing) {
    if (!registrationMatchesParty(guest.name, partyName)) continue;
    for (const link of guest.seats) {
      if (seen.has(link.seat.id)) continue;
      seen.add(link.seat.id);
      out.push(link.seat);
    }
  }
  return out;
}

function groupParties(tickets: Ticket[]): { parties: Party[]; skipped: Ticket[] } {
  const parties = new Map<string, Party>();
  const order: string[] = [];
  const skipped: Ticket[] = [];
  for (const ticket of tickets) {
    if (ticket.error || !ticket.pool) {
      skipped.push(ticket);
      continue;
    }
    const key = partyKeyFor(ticket);
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
  const [seats, existing] = await Promise.all([
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
    prisma.registration.findMany({
      select: {
        name: true,
        seats: {
          select: {
            seat: {
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
            },
          },
        },
      },
    }),
  ]);
  const remainingClaims = claimedSeatCounts(existing);
  for (const ticket of tickets) {
    if (ticket.error || !ticket.pool) continue;
    const key = ticket.name.trim().toLowerCase();
    const have = remainingClaims.get(key) ?? 0;
    if (have > 0) {
      ticket.error = "Already has seats.";
      remainingClaims.set(key, have - 1);
    }
  }
  const existingRegistrations = existing.length;
  const skippedExisting = tickets.filter((ticket) => ticket.error === "Already has seats.").length;

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

  const emitted = new Set<string>();
  const rows: AssignPreviewRow[] = [];
  for (const ticket of tickets) {
    const party = parties.find((item) => item.tickets.includes(ticket));
    if (party) {
      const key = partyKeyFor(party.tickets[0]!);
      if (emitted.has(key)) continue;
      emitted.add(key);
      const fail = failedParties.get(party) ?? null;
      const assigned = party.tickets
        .map((item) => assignedByTicket.get(item))
        .filter((seat): seat is DbSeat => Boolean(seat));
      rows.push(
        previewRowForTickets(
          party.tickets,
          assigned,
          fail,
          POOL_LABEL[party.pool],
        ),
      );
      continue;
    }
    const key = partyKeyFor(ticket) || `__${ticket.createdAt}|${ticket.name}|${ticket.attendeeNumber}`;
    if (emitted.has(key)) continue;
    emitted.add(key);
    const group = skipped.filter(
      (item) => (partyKeyFor(item) || `__${item.createdAt}|${item.name}|${item.attendeeNumber}`) === key,
    );
    const groupTickets = group.length ? group : [ticket];
    const alreadySeated = ticket.error === "Already has seats.";
    rows.push(
      previewRowForTickets(
        groupTickets,
        alreadySeated ? existingSeatsForParty(uniqueGuestNames(groupTickets.map((item) => item.name)), existing) : [],
        ticket.error ?? "Unknown tier.",
        ticket.pool ? POOL_LABEL[ticket.pool] : ticket.excelTier || "Unknown",
      ),
    );
  }

  const pools: PoolSummary[] = (["platinum", "gold", "silver", "student"] as AssignPool[]).map((pool) => {
    const assigned = tickets.filter((ticket) => ticket.pool === pool && assignedByTicket.has(ticket)).length;
    return {
      pool,
      label: POOL_LABEL[pool],
      tickets: tickets.filter((ticket) => ticket.pool === pool && ticket.error !== "Already has seats.").length,
      assigned,
      remainingSeats: (starting.get(pool) ?? 0) - assigned,
    };
  });

  return {
    existingRegistrations,
    skippedExisting,
    warning:
      skippedExisting > 0
        ? `${skippedExisting} ticket${skippedExisting === 1 ? "" : "s"} already have seats; those registration dates will be updated from the sheet. Extra tickets for the same names will still be assigned.`
        : existingRegistrations > 0
          ? `${existingRegistrations} registration${existingRegistrations === 1 ? "" : "s"} already exist. New seats will be taken from what is still available.`
          : null,
    rows,
    ready: rows.filter((row) => !row.error).reduce((sum, row) => sum + row.seatIds.length, 0),
    failed: rows.filter((row) => row.error && row.error !== "Already has seats.").length,
    pools,
  };
}

export async function applyAssignFromExcel(prisma: PrismaClient, buffer: Buffer) {
  const preview = await previewAssignFromExcel(prisma, buffer);
  const ready = preview.rows.filter((row) => !row.error && row.seatIds.length > 0);
  const alreadySeated = preview.rows.filter((row) => row.error === "Already has seats.");
  if (ready.length === 0 && alreadySeated.length === 0) return { ...preview, imported: 0 };

  await prisma.$transaction(async (tx) => {
    for (const row of ready) {
      const seatIds = row.seatIds;
      const seats = await tx.seat.findMany({ where: { id: { in: seatIds } } });
      const taken = seats.filter((seat) => seat.status === "sold" || seat.status === "blocked");
      if (taken.length || seats.length !== seatIds.length) {
        throw new Error(`${row.name}: one of those seats is no longer available.`);
      }
      await tx.registration.create({
        data: {
          name: row.name,
          email: PLACEHOLDER_EMAIL,
          phone: PLACEHOLDER_PHONE,
          createdAt: excelRegisteredAt(row.registeredAt) ?? new Date(),
          seats: { create: seatIds.map((seatId) => ({ seatId })) },
        },
      });
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: "sold", holdUntil: null },
      });
    }

    if (alreadySeated.length > 0) {
      const existing = await tx.registration.findMany({ select: { id: true, name: true } });
      const stamped = new Set<string>();
      for (const row of alreadySeated) {
        const next = excelRegisteredAt(row.registeredAt);
        if (!next) continue;
        for (const guest of existing) {
          if (stamped.has(guest.id) || !registrationMatchesParty(guest.name, row.name)) continue;
          await tx.registration.update({ where: { id: guest.id }, data: { createdAt: next } });
          stamped.add(guest.id);
        }
      }
    }
  });

  return {
    ...preview,
    imported: ready.reduce((sum, row) => sum + row.seatIds.length, 0),
  };
}
