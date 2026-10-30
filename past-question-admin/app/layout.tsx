import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/env";
import { Carter_One } from 'next/font/google';

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Console`, template: `%s · ${APP_NAME}` },
  description: "Administrative console for the TPaths secure past-questions platform.",
  robots: { index: false, follow: false },
};

const carterOne = Carter_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-carter-one',
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${carterOne.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
