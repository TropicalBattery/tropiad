import { z } from "zod";

export const catalogueItemCreateSchema = z.object({
  company_id: z.string().uuid(),
  item_name: z.string().min(1),
  category: z.string().optional().nullable(),
  price_jmd: z.number().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
  available: z.boolean().optional(),
  seasonal: z.boolean().optional(),
});

export const catalogueItemUpdateSchema = z
  .object({
    item_name: z.string().min(1).optional(),
    category: z.string().optional().nullable(),
    price_jmd: z.number().nonnegative().optional().nullable(),
    description: z.string().optional().nullable(),
    available: z.boolean().optional(),
    seasonal: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export const businessHourRowSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string().nullable().optional(),
  close_time: z.string().nullable().optional(),
  closed: z.boolean(),
});

export const businessHoursPatchSchema = z.object({
  company_id: z.string().uuid(),
  hours: z.array(businessHourRowSchema).length(7),
});

export type CatalogueItemRow = {
  id: string;
  company_id: string;
  item_name: string;
  category: string | null;
  price_jmd: number | null;
  description: string | null;
  available: boolean;
  seasonal: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessHourRow = {
  id?: string;
  company_id?: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  closed: boolean;
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
