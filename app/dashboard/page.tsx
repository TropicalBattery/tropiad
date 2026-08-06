import { redirect } from "next/navigation";

import { getSingleCompanyDashboardPath } from "@/lib/config/single-company";

export default function DashboardFallbackPage() {
  redirect(getSingleCompanyDashboardPath());
}
