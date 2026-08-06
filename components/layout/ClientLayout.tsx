"use client";

import {
  BarChart2,
  Calendar,
  CheckSquare,
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  RefreshCw,
  Settings,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getUserInitials,
  type SessionUser,
} from "@/lib/auth/user";
import {
  Sidebar,
  type SidebarNavSection,
} from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";

type ClientLayoutProps = {
  companySlug: string;
  companyName: string;
  sessionUser: SessionUser;
  notificationCount?: number;
  children: React.ReactNode;
};

export function ClientLayout({
  companySlug,
  companyName,
  sessionUser,
  notificationCount = 0,
  children,
}: ClientLayoutProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const base = `/dashboard/${companySlug}`;

  const navSections = useMemo<SidebarNavSection[]>(
    () => [
      {
        heading: "Work",
        items: [
          { label: "Dashboard", href: base, icon: LayoutDashboard },
          { label: "Approve", href: `${base}/approve`, icon: CheckSquare },
          { label: "Cycles", href: `${base}/cycles`, icon: RefreshCw },
        ],
      },
      {
        heading: "Content",
        items: [
          { label: "Published", href: `${base}/posts`, icon: ImageIcon },
          { label: "Calendar", href: `${base}/calendar`, icon: Calendar },
        ],
      },
      {
        heading: "Inputs",
        items: [
          { label: "Promotions", href: `${base}/promotions`, icon: Tag },
          { label: "Overstock", href: `${base}/overstock`, icon: Package },
        ],
      },
      {
        heading: "Insights",
        items: [
          { label: "Analytics", href: `${base}/analytics`, icon: BarChart2 },
        ],
      },
      {
        heading: "Account",
        items: [
          { label: "Settings", href: `${base}/settings`, icon: Settings },
        ],
      },
    ],
    [base]
  );

  const companyInitials = companyName.slice(0, 2).toUpperCase();
  const userInitials = getUserInitials(sessionUser);

  const sidebarProps = {
    sections: navSections,
    userName: companyName,
    userEmail: sessionUser.email,
    userRole: sessionUser.fullName,
    userInitials: companyInitials,
    rootHref: base,
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
          badgeLabel={companyName}
          badgeVariant="client"
          userInitials={userInitials}
          notificationCount={notificationCount}
          onNotificationClick={() => router.push(`${base}/approve`)}
          showMenuButton
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="min-h-screen px-4 pb-8 pt-20 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
