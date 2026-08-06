import Anthropic from "@anthropic-ai/sdk";

import { CLAUDE_MODEL } from "@/lib/agents/config";
import { getNotificationSettings } from "@/lib/email/config";
import { sendMonthlyReport } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

export async function generateMonthlyReport(
  companyId: string,
  month: Date
): Promise<string> {
  const supabase = createAdminClient();

  const monthStart = new Date(month);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const { data: posts } = await supabase
    .from("posts")
    .select(
      "concept, platform, content_type, content_category, impressions, reach, engagement, clicks, published_at"
    )
    .eq("company_id", companyId)
    .eq("pipeline_stage", "published")
    .gte("published_at", monthStart.toISOString())
    .lt("published_at", monthEnd.toISOString());

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  const { data: costs } = await supabase
    .from("cost_events")
    .select("estimated_cost_usd, provider")
    .eq("company_id", companyId)
    .gte("created_at", monthStart.toISOString())
    .lt("created_at", monthEnd.toISOString());

  const totalCost =
    costs?.reduce((sum, cost) => sum + (cost.estimated_cost_usd ?? 0), 0) ?? 0;
  const totalPosts = posts?.length ?? 0;
  const postsWithEngagement = posts?.filter((post) => post.engagement != null) ?? [];
  const avgEngagement = postsWithEngagement.length
    ? (
        postsWithEngagement.reduce(
          (sum, post) => sum + (post.engagement ?? 0),
          0
        ) / postsWithEngagement.length
      ).toFixed(2)
    : null;

  const monthName = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prompt = `You are writing a monthly social media performance report for ${company?.name}.

Month: ${monthName}
Total posts published: ${totalPosts}
Average engagement rate: ${avgEngagement ? `${avgEngagement}%` : "No data yet"}
Total API cost: $${totalCost.toFixed(2)}

Posts published:
${
  posts
    ?.map(
      (post) =>
        `- ${post.content_category ?? "general"} ${post.content_type} on ${post.platform}: "${post.concept?.slice(0, 80)}..." ${post.engagement ? `(${post.engagement}% engagement)` : "(no analytics yet)"}`
    )
    .join("\n") ?? "None"
}

Write a concise, plain-English monthly report covering:
1. Summary of content published this month (2-3 sentences)
2. Performance highlights if analytics are available, or what to expect once data comes in
3. Content mix observation (what types performed or were created)
4. One recommendation for next month based on the content strategy

Keep it friendly and professional. Under 300 words. No bullet points -- write in paragraphs. Address the client directly.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const reportText =
    response.content.find((block) => block.type === "text")?.text ?? "";

  const notifSettings = await getNotificationSettings();
  if (!notifSettings.monthly_report) {
    return "";
  }

  await sendMonthlyReport({
    companyId,
    companyName: company?.name ?? "Your business",
    month: monthName,
    reportText,
    totalPosts,
    avgEngagement,
    totalCost,
  });

  return reportText;
}
