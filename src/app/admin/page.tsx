"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InventorySummary } from "@/components/InventorySummary";
import { AssignFromExcel } from "@/components/AssignFromExcel";
import { DeliveredCheckbox } from "@/components/DeliveredCheckbox";
import type { InventorySection } from "@/lib/inventory";
import { formatRegisteredAt } from "@/lib/datetime";
import { tierFor } from "@/lib/pricing";
import { formatPrice, seatLabel, type Section } from "@/lib/seats";

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string;
  ticketDelivered: boolean;
  createdAt: string;
  total: number;
  seats: {
    id: string;
    section: Section;
    block: string;
    row: string;
    number: number;
    price: number;
    type: string;
  }[];
};

function assignedTierLabel(seats: Row["seats"]) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const seat of seats) {
    const section = seat.section === "orchestra" ? "Orchestra" : "Balcony";
    const label = `${section} ${tierFor(seat.section, seat.row, seat.block)}`;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels.join(", ") || "—";
}

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [inventory, setInventory] = useState<InventorySection[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/registrations")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setInventory(Array.isArray(data.inventory) ? data.inventory : []);
        setRows(Array.isArray(data.registrations) ? data.registrations : []);
      })
      .catch(() => setError("Could not load registrations."));
  }, []);

  async function markDelivered(id: string) {
    setRows((cur) => cur.map((row) => (row.id === id ? { ...row, ticketDelivered: true } : row)));
    const res = await fetch("/api/registrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ticketDelivered: true }),
    });
    if (!res.ok) {
      setRows((cur) => cur.map((row) => (row.id === id ? { ...row, ticketDelivered: false } : row)));
      setError("Could not mark that ticket as delivered.");
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const name = row.name.toLowerCase();
      const email = row.email.toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [query, rows]);

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs tracking-[0.28em] text-[#d4a24a] uppercase">State Theatre New Jersey</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="text-2xl text-[#f4ece0]">Registrations</h1>
          <div className="flex items-center gap-4">
            <a href="/admin/database" className="text-sm text-[#f0d49a]/80 hover:text-[#f0d49a]">
              Database
            </a>
            <a href="/" className="text-sm text-[#f0d49a]/80 hover:text-[#f0d49a]">
              Back to map
            </a>
            <button
              type="button"
              className="text-sm text-[#f0d49a]/70 hover:text-[#f0d49a]"
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                window.location.href = "/admin/login";
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        {error ? <p className="mt-6 text-red-300">{error}</p> : null}
        {inventory.length > 0 ? <InventorySummary inventory={inventory} /> : null}
        <AssignFromExcel onAssigned={load} />
        {rows.length === 0 && !error ? (
          <p className="mt-8 text-[#f4ece0]/60">No registrations yet.</p>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-lg text-[#f4ece0]">Assigned seats</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search assigned seats by name or email"
                  className="min-w-[16rem] rounded-md border border-[#3a2a22] bg-[#140c0c] px-3 py-2 text-sm text-[#f4ece0] outline-none placeholder:text-[#f0d49a]/40 focus:border-[#d4a24a]"
                />
                <a
                  href="/api/registrations/export"
                  className="rounded-full border border-[#d4a24a]/50 px-4 py-1.5 text-sm text-[#f0d49a] hover:border-[#d4a24a]"
                >
                  Download assigned seats
                </a>
              </div>
            </div>
            {query.trim() ? (
              <p className="mt-2 text-xs text-[#f0d49a]/70">
                {visible.length} of {rows.length} record{rows.length === 1 ? "" : "s"}
              </p>
            ) : null}
            <div className="mt-3 overflow-x-auto rounded-xl border border-[#3a2a22]">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="bg-[#1d1412] text-[#d4a24a]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Guest</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Assigned tier</th>
                    <th className="px-4 py-3 font-medium">Seats</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#f0d49a]/60">
                        No registrations match that name or email.
                      </td>
                    </tr>
                  ) : null}
                  {visible.map((row) => (
                    <tr key={row.id} className="border-t border-[#3a2a22]">
                      <td className="px-4 py-3 align-top">
                        <div>{row.name}</div>
                        <div className="text-xs text-[#f0d49a]/60">
                          {formatRegisteredAt(row.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div>{row.email}</div>
                        <div className="text-[#f0d49a]/70">{row.phone}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-[#f4ece0]/80">{assignedTierLabel(row.seats)}</td>
                      <td className="px-4 py-3 align-top">
                        <ul className="space-y-1">
                          {row.seats.map((seat) => (
                            <li key={seat.id}>
                              {seatLabel(seat)} · {formatPrice(seat.price)}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 align-top text-[#d4a24a]">{formatPrice(row.total)}</td>
                      <td className="px-4 py-3 align-top">
                        <DeliveredCheckbox
                          name={row.name}
                          checked={Boolean(row.ticketDelivered)}
                          locked={Boolean(row.ticketDelivered)}
                          onChange={(next) => {
                            if (next) void markDelivered(row.id);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
