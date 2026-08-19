import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmileLoft Dental",
  description: "Lead management for a dental practice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* The app is a fixed shell: the document itself never scrolls, only
            the content area inside it does. Pages that are not the shell
            (e.g. /signin) carry their own scroll. */}
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
