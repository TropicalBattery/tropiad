import { redirect } from "next/navigation";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminBottleneckCount } from "@/lib/data/notification-counts";
import { createAdminClient } from "@/lib/supabase/admin";

type CostProvider = "claude" | "flux" | "veo" | "zernio";

type GroupedCostRow = {
  company: string;
  month: string;
  claude: number;
  flux: number;
  veo: number;
  zernio: number;
  total: number;
};

type CostEventRow = {
  company_id: string;
  provider: string;
  estimated_cost_usd: number | null;
  created_at: string;
  companies: { name: string } | { name: string }[] | null;
};

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function getCompanyName(
  companies: CostEventRow["companies"],
  companyId: string
): string {
  if (!companies) {
    return companyId;
  }

  if (Array.isArray(companies)) {
    return companies[0]?.name ?? companyId;
  }

  return companies.name ?? companyId;
}

function groupCostEvents(events: CostEventRow[]): GroupedCostRow[] {
  const grouped = events.reduce<Record<string, GroupedCostRow>>((acc, event) => {
    const month = new Date(event.created_at).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const company = getCompanyName(event.companies, event.company_id);
    const key = `${event.company_id}-${month}`;

    if (!acc[key]) {
      acc[key] = {
        company,
        month,
        claude: 0,
        flux: 0,
        veo: 0,
        zernio: 0,
        total: 0,
      };
    }

    const cost = Number(event.estimated_cost_usd ?? 0);
    const provider = event.provider as CostProvider;

    if (
      provider === "claude" ||
      provider === "flux" ||
      provider === "veo" ||
      provider === "zernio"
    ) {
      acc[key][provider] += cost;
    }

    acc[key].total += cost;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => {
    const companyCompare = a.company.localeCompare(b.company);
    if (companyCompare !== 0) {
      return companyCompare;
    }
    return a.month.localeCompare(b.month);
  });
}

export default async function AdminCostsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const notificationCount = await getAdminBottleneckCount();
  const { data: costEvents, error } = await admin
    .from("cost_events")
    .select(
      `
      company_id,
      provider,
      estimated_cost_usd,
      created_at,
      companies ( name )
    `
    )
    .order("created_at", { ascending: false });

  const rows = groupCostEvents((costEvents ?? []) as CostEventRow[]);

  const totals = rows.reduce(
    (acc, row) => ({
      claude: acc.claude + row.claude,
      flux: acc.flux + row.flux,
      veo: acc.veo + row.veo,
      zernio: acc.zernio + row.zernio,
      total: acc.total + row.total,
    }),
    { claude: 0, flux: 0, veo: 0, zernio: 0, total: 0 }
  );

  return (
    <AdminLayout
      title="Costs"
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">
            API Cost Tracker
          </h2>
        </div>

        {error ? (
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 text-sm text-red-700 dark:text-rose-400">
            Failed to load cost events: {error.message}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc] dark:bg-[#0a0a0a] text-left text-[#6b7280] dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Claude API</th>
                    <th className="px-4 py-3 font-medium">Flux</th>
                    <th className="px-4 py-3 font-medium">Veo</th>
                    <th className="px-4 py-3 font-medium">Zernio</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="border-b border-[#E5E7EB] dark:border-[#2a2a2a] px-4 py-10 text-center text-[#374151] dark:text-slate-300"
                      >
                        No cost events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={`${row.company}-${row.month}`}
                        className="border-b border-[#E5E7EB] dark:border-[#2a2a2a] text-[#374151] dark:text-slate-300 transition-colors hover:bg-[#f8fafc] dark:hover:bg-[#0f0f1a]"
                      >
                        <td className="px-4 py-3 font-medium">
                          {row.company}
                          <span className="ml-2 text-xs text-[#9ca3af] dark:text-slate-500">
                            {row.month}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatCost(row.claude)}</td>
                        <td className="px-4 py-3">{formatCost(row.flux)}</td>
                        <td className="px-4 py-3">{formatCost(row.veo)}</td>
                        <td className="px-4 py-3">{formatCost(row.zernio)}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatCost(row.total)}
                        </td>
                      </tr>
                    ))
                  )}
                  {rows.length > 0 ? (
                    <tr className="border-b border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] font-semibold text-[#374151] dark:text-slate-300">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3">
                        {formatCost(totals.claude)}
                      </td>
                      <td className="px-4 py-3">{formatCost(totals.flux)}</td>
                      <td className="px-4 py-3">{formatCost(totals.veo)}</td>
                      <td className="px-4 py-3">
                        {formatCost(totals.zernio)}
                      </td>
                      <td className="px-4 py-3">{formatCost(totals.total)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
