import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// If you really use Vercel Analytics, keep this import. Otherwise remove it.
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// `geist/font` already defines CSS variables:
//   --font-sans and --font-mono
export const metadata: Metadata = {
  title: "AI RECEPTIONIST PLATFORM",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

