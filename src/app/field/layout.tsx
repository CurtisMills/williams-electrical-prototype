import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Williams Electrical Field", template: "%s · Williams Electrical Field" },
  appleWebApp: { capable: true, title: "WE Field", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1b2529",
};

export default function FieldLayout({ children }: LayoutProps<"/field">) {
  return <div className="min-h-dvh bg-[#f4f6f5] text-ink-950">{children}</div>;
}
