import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Williams Electrical Office", template: "%s · Williams Electrical Office" },
};

export const viewport: Viewport = {
  themeColor: "#1b2529",
};

export default function OfficeLayout({ children }: LayoutProps<"/office">) {
  return <div className="min-h-dvh bg-[#f4f6f5] text-ink-950">{children}</div>;
}
