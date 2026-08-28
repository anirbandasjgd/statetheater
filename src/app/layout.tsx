import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "State Theatre NJ — Seat reservation",
  description: "Select orchestra or balcony seats and register for the event.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
