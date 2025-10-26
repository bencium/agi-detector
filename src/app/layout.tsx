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
  title: "ASI/AGI Monitor — Early Detection System",
  description:
    "Monitoring signals of Artificial Superintelligence (ASI) and Artificial General Intelligence (AGI) across labs, papers, and news.",
  keywords:
    "ASI, artificial superintelligence, AGI, artificial general intelligence, AI monitoring, superintelligence detection, research trends",
  authors: [{ name: "ASI/AGI Monitor Team" }],
  openGraph: {
    title: "ASI/AGI Monitor",
    description:
      "Early detection of ASI/AGI signals from research labs, academia, and industry.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
