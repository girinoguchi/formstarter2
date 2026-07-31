import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Sidebar } from "../src/ui/components/sidebar";
import { QueryProvider } from "../src/ui/providers/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FormStarter2",
  description: "問い合わせフォーム自動入力ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full antialiased">
        <QueryProvider>
          <Sidebar />
          <div className="flex min-h-full flex-1 flex-col pl-60">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
