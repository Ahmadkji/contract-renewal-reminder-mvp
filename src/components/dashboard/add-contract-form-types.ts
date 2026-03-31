import type { ContractFormData } from "@/types/contract";

// ============================================
// Add Contract Form Types
// ============================================

export type { ContractFormData };

export const initialFormData: ContractFormData = {
  name: "",
  type: "subscription",
  startDate: null,
  endDate: null,
  vendor: "",
  vendorContact: "",
  vendorEmail: "",
  value: 0,
  currency: "USD",
  autoRenew: false,
  renewalTerms: "",
  reminderDays: [30, 14, 7],
  emailReminders: true,
  notifyEmails: [],
  notes: "",
  tags: [],
};
