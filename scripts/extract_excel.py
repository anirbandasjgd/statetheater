"""Parse STNJ Seat Chart 2026 rental.xlsx into orchestra/balcony JSON."""

from __future__ import annotations

import json
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/anirbandas/Downloads/STNJ Seat Chart 2026 rental.xlsx")

ROW_ORDER = [
    "PA", "PB",
    "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
    "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "AA", "BB", "CC", "DD",
]
ROW_INDEX = {r: i for i, r in enumerate(ROW_ORDER)}
ROW_LABELS = set(ROW_ORDER)
SEAT_RE = re.compile(r"^(\d+)([ct])?$", re.I)
ORCH_LABEL_COLS = {13, 18, 31, 36}  # M, R, AE, AJ
BALC_LABEL_COLS = {9, 10, 25, 41}  # I, J, Y, AO
SKIP = {
    "STNJ Rental Seat Map 2026", "BALCONY", "ORCHESTRA", "STAGE", "EXIT",
    "AISLE", "FIRE", "FIRE AISLE", "FIRE AISLE ", "WALL", "PIT", "STAGE DOOR",
    "PROJECTION BOOTH", "Sound", "Gallery", "Upper Balc", "Mid Balc",
    "Front Balc", "Loge", "Boxes", "VIP Boxes", "Box Left", "Box Right",
    "VIP Box Right", "  VIP Box Left", "VIP Box Left", "Rear Orch",
    "Middle Orch", "Front Orch", "Pit", "STNJ Holds", "Kills/House Seats",
    "Wheelchair Space", "Companion Seat (number also has a \"c\" next to it)",
    "=",
}


def price_for(section: str, row: str) -> int:
    if section == "orchestra":
        if row in {"PA", "PB", "A", "B", "C", "D"}:
            return 0
        if row in {"E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P"}:
            return 125
        return 75
    idx = ROW_INDEX.get(row)
    if idx is not None and ROW_INDEX["A"] <= idx <= ROW_INDEX["C"]:
        return 100
    if row in ("A", "B"):
        return 100
    return 50


def parse_seat(value) -> tuple[int, str] | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value, "standard"
    if isinstance(value, float) and value.is_integer():
        return int(value), "standard"
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text in SKIP or text in ROW_LABELS:
        return None
    m = SEAT_RE.fullmatch(text)
    if not m:
        return None
    number = int(m.group(1))
    suffix = (m.group(2) or "").lower()
    kind = {"c": "companion", "t": "transfer"}.get(suffix, "standard")
    return number, kind


def theater_row(cells: list[tuple[int, object]], section: str) -> str | None:
    letters = [(col, str(val).strip()) for col, val in cells if isinstance(val, str) and val.strip() in ROW_LABELS]
    if not letters:
        return None
    label_cols = ORCH_LABEL_COLS if section == "orchestra" else BALC_LABEL_COLS
    preferred = [val for col, val in letters if col in label_cols]
    pool = preferred or [val for _, val in letters]
    return Counter(pool).most_common(1)[0][0]


def block_for(section: str, number: int, col: int, excel_row: int) -> str:
    if 40 <= excel_row <= 48:
        if col <= 20:
            return "vipBoxRight" if excel_row >= 47 else "boxRight"
        return "vipBoxLeft" if excel_row >= 47 else "boxLeft"
    if number >= 100:
        if section == "balcony" and number % 2 == 0:
            return "leftCenter"
        if section == "balcony" and number % 2 == 1:
            return "rightCenter"
        return "center"
    if number % 2 == 0:
        return "left"
    return "right"


def box_row(col: int) -> str:
    # F=B, G=A on house right; AR=A, AS=B on house left (excel row 49 headers).
    if col in (6, 45):  # F, AS
        return "B"
    if col in (7, 44):  # G, AR
        return "A"
    return "A"


def extract(path: Path) -> tuple[list[dict], list[dict]]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    by_row: dict[int, list[tuple[int, object]]] = defaultdict(list)
    for row in ws.iter_rows(min_row=1, max_row=90, max_col=49):
        for cell in row:
            if cell.value is None or str(cell.value).strip() == "":
                continue
            by_row[cell.row].append((cell.column, cell.value))

    orchestra: list[dict] = []
    balcony: list[dict] = []
    for excel_row, cells in sorted(by_row.items()):
        if excel_row < 8 or excel_row in (49, 50, 51) or excel_row > 83:
            continue
        section = "orchestra" if excel_row >= 52 else "balcony"
        letter = theater_row(cells, section)
        for col, value in cells:
            parsed = parse_seat(value)
            if not parsed:
                continue
            number, kind = parsed
            if 40 <= excel_row <= 48:
                letter = box_row(col)
            if not letter:
                continue
            # Orchestra row G cells labeled "B" were skipped by parse_seat.
            block = block_for(section, number, col, excel_row)
            seat = {
                "section": section,
                "block": block,
                "row": letter,
                "number": number,
                "type": kind,
                "price": price_for(section, letter),
                "x": col,
                "y": excel_row,
            }
            (orchestra if section == "orchestra" else balcony).append(seat)
    return orchestra, balcony


def summarize(name: str, seats: list[dict]) -> None:
    print(f"\n=== {name}: {len(seats)} seats ===")
    print("types", Counter(s["type"] for s in seats))
    print("blocks", Counter(s["block"] for s in seats))
    rows = sorted({s["row"] for s in seats}, key=lambda r: ROW_INDEX.get(r, 99))
    for row in rows:
        rs = [s for s in seats if s["row"] == row]
        nums = sorted(s["number"] for s in rs)
        print(f"  {row:4s} {len(rs):3d}  {nums[0]}–{nums[-1]}  {Counter(s['block'] for s in rs)}")


def main() -> None:
    dest_xlsx = ROOT / "data" / "STNJ-Seat-Chart-2026.xlsx"
    dest_xlsx.parent.mkdir(exist_ok=True)
    shutil.copy2(SOURCE, dest_xlsx)

    orchestra, balcony = extract(SOURCE)
    summarize("orchestra", orchestra)
    summarize("balcony", balcony)

    for name, seats in (("orchestra", orchestra), ("balcony", balcony)):
        out = ROOT / "data" / f"{name}.json"
        out.write_text(json.dumps(seats, indent=2))
        print("wrote", out, len(seats))

    meta = {
        "source": "STNJ Seat Chart 2026 rental.xlsx",
        "orchestra": len(orchestra),
        "balcony": len(balcony),
    }
    (ROOT / "data" / "meta.json").write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
