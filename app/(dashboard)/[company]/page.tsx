import { redirect } from "next/navigation";

type PageProps = {
  params: { company: string };
};

export default function LegacyDashboardRedirect({ params }: PageProps) {
  redirect(`/dashboard/${params.company}`);
}
