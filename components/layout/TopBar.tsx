"use client";

import { Bell, Menu } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TopBarProps = {
  title?: string;
  badgeLabel?: string;
  badgeVariant?: "admin" | "client";
  userInitials?: string;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
};

export function TopBar({
  title,
  badgeLabel,
  badgeVariant = "admin",
  userInitials = "TB",
  notificationCount = 0,
  onNotificationClick,
  onMenuClick,
  showMenuButton = false,
}: TopBarProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center border-b border-[#E5E7EB] bg-white px-4 dark:border-[#2a2a2a] dark:bg-[#161616] lg:left-60 lg:px-6">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showMenuButton && (
            <button
              type="button"
              onClick={onMenuClick}
              className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111111] dark:text-[#a3a3a3] dark:hover:bg-[#1f1f1f] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {title ? (
            <h1 className="text-lg font-semibold text-[#111111] dark:text-white">
              {title}
            </h1>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={onNotificationClick}
            className="relative rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111111] dark:text-[#a3a3a3] dark:hover:bg-[#1f1f1f]"
            aria-label={
              onNotificationClick ? "View pending approvals" : "Notifications"
            }
          >
            <Bell className="h-[18px] w-[18px]" />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-tbc-red px-1 text-[10px] font-bold text-white">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </button>

          <Avatar className="h-8 w-8 border border-[#E5E7EB] dark:border-[#2a2a2a]">
            <AvatarFallback className="bg-[#F3F4F6] text-xs text-[#111111] dark:bg-[#1f1f1f] dark:text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>

          {badgeLabel && (
            <Badge
              variant="default"
              className={cn(
                "hidden sm:inline-flex",
                badgeVariant === "client"
                  ? "status-pill-success"
                  : "status-pill-platform"
              )}
            >
              {badgeLabel}
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
}
