import type { Metadata } from "next";
import { Geist, Geist_Mono, Carter_One, Roboto } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const carterOne = Carter_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-carter-one',
});

const roboto = Roboto({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: "Tpaths — Secure Past Questions",
  description: "Buy and manage digital past-question materials from Tpaths.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${carterOne.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
    </html>
  );
}
