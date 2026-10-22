import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function HealthBadge({ status, className }: { status?: string | null; className?: string }) {
  const label = status || "Healthy";
  const key = label.toLowerCase();
  const style = key === "healthy"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : key === "questionable" || key === "probable"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : key === "doubtful"
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : "border-red-200 bg-red-50 text-red-800";
  return <Badge variant="outline" className={cn("whitespace-nowrap text-[9px] uppercase tracking-wider", style, className)}>{label}</Badge>;
}
