import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    // On desktop the app is framed as a phone so the prototype demos well.
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-slate-50 shadow-2xl sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-[2rem] sm:ring-8 sm:ring-slate-900">
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
