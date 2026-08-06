import { redirect } from "next/navigation";

import { getSingleCompanyDashboardPath } from "@/lib/config/single-company";

/** Admin home redirects to the single-client Tropical Battery dashboard. */
export default function AdminDashboardPage() {
  redirect(getSingleCompanyDashboardPath());
}
