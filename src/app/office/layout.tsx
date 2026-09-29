import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Office", template: "%s · Office · Williams Electrical Staff Portal" },
};

export default function OfficeLayout({ children }: LayoutProps<"/office">) {
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
