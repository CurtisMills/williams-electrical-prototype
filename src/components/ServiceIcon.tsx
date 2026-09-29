import {
  BatteryCharging,
  Building2,
  Cable,
  ClipboardCheck,
  Lightbulb,
  Siren,
  SquareStack,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "emergency-callout": Siren,
  eicr: ClipboardCheck,
  "consumer-unit": SquareStack,
  "ev-charger": BatteryCharging,
  rewire: Cable,
  lighting: Lightbulb,
  "commercial-maintenance": Building2,
};

export function ServiceIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = icons[slug] ?? Lightbulb;
  return <Icon className={className} />;
}
