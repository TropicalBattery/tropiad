"use client";

import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestAdminApi } from "@/lib/onboarding/admin-api";
import { createClientSchema, slugify } from "@/lib/validations/onboard";

type CreateClientFormProps = {
  onCreated?: (companyId: string) => void;
};

export function CreateClientForm({ onCreated }: CreateClientFormProps) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCompanyNameChange(name: string) {
    setCompanyName(name);
    if (!slugEdited) {
      setSlug(slugify(name));
    }
    setErrors((current) => {
      const next = { ...current };
      delete next.companyName;
      if (!slugEdited) delete next.slug;
      return next;
    });
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(slugify(value));
    setErrors((current) => {
      const next = { ...current };
      delete next.slug;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = createClientSchema.safeParse({
      companyName,
      slug,
      ownerEmail,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const company = await requestAdminApi<{ id: string; slug: string }>(
        "/api/admin/onboard/company",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );

      toast.success("Client created. Continue setup below.");
      onCreated?.(company.id);
      router.push(`/onboard?company=${company.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create client.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-sm">
      <CardHeader className="border-b border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]/80">
        <CardTitle className="text-xl text-[#111111] dark:text-white">Create New Client</CardTitle>
        <CardDescription className="mt-1">
          Start with basic account details. You can complete the rest of setup
          after creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(event) =>
                  handleCompanyNameChange(event.target.value)
                }
                placeholder="Acme Building Supplies"
              />
              {errors.companyName ? (
                <p className="text-sm text-red-600">{errors.companyName}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Owner email</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                placeholder="owner@company.com"
              />
              {errors.ownerEmail ? (
                <p className="text-sm text-red-600">{errors.ownerEmail}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              placeholder="acme-building-supplies"
            />
            <p className="text-sm text-[#9ca3af] dark:text-slate-500">
              Preview:{" "}
              <span className="font-mono text-[#0D9488]">
                dashboard.autopilot.ai/{slug || "your-slug"}
              </span>
            </p>
            {errors.slug ? (
              <p className="text-sm text-red-600">{errors.slug}</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-tbc-red hover:bg-tbc-red-hover"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
