import { PageHeader } from "@/components/ui";
import { getCustomer, listServices } from "@/lib/db";
import { QuoteForm } from "./QuoteForm";

export default async function QuotePage(props: PageProps<"/customer/quote">) {
  const { service } = await props.searchParams;
  const [services, customer] = await Promise.all([listServices(), getCustomer()]);

  return (
    <div>
      <PageHeader title="Request a quote" subtitle="Free, no-obligation. We reply within 24 hours." />
      <QuoteForm
        services={services}
        initialService={typeof service === "string" ? service : ""}
        customer={customer}
      />
    </div>
  );
}
