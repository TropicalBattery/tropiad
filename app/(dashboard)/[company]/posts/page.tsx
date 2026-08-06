import { redirect } from "next/navigation";

type PageProps = {
  params: { company: string };
};

export default function LegacyPostsRedirect({ params }: PageProps) {
  redirect(`/dashboard/${params.company}/posts`);
}
