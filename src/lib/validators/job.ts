import { z } from "zod";

export const customerSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone_primary: z.string().optional(),
  phone_secondary: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
});

export const jobCreateSchema = z.object({
  program: z.enum(["HEAP", "DOH"]),
  invoice_number: z.string().optional(),
  customer: customerSchema,
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type JobCreateFormData = z.infer<typeof jobCreateSchema>;
