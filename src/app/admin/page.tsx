"use client";

import { useCallback, useEffect, useState } from "react";
import { InventorySummary } from "@/components/InventorySummary";
import { AssignFromExcel } from "@/components/AssignFromExcel";
import type { InventorySection } from "@/lib/inventory";
import { formatPrice, seatLabel, type Section } from "@/lib/seats";

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string;
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

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [inventory, setInventory] = useState<InventorySection[]>([]);
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

  useEffect(() => {
    void load();
  }, [load]);

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
          <div className="mt-8 overflow-x-auto rounded-xl border border-[#3a2a22]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#1d1412] text-[#d4a24a]">
                <tr>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Seats</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#3a2a22]">
                    <td className="px-4 py-3 align-top">
                      <div>{row.name}</div>
                      <div className="text-xs text-[#f0d49a]/60">
                        {new Date(row.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div>{row.email}</div>
                      <div className="text-[#f0d49a]/70">{row.phone}</div>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
