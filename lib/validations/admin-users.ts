import { z } from "zod";

export const createUserSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    email: z.string().email("Valid email is required"),
    role: z.enum(["admin", "client"]),
    companyId: z.string().uuid().nullable(),
    sendInvite: z.boolean(),
  })
  .superRefine((data, context) => {
    if (data.role === "client" && !data.companyId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company is required for client users",
        path: ["companyId"],
      });
    }

    if (data.role === "admin" && data.companyId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Admin users cannot be assigned to a company",
        path: ["companyId"],
      });
    }
  });

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
