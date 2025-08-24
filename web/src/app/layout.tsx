import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPG Platform",
  description: "Tabletop platform UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800 sticky top-0 backdrop-blur">
          <nav className="max-w-5xl mx-auto flex items-center gap-6 p-4 text-sm">
            <Link href="/" className="font-semibold">RPG Platform</Link>
            <Link href="/auth" className="opacity-80 hover:opacity-100">Auth</Link>
            <Link href="/dashboard" className="opacity-80 hover:opacity-100">Dashboard</Link>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
