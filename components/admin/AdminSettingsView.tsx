"use client";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { ApiStatusTab } from "@/components/admin/settings/ApiStatusTab";
import { HolidaysSeedSection } from "@/components/admin/settings/HolidaysSeedSection";
import { NotificationsTab } from "@/components/admin/settings/NotificationsTab";
import { ProfileTab } from "@/components/admin/settings/ProfileTab";
import { UserManagementTab } from "@/components/admin/settings/UserManagementTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CompanyOption } from "@/lib/admin/settings-types";
import type { SessionUser } from "@/lib/auth/user";

type AdminSettingsViewProps = {
  sessionUser: SessionUser;
  companies: CompanyOption[];
  notificationCount?: number;
};

export function AdminSettingsView({
  sessionUser,
  companies,
  notificationCount = 0,
}: AdminSettingsViewProps) {
  return (
    <AdminLayout
      title="Settings"
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      <Tabs defaultValue="users" className="space-y-2">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="api">API Status</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagementTab companies={companies} />
        </TabsContent>

        <TabsContent value="api">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-navy">API Status</h2>
              <p className="text-sm text-text-muted">
                Integration configuration from environment variables
              </p>
            </div>
            <ApiStatusTab />
            <HolidaysSeedSection />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-navy">Notifications</h2>
              <p className="text-sm text-text-muted">
                Platform notification defaults
              </p>
            </div>
            <NotificationsTab />
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-navy">Profile</h2>
              <p className="text-sm text-text-muted">
                Your admin account settings
              </p>
            </div>
            <ProfileTab sessionUser={sessionUser} />
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
