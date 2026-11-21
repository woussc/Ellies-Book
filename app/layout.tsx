import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fennuma — a little clarity for everyday money",
  description:
    "Plan your budget, log spending and share a clear check-in. A little more clarity for your household, yourself or your team.",
  icons: {
    icon: "/fennuma.svg",
    shortcut: "/fennuma.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Fennuma",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // vinext's viewport shim does not emit viewportFit. Suppress its default
  // tag and use the complete, shared phone viewport below (one tag only).
  width: undefined,
  initialScale: undefined,
  themeColor: "#f6f4ed",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /></head>
      <body>{children}</body>
    </html>
  );
}
