import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Employee", template: "%s · Williams Electrical Staff Portal" },
};

export default function FieldLayout({ children }: LayoutProps<"/field">) {
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
