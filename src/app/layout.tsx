import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Manrope variable (SIL OFL, see ./fonts/Manrope-OFL.txt), self-hosted.
const manrope = localFont({
  src: "./fonts/Manrope-Variable.ttf",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-manrope",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "Williams Electrical Staff Portal", template: "%s · Williams Electrical Staff Portal" },
  description: "Williams Electrical Staff Portal: time recording and holiday for employees and the office.",
  applicationName: "Williams Electrical Staff Portal",
  appleWebApp: { capable: true, title: "Williams Electrical", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#18262c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${manrope.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
