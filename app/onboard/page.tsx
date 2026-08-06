import { redirect } from "next/navigation";

import { CreateClientForm } from "@/components/onboarding/CreateClientForm";
import { SetupDashboard } from "@/components/onboarding/SetupDashboard";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessOperatorTools } from "@/lib/auth/roles";
import { getAdminBottleneckCount } from "@/lib/data/notification-counts";

type OnboardPageProps = {
  searchParams?: { company?: string };
};

export default async function OnboardPage({ searchParams }: OnboardPageProps) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  if (!canAccessOperatorTools(sessionUser.role)) {
    redirect("/dashboard");
  }

  const companyId = searchParams?.company;
  const notificationCount = await getAdminBottleneckCount();

  return (
    <AdminLayout
      title={companyId ? "Client Setup" : "Add New Client"}
      sessionUser={sessionUser}
      notificationCount={notificationCount}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-navy">
            {companyId ? "Client Setup Dashboard" : "Add New Client"}
          </h1>
          <p className="mt-2 text-text-muted">
            {companyId
              ? "Complete each section independently. Save progress as you go, then launch when ready."
              : "Create a client account, then configure brand voice, visuals, and content strategy."}
          </p>
        </div>

        {companyId ? (
          <SetupDashboard companyId={companyId} />
        ) : (
          <CreateClientForm />
        )}
      </div>
    </AdminLayout>
  );
}
