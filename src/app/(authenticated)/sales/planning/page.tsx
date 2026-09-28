import { redirect } from "next/navigation";
import type { SalesSearchParams } from "@/lib/sales/search-params";

export default async function LegacyPlanningPage({searchParams}:{searchParams?:Promise<SalesSearchParams>}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["year", "scenario", "customer", "product", "variant"] as const) {
    if (params?.[key]) query.set(key, params[key]);
  }
  redirect(`/budget/sales${query.size ? `?${query}` : ""}`);
}
