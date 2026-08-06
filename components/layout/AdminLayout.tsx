"use client";

import {
  DollarSign,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useState } from "react";

import {
  getUserInitials,
  getUserRoleLabel,
  type SessionUser,
} from "@/lib/auth/user";
import { getSingleCompanyDashboardPath } from "@/lib/config/single-company";
import { Sidebar, type SidebarNavItem } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";

const dashboardHref = getSingleCompanyDashboardPath();

/** Clients / Create Client nav entries removed for single-client mode (routes kept dormant). */
const adminNavItems: SidebarNavItem[] = [
  { label: "Dashboard", href: dashboardHref, icon: LayoutDashboard },
  { label: "Posts", href: "/admin/posts", icon: FileText },
  { label: "Cycles", href: "/admin/cycles", icon: RefreshCw },
  { label: "Costs", href: "/admin/costs", icon: DollarSign },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

type AdminLayoutProps = {
  title: string;
  sessionUser: SessionUser;
  notificationCount?: number;
  children: React.ReactNode;
};

export function AdminLayout({
  title,
  sessionUser,
  notificationCount = 0,
  children,
}: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const userInitials = getUserInitials(sessionUser);
  const userRole = getUserRoleLabel(sessionUser);

  const sidebarProps = {
    items: adminNavItems,
    userName: sessionUser.fullName,
    userEmail: sessionUser.email,
    userRole,
    userInitials,
    rootHref: dashboardHref,
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="lg:hidden">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu overlay"
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-60 bg-tbc-sidebar transition-transform lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar {...sidebarProps} />
        </aside>
      </div>

      <div className="hidden lg:block">
        <aside className="fixed inset-y-0 left-0 z-30 w-60">
          <Sidebar {...sidebarProps} />
        </aside>
      </div>

      <div className="lg:pl-60">
        <TopBar
          title={title}
          badgeLabel="Admin"
          badgeVariant="admin"
          userInitials={userInitials}
          notificationCount={notificationCount}
          showMenuButton
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="min-h-screen px-4 pb-8 pt-20 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
