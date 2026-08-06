import { redirect } from "next/navigation";

type PageProps = {
  params: { company: string };
};

export default function LegacySettingsRedirect({ params }: PageProps) {
  redirect(`/dashboard/${params.company}/settings`);
}
