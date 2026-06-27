import { z } from 'zod';

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const employeesBands = ['1-5', '6-20', '21-50', '50+'] as const;
export type EmployeesBand = (typeof employeesBands)[number];

export const leadInputSchema = z.object({
  business_name: z.string().trim().min(1, 'Requerido').max(200),
  contact_name: z.string().trim().min(1, 'Requerido').max(200),
  email: z.string().trim().email('Email inválido').max(200),
  phone: optionalText(40),
  rnc: optionalText(40),
  employees_band: z.enum(employeesBands).optional(),
  current_tool: optionalText(200),
  interest_note: optionalText(2000),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export const leadStatuses = [
  'pending',
  'qualifying',
  'approved',
  'declined',
  'converted',
  'spam',
] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leadStatusUpdateSchema = z.object({
  status: z.enum(['qualifying', 'declined', 'spam', 'pending']),
  notes: optionalText(2000),
});

export type LeadStatusUpdate = z.infer<typeof leadStatusUpdateSchema>;
