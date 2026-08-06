"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type SidebarNavSection = {
  heading: string;
  items: SidebarNavItem[];
};

type SidebarProps = {
  items?: SidebarNavItem[];
  sections?: SidebarNavSection[];
  userName: string;
  userEmail: string;
  userRole: string;
  userInitials: string;
  /** Dashboard root href — exact match only (avoids highlighting root on sub-routes). */
  rootHref?: string;
};

export function Sidebar({
  items,
  sections,
  userName,
  userEmail,
  userRole,
  userInitials,
  rootHref,
}: SidebarProps) {
  const pathname = usePathname();
  const useSections = Boolean(sections && sections.length > 0);

  return (
    <div className="flex h-full w-full flex-col bg-tbc-sidebar text-tbc-sidebar-text">
      <div className="flex h-16 shrink-0 items-center justify-center px-4">
        <Link
          href={rootHref ?? "/dashboard"}
          className="flex items-center justify-center"
        >
          <Image
            src="/tbc-logo.png"
            alt="Tropical Battery"
            width={200}
            height={48}
            className="h-10 w-auto max-w-full object-contain"
            priority
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {useSections ? (
          sections!.map((section, index) => (
            <div
              key={section.heading}
              className={cn("space-y-1", index > 0 && "mt-6")}
            >
              <p className="mb-2 px-4 text-[11px] font-medium uppercase tracking-widest text-[#555555]">
                {section.heading}
              </p>
              {renderNavItems(section.items, pathname, rootHref)}
            </div>
          ))
        ) : (
          <>
            <p className="mb-2 px-4 text-[11px] font-medium uppercase tracking-widest text-[#555555]">
              Navigation
            </p>
            {renderNavItems(items ?? [], pathname, rootHref)}
          </>
        )}
      </nav>

      <div className="mt-auto border-t border-[#1F1F1F] p-4">
        <div className="group flex items-center gap-3 rounded-lg p-2 hover:bg-tbc-sidebar-hover">
          <Avatar className="h-9 w-9 border border-[#2a2a2a]">
            <AvatarFallback className="bg-[#1F1F1F] text-xs text-[#E5E5E5]">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#E5E5E5]">
              {userName}
            </p>
            <p className="truncate text-xs text-[#888888]">{userEmail}</p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-[#555555]">
              {userRole}
            </p>
          </div>
          <a
            href="/api/auth/logout"
            className="rounded-md p-1.5 text-[#555555] opacity-0 transition-all hover:bg-[#1F1F1F] hover:text-tbc-red group-hover:opacity-100"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function renderNavItems(
  items: SidebarNavItem[],
  pathname: string,
  rootHref?: string
) {
  return items.map((item) => {
    const active = isNavItemActive(item, pathname, rootHref);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "mx-2 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
          active
            ? "bg-tbc-sidebar-active font-medium text-white"
            : "text-tbc-sidebar-text hover:bg-tbc-sidebar-hover"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            active ? "text-white" : "text-tbc-sidebar-icon"
          )}
        />
        <span>{item.label}</span>
      </Link>
    );
  });
}

function isNavItemActive(
  item: SidebarNavItem,
  pathname: string,
  rootHref?: string
): boolean {
  if (rootHref && item.href === rootHref) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
