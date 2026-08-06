"use client";

import { Eye, Pencil, Play, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SessionUser } from "@/lib/auth/user";
import { calculateCompleteness } from "@/lib/onboarding/completeness";
import type { BrandConfig, Company } from "@/lib/supabase/types";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { formatIndustries } from "@/lib/validations/brand-config-normalize";

type ClientRow = Company & {
  brand_configs?: BrandConfig[] | BrandConfig | null;
};

function getBrandConfig(client: ClientRow): BrandConfig | null {
  if (Array.isArray(client.brand_configs)) {
    return client.brand_configs[0] ?? null;
  }
  return client.brand_configs ?? null;
}

function ClientStatusBadge({
  status,
  setupPercent,
}: {
  status: string;
  setupPercent?: number;
}) {
  const normalized = status.toLowerCase();

  if (normalized === "active") {
    return (
      <Badge className="bg-green-100 capitalize text-green-700 hover:bg-green-100">
        Active
      </Badge>
    );
  }

  if (normalized === "setup") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          Setup
        </Badge>
        {setupPercent !== undefined ? (
          <span className="text-xs text-amber-700">Setup ({setupPercent}%)</span>
        ) : null}
      </div>
    );
  }

  if (normalized === "paused") {
    return (
      <Badge className="bg-slate-100 capitalize text-slate-700 hover:bg-slate-100">
        Paused
      </Badge>
    );
  }

  if (normalized === "cancelled") {
    return (
      <Badge className="bg-red-100 capitalize text-red-700 hover:bg-red-100">
        Cancelled
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="capitalize">
      {status}
    </Badge>
  );
}

type AdminClientsTableProps = {
  sessionUser: SessionUser;
  clients: ClientRow[];
  notificationCount?: number;
};

export function AdminClientsTable({
  sessionUser,
  clients,
  notificationCount = 0,
}: AdminClientsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const handleTriggerCycle = async (slug: string) => {
    await fetch(`/api/admin/clients/${slug}/run-now`, { method: "POST" });
    router.refresh();
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.slug.toLowerCase().includes(query)
    );
  }, [clients, search]);

  return (
    <AdminLayout
      title="Clients"
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              All Clients
            </h2>
            <p className="text-sm text-text-muted">
              Manage Autopilot client accounts
            </p>
          </div>
          <Button asChild className="bg-tbc-red hover:bg-tbc-red-hover">
            <Link href="/onboard">
              <Plus className="mr-2 h-4 w-4" />
              Add New Client
            </Link>
          </Button>
        </div>

        <div className="flex justify-end">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] dark:bg-[#0a0a0a] text-left text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Logo</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Industry</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-[#374151] dark:text-slate-300"
                    >
                      No clients found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((client) => {
                    const brand = getBrandConfig(client);
                    const isSetup = client.status.toLowerCase() === "setup";
                    const setupPercent = isSetup
                      ? calculateCompleteness(client, brand).percent
                      : undefined;
                    const detailHref = isSetup
                      ? `/onboard?company=${client.id}`
                      : `/admin/clients/${client.slug}`;

                    return (
                      <tr
                        key={client.id}
                        className="border-t border-[#E5E7EB] dark:border-[#2a2a2a] text-[#374151] dark:text-slate-300 transition-colors hover:bg-[#f8fafc] dark:hover:bg-[#0f0f1a]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tbc-red/10 text-sm font-semibold text-tbc-red">
                            {client.name.charAt(0)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <Link href={detailHref} className="hover:text-tbc-red">
                            {client.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{client.slug}</td>
                        <td className="px-4 py-3">
                          {formatIndustries(brand?.industry, "N/A")}
                        </td>
                        <td className="px-4 py-3 capitalize">{client.plan}</td>
                        <td className="px-4 py-3">
                          <ClientStatusBadge
                            status={client.status}
                            setupPercent={setupPercent}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {formatDisplayDate(client.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button asChild size="icon" variant="ghost">
                              <Link href={`/dashboard/${client.slug}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {isSetup ? (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/onboard?company=${client.id}`}>
                                  Continue Setup
                                </Link>
                              </Button>
                            ) : (
                              <Button asChild size="icon" variant="ghost">
                                <Link href={`/admin/clients/${client.slug}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Trigger cycle"
                              onClick={() => void handleTriggerCycle(client.slug)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
