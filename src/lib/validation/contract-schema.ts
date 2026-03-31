import { z } from 'zod';
import { toDateOnlyString } from '@/lib/utils/date-utils';

/**
 * Zod schema for contract input validation
 * Provides type-safe validation with clear error messages
 * 
 * Date Format Support:
 * - Accepts date-only format: YYYY-MM-DD (e.g., "2024-01-15")
 * - Accepts ISO datetime format: YYYY-MM-DDTHH:mm:ss.sssZ (e.g., "2024-01-15T00:00:00.000Z")
 * - The refine check converts both to Date objects for comparison
 */

// Custom date string validator that accepts both date-only and datetime formats
const dateStringSchema = z.string().refine(
  (val) => {
    // Accept YYYY-MM-DD format
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    // Accept ISO datetime format
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    return dateOnlyPattern.test(val) || isoPattern.test(val);
  },
  { message: 'Invalid date format. Use YYYY-MM-DD or ISO datetime format.' }
);

const optionalTrimmedStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().optional()
);

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().email({ message: 'Invalid email format' }).optional()
);

export const contractInputSchema = z.object({
  name: z.string()
    .min(1, { message: 'Contract name is required' })
    .max(200, { message: 'Contract name must be less than 200 characters' }),
  vendor: z.string()
    .min(1, { message: 'Vendor name is required' })
    .max(200, { message: 'Vendor name must be less than 200 characters' }),
  type: z.enum(['license', 'service', 'support', 'subscription'], {
    message: 'Contract type must be license, service, support, or subscription'
  }),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  value: z.number()
    .nonnegative({ message: 'Value must be non-negative' })
    .optional(),
  currency: z.string()
    .optional()
    .default('USD'),
  autoRenew: z.boolean()
    .optional()
    .default(false),
  renewalTerms: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  tags: z.array(z.string())
    .optional()
    .default([]),
  vendorContact: optionalTrimmedStringSchema,
  vendorEmail: optionalEmailSchema,
  reminderDays: z.array(z.number().int().min(1).max(365))
    .optional()
    .default([30, 14, 7]),
  emailReminders: z.boolean()
    .optional()
    .default(true),
  notifyEmails: z.array(z.string().email({ message: 'Invalid email format in notification list' }))
    .optional()
    .default([])
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    const start = toDateOnlyString(data.startDate);
    const end = toDateOnlyString(data.endDate);
    return Boolean(start) && Boolean(end) && start < end;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate']
  }
).refine(
  (data) => {
    const hasVendorContact = Boolean(data.vendorContact);
    const hasVendorEmail = Boolean(data.vendorEmail);
    return hasVendorContact === hasVendorEmail;
  },
  {
    message: 'Vendor contact and vendor email must be provided together',
    path: ['vendorEmail']
  }
);

/**
 * Infer TypeScript type from Zod schema
 * Provides compile-time type safety
 */
export type ContractInput = z.infer<typeof contractInputSchema>;

/**
 * Validate contract input data
 * Returns parsed data or validation errors
 */
export function validateContractInput(data: unknown) {
  return contractInputSchema.safeParse(data);
}
