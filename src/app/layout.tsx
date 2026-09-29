import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
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
  title: "Williams Electrical",
  description: "Book electricians, request quotes and track your jobs with Williams Electrical.",
  appleWebApp: { capable: true, title: "Williams Electrical", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c1a36",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        {/* On desktop the app is framed as a phone so the prototype demos well. */}
        <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-slate-50 shadow-2xl sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:ring-8 sm:ring-slate-900">
          <main className="flex-1 overflow-y-auto pb-24">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
