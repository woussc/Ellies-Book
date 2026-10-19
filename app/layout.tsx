import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Function Budget Studio",
  description: "A private synthetic prototype for traceable function budgeting and outcome rehearsal.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
