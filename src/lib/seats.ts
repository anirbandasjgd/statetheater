export type SeatType = "standard" | "companion" | "transfer" | "wheelchair" | "ada" | "hold";
export type Section = "orchestra" | "balcony";

export type PublicSeat = {
  id: string;
  section: Section;
  block: string;
  row: string;
  number: number;
  type: SeatType;
  price: number;
  x: number;
  y: number;
  status: "available" | "sold" | "blocked";
};

export const BLOCK_LABEL: Record<string, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
  leftCenter: "Left Center",
  rightCenter: "Right Center",
  front: "Front",
  boxLeft: "Box Left",
  boxRight: "Box Right",
  vipBoxLeft: "VIP Box Left",
  vipBoxRight: "VIP Box Right",
};

export function seatLabel(seat: Pick<PublicSeat, "section" | "block" | "row" | "number">) {
  const block = BLOCK_LABEL[seat.block] ?? seat.block;
  const section = seat.section === "orchestra" ? "Orchestra" : "Balcony";
  return `${section} ${block} ${seat.row}-${seat.number}`;
}

export function formatPrice(n: number) {
  return `$${n}`;
}

export function typeLabel(type: string) {
  if (type === "ada") return "ADA";
  if (type === "hold") return "STNJ Hold";
  return type;
}
