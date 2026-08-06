import { createAdminClient } from "@/lib/supabase/admin";
import { getResendFromAddress, getSenderEmail, getNotificationSettings } from "@/lib/email/config";
import { Resend } from "resend";

export async function getNotificationRecipients(
  companyId: string,
  ownerEmail: string | null | undefined
): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from("brand_configs")
    .select("notification_emails")
    .eq("company_id", companyId)
    .single();

  const additionalEmails = config?.notification_emails ?? [];

  return Array.from(
    new Set([ownerEmail, ...additionalEmails].filter(Boolean))
  ) as string[];
}

export function buildGate1Email({
  companyName,
  conceptCount,
  reviewUrl,
}: {
  companyName: string;
  conceptCount: number;
  reviewUrl: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f0f1a; color: #e2e8f0; border-radius: 12px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 600; color: #fff;">autopilot</span>
        <span style="font-size: 12px; color: #64748b; margin-left: 8px;">by ICAN</span>
      </div>
      <h1 style="font-size: 22px; font-weight: 500; color: #fff; margin: 0 0 8px;">
        Your content is ready to review
      </h1>
      <p style="color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
        Hi ${companyName}, Autopilot has generated ${conceptCount} content concept${conceptCount !== 1 ? "s" : ""} for this week.
        Review and approve the ones you like -- we will then produce the final captions and visuals.
      </p>
      <a href="${reviewUrl}" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
        Review concepts
      </a>
      <p style="color: #475569; font-size: 12px; margin-top: 32px; line-height: 1.6;">
        This is an automated message from Autopilot. Your content cycle runs every week automatically.
      </p>
    </div>
  `;
}

export function buildGate2Email({
  companyName,
  postCount,
  reviewUrl,
}: {
  companyName: string;
  postCount: number;
  reviewUrl: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f0f1a; color: #e2e8f0; border-radius: 12px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 600; color: #fff;">autopilot</span>
        <span style="font-size: 12px; color: #64748b; margin-left: 8px;">by ICAN</span>
      </div>
      <h1 style="font-size: 22px; font-weight: 500; color: #fff; margin: 0 0 8px;">
        Your posts are ready for final approval
      </h1>
      <p style="color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
        Hi ${companyName}, captions and visuals have been produced for ${postCount} post${postCount !== 1 ? "s" : ""}.
        Give them a final look and approve the ones you are happy with -- we will schedule and publish them automatically.
      </p>
      <a href="${reviewUrl}" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
        Review and approve
      </a>
      <p style="color: #475569; font-size: 12px; margin-top: 32px; line-height: 1.6;">
        Once approved, posts will be scheduled based on your preferred posting times and published automatically.
      </p>
    </div>
  `;
}

export async function sendGate2Notification(
  runId: string,
  companyId: string
): Promise<void> {
  try {
    const notifSettings = await getNotificationSettings();
    if (!notifSettings.gate2_email) {
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      return;
    }

    const supabase = createAdminClient();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: company } = await supabase
      .from("companies")
      .select("name, owner_email, slug")
      .eq("id", companyId)
      .single();

    const { count: readyCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("run_id", runId)
      .eq("gate2_status", "pending");

    if (!company?.owner_email) {
      return;
    }

    const allRecipients = await getNotificationRecipients(
      companyId,
      company.owner_email
    );

    if (allRecipients.length === 0) {
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const reviewUrl = `${appUrl}/dashboard/${company.slug}/approve`;
    const senderEmail = await getResendFromAddress();

    try {
      await resend.emails.send({
        from: senderEmail,
        to: allRecipients,
        subject: `${readyCount ?? 0} post${readyCount !== 1 ? "s" : ""} ready for final approval`,
        html: buildGate2Email({
          companyName: company.name,
          postCount: readyCount ?? 0,
          reviewUrl,
        }),
      });
    } catch (err) {
      console.error("[notify] Gate 2 email failed:", err);
    }
  } catch (err) {
    console.error("[notify] Gate 2 email failed:", err);
  }
}

export async function checkRunGate2Notification(postId: string): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { data: post } = await supabase
      .from("posts")
      .select("run_id, company_id")
      .eq("id", postId)
      .single();

    if (!post?.run_id) {
      return;
    }

    const { count: stillProducing } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("run_id", post.run_id)
      .eq("gate1_status", "approved")
      .eq("pipeline_stage", "producing");

    if (stillProducing === 0) {
      await sendGate2Notification(post.run_id, post.company_id);
    }
  } catch (err) {
    console.error("[notify] Gate 2 readiness check failed:", err);
  }
}

export async function sendMonthlyReport({
  companyId,
  companyName,
  month,
  reportText,
  totalPosts,
  avgEngagement,
  totalCost,
}: {
  companyId: string;
  companyName: string;
  month: string;
  reportText: string;
  totalPosts: number;
  avgEngagement: string | null;
  totalCost: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const senderEmail = await getSenderEmail();

  const { data: config } = await supabase
    .from("brand_configs")
    .select("notification_emails")
    .eq("company_id", companyId)
    .single();

  const { data: company } = await supabase
    .from("companies")
    .select("owner_email, slug")
    .eq("id", companyId)
    .single();

  const recipients = Array.from(
    new Set([company?.owner_email, ...(config?.notification_emails ?? [])])
  ).filter(Boolean) as string[];

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f0f1a; color: #e2e8f0; border-radius: 12px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 600; color: #fff;">autopilot</span>
        <span style="font-size: 12px; color: #64748b; margin-left: 8px;">by ICAN</span>
      </div>
      <h1 style="font-size: 20px; font-weight: 500; color: #fff; margin: 0 0 4px;">${month} Report</h1>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">${companyName}</p>

      <div style="display: flex; gap: 16px; margin-bottom: 24px;">
        <div style="flex: 1; background: #1a1a2e; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 600; color: #fff;">${totalPosts}</div>
          <div style="font-size: 12px; color: #64748b;">Posts published</div>
        </div>
        <div style="flex: 1; background: #1a1a2e; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 600; color: #fff;">${avgEngagement ? `${avgEngagement}%` : "--"}</div>
          <div style="font-size: 12px; color: #64748b;">Avg engagement</div>
        </div>
        <div style="flex: 1; background: #1a1a2e; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 600; color: #fff;">$${totalCost.toFixed(2)}</div>
          <div style="font-size: 12px; color: #64748b;">AI cost</div>
        </div>
      </div>

      <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #cbd5e1; line-height: 1.7; margin: 0; white-space: pre-wrap;">${reportText}</p>
      </div>

      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${company?.slug}/analytics"
        style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
        View full analytics
      </a>

      <p style="color: #475569; font-size: 12px; margin-top: 32px;">
        Monthly reports are sent automatically by Autopilot.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: `Autopilot <${senderEmail}>`,
      to: recipients,
      subject: `${companyName} -- ${month} social media report`,
      html,
    });
  } catch (err) {
    console.error("[report] Email send failed:", err);
  }
}

export async function sendReminderNotification(
  companyId: string,
  pendingCount: number
): Promise<void> {
  try {
    const notifSettings = await getNotificationSettings();
    if (!notifSettings.gate1_email) {
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      return;
    }

    const supabase = createAdminClient();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: company } = await supabase
      .from("companies")
      .select("name, owner_email, slug")
      .eq("id", companyId)
      .single();

    if (!company?.owner_email) {
      return;
    }

    const recipients = await getNotificationRecipients(
      companyId,
      company.owner_email
    );

    if (recipients.length === 0) {
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const reviewUrl = `${appUrl}/dashboard/${company.slug}/approve`;
    const senderEmail = await getSenderEmail();

    await resend.emails.send({
      from: `Autopilot <${senderEmail}>`,
      to: recipients,
      subject: `Reminder -- ${pendingCount} content concept${pendingCount !== 1 ? "s" : ""} still waiting for your approval`,
      html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f0f1a; color: #e2e8f0; border-radius: 12px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 20px; font-weight: 600; color: #fff;">autopilot</span>
          <span style="font-size: 12px; color: #64748b; margin-left: 8px;">by ICAN</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 500; color: #fff; margin: 0 0 8px;">
          Your content is still waiting
        </h1>
        <p style="color: #94a3b8; margin: 0 0 8px; line-height: 1.6;">
          Hi ${company.name}, you have ${pendingCount} content concept${pendingCount !== 1 ? "s" : ""} that ${pendingCount !== 1 ? "have" : "has"} been waiting for your approval for 3 days.
        </p>
        <p style="color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
          Unapproved concepts will expire in 4 days. Once expired they will not be published and you will need to wait for next week's cycle.
        </p>
        <a href="${reviewUrl}" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Review now
        </a>
        <p style="color: #475569; font-size: 12px; margin-top: 32px;">
          Content cycles run weekly. Approve concepts to keep your social media active.
        </p>
      </div>
    `,
    });
  } catch (err) {
    console.error("[reminder] notification failed:", err);
    throw err;
  }
}

export async function sendExpiryNotification(
  companyId: string,
  expiredCount: number
): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      return;
    }

    const supabase = createAdminClient();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data: company } = await supabase
      .from("companies")
      .select("name, owner_email, slug")
      .eq("id", companyId)
      .single();

    if (!company?.owner_email) {
      return;
    }

    const recipients = await getNotificationRecipients(
      companyId,
      company.owner_email
    );

    if (recipients.length === 0) {
      return;
    }

    const senderEmail = await getSenderEmail();

    await resend.emails.send({
      from: `Autopilot <${senderEmail}>`,
      to: recipients,
      subject: `${expiredCount} content concept${expiredCount !== 1 ? "s" : ""} have expired`,
      html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f0f1a; color: #e2e8f0; border-radius: 12px;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 20px; font-weight: 600; color: #fff;">autopilot</span>
          <span style="font-size: 12px; color: #64748b; margin-left: 8px;">by ICAN</span>
        </div>
        <h1 style="font-size: 20px; font-weight: 500; color: #fff; margin: 0 0 8px;">
          Some content has expired
        </h1>
        <p style="color: #94a3b8; margin: 0 0 8px; line-height: 1.6;">
          Hi ${company.name}, ${expiredCount} content concept${expiredCount !== 1 ? "s" : ""} from this week's cycle ${expiredCount !== 1 ? "have" : "has"} expired without being approved.
        </p>
        <p style="color: #94a3b8; margin: 0 0 24px; line-height: 1.6;">
          New content will be generated automatically this Sunday. To get the most from Autopilot, try to review and approve concepts within 3 days of receiving them.
        </p>
        <p style="color: #475569; font-size: 12px; margin-top: 32px;">
          If you need to adjust your review schedule, contact your Autopilot manager.
        </p>
      </div>
    `,
    });
  } catch (err) {
    console.error("[expiry] notification failed:", err);
    throw err;
  }
}
