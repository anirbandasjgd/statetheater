import { priceFor, tierFor, type SeatTier } from "./pricing";

export type InventorySectionId = "orchestra" | "balcony";

export type InventoryTierRow = {
  tier: SeatTier;
  note: string;
  price: number;
  selected: number;
  total: number;
};

export type InventorySection = {
  section: InventorySectionId;
  label: string;
  tiers: InventoryTierRow[];
  selected: number;
  total: number;
};

const LAYOUT: {
  section: InventorySectionId;
  label: string;
  tiers: { tier: SeatTier; note: string; sampleRow: string; sampleBlock?: string }[];
}[] = [
  {
    section: "orchestra",
    label: "Orchestra",
    tiers: [
      { tier: "VIP", note: "PA–D", sampleRow: "A" },
      { tier: "Platinum", note: "E–P", sampleRow: "E" },
      { tier: "Gold", note: "Q–DD", sampleRow: "Q" },
    ],
  },
  {
    section: "balcony",
    label: "Balcony",
    tiers: [
      { tier: "Gold", note: "A–C", sampleRow: "A" },
      { tier: "Silver", note: "D–V", sampleRow: "D" },
      { tier: "Student", note: "W–CC", sampleRow: "W" },
      { tier: "Box", note: "Left/Right", sampleRow: "A", sampleBlock: "boxLeft" },
    ],
  },
];

function bucketKey(section: string, tier: string) {
  return `${section}:${tier}`;
}

export function summarizeInventory(
  seats: { section: string; row: string; block: string; status: string }[],
): InventorySection[] {
  const counts = new Map<string, { selected: number; total: number }>();

  for (const seat of seats) {
    if (seat.status === "blocked") continue;
    const tier = tierFor(seat.section, seat.row, seat.block);
    const key = bucketKey(seat.section, tier);
    const cur = counts.get(key) ?? { selected: 0, total: 0 };
    cur.total += 1;
    if (seat.status === "sold") cur.selected += 1;
    counts.set(key, cur);
  }

  return LAYOUT.map((section) => {
    const tiers = section.tiers.map((def) => {
      const cur = counts.get(bucketKey(section.section, def.tier)) ?? { selected: 0, total: 0 };
      return {
        tier: def.tier,
        note: def.note,
        price: priceFor(section.section, def.sampleRow, def.sampleBlock ?? ""),
        selected: cur.selected,
        total: cur.total,
      };
    });
    return {
      section: section.section,
      label: section.label,
      tiers,
      selected: tiers.reduce((sum, row) => sum + row.selected, 0),
      total: tiers.reduce((sum, row) => sum + row.total, 0),
    };
  });
}
