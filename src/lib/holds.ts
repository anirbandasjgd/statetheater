/** Orchestra STNJ house holds — not selectable. Empty until house holds are assigned. */
export const ORCHESTRA_HOLDS: { row: string; number: number }[] = [];

const HOLD_KEYS = new Set(ORCHESTRA_HOLDS.map((s) => `${s.row}:${s.number}`));

export function isHoldSeat(section: string, row: string, number: number) {
  return section === "orchestra" && HOLD_KEYS.has(`${row}:${number}`);
}
