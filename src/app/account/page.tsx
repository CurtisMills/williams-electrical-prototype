import { Bell, ChevronRight, CreditCard, FileText, Home, LogOut, ShieldCheck } from "lucide-react";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { getCustomer } from "@/lib/db";

const menu = [
  { icon: FileText, label: "Certificates & invoices" },
  { icon: CreditCard, label: "Payment methods" },
  { icon: Bell, label: "Notifications" },
  { icon: ShieldCheck, label: "Privacy & security" },
];

export default async function AccountPage() {
  const customer = await getCustomer();
  const initials = customer.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div>
      <PageHeader title="Account" />
      <div className="space-y-6 p-5">
        <Card className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
            {initials}
          </span>
          <div>
            <p className="font-semibold text-brand-900">{customer.name}</p>
            <p className="text-sm text-slate-500">{customer.email}</p>
            <p className="text-sm text-slate-500">{customer.phone}</p>
          </div>
        </Card>

        <section>
          <SectionTitle action={<button className="text-sm font-medium text-brand-600">Add</button>}>
            My properties
          </SectionTitle>
          <div className="space-y-2">
            {customer.properties.map((p) => (
              <Card key={p.label} className="flex items-center gap-3">
                <Home className="h-5 w-5 text-brand-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand-900">{p.label}</p>
                  <p className="text-xs text-slate-500">
                    {p.address}, {p.postcode}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Card>
            ))}
          </div>
        </section>

        <Card className="divide-y divide-slate-100 p-0">
          {menu.map(({ icon: Icon, label }) => (
            <button key={label} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <Icon className="h-5 w-5 text-slate-500" />
              <span className="flex-1 text-sm font-medium text-slate-800">{label}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          ))}
        </Card>

        <button className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-red-600">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <p className="text-center text-xs text-slate-400">Williams Electrical · Prototype v0.1</p>
      </div>
    </div>
  );
}
