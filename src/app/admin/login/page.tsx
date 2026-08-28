"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not sign in.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-8">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-[#3a2a22] bg-[#1d1412] p-6"
      >
        <p className="text-xs tracking-[0.28em] text-[#d4a24a] uppercase">State Theatre New Jersey</p>
        <h1 className="mt-2 text-2xl text-[#f4ece0]">Admin sign in</h1>
        <p className="mt-2 text-sm text-[#f4ece0]/60">Registrations are limited to staff.</p>

        <label className="mt-6 block text-xs text-[#f0d49a]/80">
          Username
          <input
            className="mt-1 w-full rounded-md border border-[#3a2a22] bg-[#140c0c] px-3 py-2 text-sm text-[#f4ece0] outline-none focus:border-[#d4a24a]"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="mt-3 block text-xs text-[#f0d49a]/80">
          Password
          <input
            className="mt-1 w-full rounded-md border border-[#3a2a22] bg-[#140c0c] px-3 py-2 text-sm text-[#f4ece0] outline-none focus:border-[#d4a24a]"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-full bg-[#d4a24a] py-2.5 text-sm font-medium text-[#1a100c] disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <a href="/" className="mt-4 block text-center text-sm text-[#f0d49a]/70 hover:text-[#f0d49a]">
          Back to map
        </a>
      </form>
    </div>
  );
}
