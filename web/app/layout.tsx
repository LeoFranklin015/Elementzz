import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

export const metadata: Metadata = {
  title: "Elementzz",
  description: "On-chain PvP card battles with autonomous agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${pressStart.variable} ${vt323.variable} h-full`}>
      <body className="min-h-full flex flex-col scanlines crt">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
