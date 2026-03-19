// ============================================
// Add Contract Form Types
// ============================================

export type ContractFormData = {
  // Step 1: Basic Info
  name: string;
  type: "license" | "service" | "support" | "subscription";
  startDate: Date | null;
  endDate: Date | null;
  
  // Step 2: Vendor & Terms
  vendor: string;
  vendorContact: string;
  vendorEmail: string;
  value: number;
  currency: string;
  autoRenew: boolean;
  renewalTerms: string;
  
  // Step 3: Reminders & Notes
  reminderDays: number[];
  emailReminders: boolean;
  notifyEmails: string[];
  notes: string;
  tags: string[];
}

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
