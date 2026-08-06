import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

type Gate1NotificationInput = {
  companyId: string;
  ownerEmail: string;
  companyName: string;
  slug: string;
  pendingCount: number;
};

export async function sendGate1Notification({
  companyId,
  ownerEmail,
  companyName,
  slug,
  pendingCount,
}: Gate1NotificationInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "Autopilot <noreply@autopilot.ai>";
  const dashboardUrl = `https://dashboard.autopilot.ai/${slug}`;

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { error: emailError } = await resend.emails.send({
    from,
    to: ownerEmail,
    subject: `${companyName} — ${pendingCount} concepts ready for review`,
    html: [
      `<p>Hi,</p>`,
      `<p>${pendingCount} new post concepts are ready for Gate 1 approval in Autopilot.</p>`,
      `<p><a href="${dashboardUrl}">Review concepts in your dashboard</a></p>`,
      `<p>— Autopilot</p>`,
    ].join(""),
  });

  if (emailError) {
    throw new Error(emailError.message);
  }

  const supabase = createAdminClient();
  const payload: Json = {
    to: ownerEmail,
    dashboard_url: dashboardUrl,
    pending_count: pendingCount,
  };

  await supabase.from("notifications").insert({
    company_id: companyId,
    type: "gate1_ready",
    channel: "email",
    sent_at: new Date().toISOString(),
    payload,
  });
}

export async function sendGate2Notification(companyId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug, owner_email")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    throw new Error(
      companyError?.message ?? `Company ${companyId} not found.`
    );
  }

  const { count, error: countError } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("gate2_status", "pending")
    .eq("pipeline_stage", "ready");

  if (countError) {
    throw new Error(countError.message);
  }

  const pendingCount = count ?? 1;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "Autopilot <noreply@autopilot.ai>";
  const dashboardUrl = `https://dashboard.autopilot.ai/${company.slug}`;

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { error: emailError } = await resend.emails.send({
    from,
    to: company.owner_email,
    subject: `${company.name}: ${pendingCount} visuals ready for Gate 2 review`,
    html: [
      `<p>Hi,</p>`,
      `<p>${pendingCount} post visual${pendingCount === 1 ? "" : "s"} ${pendingCount === 1 ? "is" : "are"} ready for Gate 2 approval in Autopilot.</p>`,
      `<p><a href="${dashboardUrl}">Review visuals in your dashboard</a></p>`,
      `<p>Autopilot</p>`,
    ].join(""),
  });

  if (emailError) {
    throw new Error(emailError.message);
  }

  const payload: Json = {
    to: company.owner_email,
    dashboard_url: dashboardUrl,
    pending_count: pendingCount,
  };

  await supabase.from("notifications").insert({
    company_id: companyId,
    type: "gate2_ready",
    channel: "email",
    sent_at: new Date().toISOString(),
    payload,
  });
}

export async function sendEmail() {
  return null;
}

export async function sendWhatsApp() {
  return null;
}
